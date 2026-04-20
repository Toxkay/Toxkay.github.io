# Web Recon Cheatsheet

> Field-tested commands and techniques for web application reconnaissance during penetration tests and bug bounty hunting.

---

## Table of Contents

- [Subdomain Enumeration](#subdomain-enumeration)
- [Directory & File Brute-Forcing](#directory--file-brute-forcing)
- [Parameter Discovery](#parameter-discovery)
- [Technology Fingerprinting](#technology-fingerprinting)
- [JavaScript Recon](#javascript-recon)
- [API Endpoint Discovery](#api-endpoint-discovery)
- [Useful Wordlists](#useful-wordlists)

---

## Subdomain Enumeration

### Passive (no direct contact with target)

```bash
# Subfinder — fast passive enumeration
subfinder -d target.com -all -recursive -o subs.txt

# AMASS passive
amass enum -passive -d target.com -o amass-passive.txt

# Certificate transparency (crt.sh)
curl -s "https://crt.sh/?q=%.target.com&output=json" | jq -r '.[].name_value' | sort -u
```

### Active DNS brute-force

```bash
# PureDNS with a big wordlist
puredns bruteforce /opt/wordlists/dns/best-dns-wordlist.txt target.com \
  -r /opt/resolvers.txt -o live-subs.txt

# Gobuster DNS mode
gobuster dns -d target.com -w /opt/wordlists/dns/subdomains-top1million-5000.txt \
  -t 50 --wildcard
```

### Live host probing

```bash
# httpx — probe for live web servers
cat subs.txt | httpx -silent -status-code -title -tech-detect -o live-hosts.txt

# Filter by status code
cat subs.txt | httpx -mc 200,301,302,403 -silent
```

---

## Directory & File Brute-Forcing

### Feroxbuster (recommended)

```bash
# Basic recursive scan
feroxbuster -u https://target.com -w /opt/wordlists/dirb/common.txt \
  -x php,html,txt,bak -r -k -t 50

# Scan with headers (auth bypass attempt)
feroxbuster -u https://target.com \
  -H "X-Forwarded-For: 127.0.0.1" \
  -H "X-Original-URL: /admin" \
  -w /opt/SecLists/Discovery/Web-Content/raft-medium-directories.txt

# Quiet output, save to file
feroxbuster -u https://target.com -w /opt/wordlists/big.txt -q -o ferro-out.txt
```

### Gobuster

```bash
gobuster dir -u https://target.com \
  -w /opt/SecLists/Discovery/Web-Content/directory-list-2.3-medium.txt \
  -x php,html,txt -t 40 -o gobuster.txt
```

### ffuf (fast fuzzing)

```bash
# Directory fuzzing
ffuf -u https://target.com/FUZZ -w /opt/wordlists/big.txt -mc 200,301,302,403

# File extension fuzzing
ffuf -u https://target.com/admin/FUZZ \
  -w /opt/wordlists/common.txt -e .php,.bak,.old,.html,.txt
```

---

## Parameter Discovery

```bash
# Arjun — HTTP parameter discovery
arjun -u https://target.com/search --get --post

# x8 (fast parameter brute-forcer)
x8 -u "https://target.com/api/v1/users" \
  -w /opt/SecLists/Discovery/Web-Content/burp-parameter-names.txt \
  -X GET

# ParamSpider — crawl JS files for parameters
python3 paramspider.py -d target.com -o params.txt
```

---

## Technology Fingerprinting

```bash
# Whatweb
whatweb -a 3 https://target.com

# Wappalyzer CLI
wappalyzer https://target.com

# httpx with tech detection
echo "https://target.com" | httpx -tech-detect -json

# Check headers manually
curl -sI https://target.com | grep -iE "server|x-powered-by|x-generator|set-cookie"
```

### Common header leaks to look for

| Header | What it reveals |
|--------|----------------|
| `Server: Apache/2.4.41` | Web server version |
| `X-Powered-By: PHP/7.4.3` | Backend language / version |
| `X-Generator: Drupal 8` | CMS type & version |
| `Set-Cookie: PHPSESSID=...` | PHP session handling |
| `Set-Cookie: JSESSIONID=...` | Java / J2EE stack |
| `X-AspNet-Version: 4.0.x` | ASP.NET version |

---

## JavaScript Recon

```bash
# GetAllURLs — extract URLs from JS files
cat live-hosts.txt | gau | grep ".js" | sort -u > js-files.txt

# LinkFinder — find endpoints in JS
python3 linkfinder.py -i https://target.com -d -o cli

# JSParser / getJS — crawl all JS
getJS --url https://target.com --complete --output js.txt

# Extract secrets from JS (truffleHog)
trufflehog filesystem ./downloaded-js-files/
```

### Manual JS secrets regex (Burp Suite)
Add these to Burp's active/passive scan configuration:
```
(api[_-]?key|apikey|secret|token|password)\s*[:=]\s*["'][^"']{8,}["']
```

---

## API Endpoint Discovery

```bash
# Kiterunner — fast API route brute-forcer
kr scan https://target.com/api -w /opt/routes-large.kite -x 20

# ffuf with API wordlist
ffuf -u https://target.com/api/v1/FUZZ \
  -w /opt/SecLists/Discovery/Web-Content/api/api-endpoints.txt \
  -mc 200,201,400,401,403 -H "Content-Type: application/json"

# Swagger / OpenAPI auto-discovery
ffuf -u https://target.com/FUZZ \
  -w /opt/SecLists/Discovery/Web-Content/swagger.txt \
  -mc 200
```

---

## Useful Wordlists

| Wordlist | Use case |
|----------|----------|
| `SecLists/Discovery/DNS/best-dns-wordlist.txt` | Subdomain brute-force |
| `SecLists/Discovery/Web-Content/raft-medium-directories.txt` | Directory discovery |
| `SecLists/Discovery/Web-Content/burp-parameter-names.txt` | Parameter fuzzing |
| `SecLists/Discovery/Web-Content/swagger.txt` | API spec file discovery |
| `SecLists/Passwords/Leaked-Databases/rockyou.txt` | Password spraying |
| `assetnote.io/wordlists` | High-quality content discovery |

---

*Last updated: 2024-03-01 · Category: Web Security*
