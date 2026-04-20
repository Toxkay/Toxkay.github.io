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

## How to Update Content

### ➕ Add / Edit a Project

Edit `data/projects.json`. Each entry has this shape:

```json
{
  "name": "my-tool",
  "description": "What it does.",
  "url": "https://github.com/Toxkay/my-tool",
  "language": "Python",
  "icon": "🔍",
  "tags": ["Recon", "Automation"],
  "stars": 12
}
```

- `language` — used for the coloured dot; supported values: `Python`, `Bash`, `Go`, `C`, `PowerShell`, `Rust`.
- `stars` — optional; omit to hide the star count.
- `icon` — any emoji works.

### ➕ Add / Edit a Writeup

Edit `data/writeups.json`:

```json
{
  "title": "My HTB Writeup",
  "url": "https://medium.com/@toxkay/my-writeup",
  "date": "2024-06-01",
  "platform": "Medium",
  "readTime": "8 min read",
  "summary": "Short description shown on the card.",
  "tags": ["HackTheBox", "Web"]
}
```

### 📝 Add a New Note / Cheatsheet

1. Create the markdown file in `content/notes/`:
   ```
   content/notes/my-new-note.md
   ```
2. Register it in `content/notes/manifest.json`:
   ```json
   {
     "slug": "my-new-note",
     "title": "My New Note",
     "date": "2024-06-01",
     "category": "Web Security",
     "icon": "🌐",
     "tags": ["Web", "Cheatsheet"]
   }
   ```
3. The note will appear in the Notes index automatically.

Markdown features supported: headings, fenced code blocks with syntax highlighting, tables, blockquotes, bold/italic, and links.

### 📄 Update Your CV

Replace `assets/cv/Toxkay-CV.pdf` with your updated PDF (keep the same filename). The Download and Preview buttons will pick it up automatically.

---

## Running Locally

Because the site fetches JSON and Markdown files via `fetch()`, you need a local HTTP server (not just `file://`):

```bash
# Python 3
python3 -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code — Live Server extension works too
```

Then open `http://localhost:8080` in your browser.

---

## Deployment

The site is deployed automatically via **GitHub Pages**:

1. Push to the `main` branch (or whichever branch is configured in *Settings → Pages*).
2. GitHub Pages serves `index.html` from the root of the repository.
3. No build step required.

If you want to use a custom domain, add a `CNAME` file to the root of the repo containing your domain name (e.g. `toxkay.dev`).

---

## Customisation Checklist

- [ ] Update social links in `index.html` (Medium, LinkedIn, Twitter, GitHub URLs)
- [ ] Update the bio, skills, and certifications in the **About** section of `index.html`
- [ ] Add your CV PDF to `assets/cv/Toxkay-CV.pdf`
- [ ] Replace example projects in `data/projects.json` with your real projects
- [ ] Replace example writeups in `data/writeups.json` with your real posts
- [ ] Add your own notes under `content/notes/` and register them in `manifest.json`

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Hosting | GitHub Pages |
| Framework | Vanilla HTML / CSS / JS (SPA with hash routing) |
| Fonts | JetBrains Mono + Inter (Google Fonts) |
| Markdown rendering | [marked.js](https://marked.js.org/) |
| Syntax highlighting | [highlight.js](https://highlightjs.org/) |
| Icons / SVGs | Inline SVG |
