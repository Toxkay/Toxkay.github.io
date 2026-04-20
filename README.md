# Toxkay — Offensive Security Engineer Portfolio

Personal website hosted at **https://toxkay.github.io** built as a pure static site (HTML + CSS + JS). No build step required — GitHub Pages serves the files directly.

---

## Site Structure

```
toxkay.github.io/
├── index.html              ← SPA shell (all pages live here via hash routing)
├── assets/
│   ├── css/style.css       ← All styles
│   ├── js/app.js           ← Router + data rendering
│   └── cv/
│       └── Toxkay-CV.pdf   ← Your CV (add this file)
├── data/
│   ├── projects.json       ← Projects list
│   └── writeups.json       ← Writeups list
└── content/
    └── notes/
        ├── manifest.json   ← Notes index metadata
        ├── web-recon-cheatsheet.md
        ├── linux-privesc.md
        └── active-directory-attacks.md
```

---

