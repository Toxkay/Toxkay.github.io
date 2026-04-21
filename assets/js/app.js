/* ═══════════════════════════════════════════════════════════════
   Toxkay.github.io — app.js
   SPA router + data rendering for portfolio site
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Constants ────────────────────────────────────────────────── */
const SECTIONS = ['about', 'projects', 'writeups', 'notes', 'cv'];
const DEFAULT_SECTION = 'about';

/* ── Cache ────────────────────────────────────────────────────── */
const cache = {};

/* ── DOM helpers ──────────────────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* ════════════════════════════════════════════════════════════════
   ROUTER
   ════════════════════════════════════════════════════════════════ */
function getRoute() {
  const hash = window.location.hash.slice(1) || DEFAULT_SECTION;
  // notes/slug  →  { section: 'notes', slug: 'slug' }
  // notes       →  { section: 'notes', slug: null }
  // about       →  { section: 'about', slug: null }
  const [section, ...rest] = hash.split('/');
  return { section, slug: rest.join('/') || null };
}

function navigate(section, slug = null) {
  const hash = slug ? `#${section}/${slug}` : `#${section}`;
  window.history.pushState(null, '', hash);
  render();
}

function render() {
  const { section, slug } = getRoute();
  const target = SECTIONS.includes(section) ? section : DEFAULT_SECTION;

  // Show/hide sections
  SECTIONS.forEach((s) => {
    const el = $(`#section-${s}`);
    if (el) el.classList.toggle('hidden', s !== target);
  });

  // Update active nav link
  $$('.nav-link').forEach((a) => {
    a.classList.toggle('active', a.dataset.section === target);
  });

  // Lazy-load section data
  switch (target) {
    case 'projects': loadProjects(); break;
    case 'writeups': loadWriteups(); break;
    case 'notes':    loadNotes(slug); break;
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ════════════════════════════════════════════════════════════════
   FETCH HELPERS
   ════════════════════════════════════════════════════════════════ */
async function fetchJSON(url) {
  if (cache[url]) return cache[url];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const data = await res.json();
  cache[url] = data;
  return data;
}

async function fetchText(url) {
  if (cache[url]) return cache[url];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  cache[url] = text;
  return text;
}

/* ════════════════════════════════════════════════════════════════
   PROJECTS
   ════════════════════════════════════════════════════════════════ */
async function loadProjects() {
  const grid = $('#projects-grid');
  if (!grid || grid.dataset.loaded) return;

  try {
    const projects = await fetchJSON('data/projects.json');
    grid.dataset.loaded = 'true';
    grid.innerHTML = projects.map(renderProjectCard).join('');
  } catch (e) {
    grid.innerHTML = errorState('projects', e);
  }
}

function renderProjectCard(p) {
  const langDot = p.language
    ? `<span class="lang-dot lang-${p.language.toLowerCase().replace(' ', '-')}"></span>${p.language}`
    : '';

  const tags = (p.tags || []).map((t) => `<span class="tag tag-cyan">${t}</span>`).join('');
  const stars = p.stars != null
    ? `<span class="project-stars">★ ${p.stars}</span>`
    : '';

  // Outer element is a <div> to avoid nested <a> elements (invalid HTML).
  // The card header icon links to the repo; clicking the card body also navigates.
  return `
    <div class="project-card" role="article">
      <div class="project-card-header">
        <div class="project-icon" aria-hidden="true">${p.icon || '⚙'}</div>
        <a href="${p.url}" target="_blank" rel="noopener" class="project-gh-link" aria-label="GitHub repo for ${p.name}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
        </a>
      </div>
      <div>
        <a href="${p.url}" target="_blank" rel="noopener" class="project-name-link">
          <div class="project-name">${p.name}</div>
        </a>
        <div class="project-desc">${p.description}</div>
      </div>
      <div class="project-tags">${tags}</div>
      <div class="project-meta">
        <span class="project-lang">${langDot}</span>
        ${stars}
      </div>
    </div>`;
}

/* ════════════════════════════════════════════════════════════════
   WRITEUPS
   ════════════════════════════════════════════════════════════════ */
async function loadWriteups() {
  const list = $('#writeups-list');
  if (!list || list.dataset.loaded) return;

  try {
    const writeups = await fetchJSON('data/writeups.json');
    list.dataset.loaded = 'true';
    list.innerHTML = writeups.map(renderWriteupCard).join('');
  } catch (e) {
    list.innerHTML = errorState('writeups', e);
  }
}

function renderWriteupCard(w) {
  const tags = (w.tags || []).map((t) => `<span class="tag tag-purple">${t}</span>`).join('');

  return `
    <a href="${w.url}" target="_blank" rel="noopener" class="writeup-card" aria-label="${w.title}">
      <div class="writeup-header">
        <div class="writeup-title">${w.title}</div>
        <span class="writeup-external" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M6.22 8.72a.75.75 0 001.06 1.06l5.22-5.22v1.69a.75.75 0 001.5 0v-3.5a.75.75 0 00-.75-.75h-3.5a.75.75 0 000 1.5h1.69L6.22 8.72z"/><path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 007 4H4.75A2.75 2.75 0 002 6.75v4.5A2.75 2.75 0 004.75 14h4.5A2.75 2.75 0 0012 11.25V9a.75.75 0 00-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5z"/></svg>
        </span>
      </div>
      <div class="writeup-meta">
        <span>📅 ${w.date}</span>
        ${w.platform ? `<span>· ${w.platform}</span>` : ''}
        ${w.readTime ? `<span>· ${w.readTime}</span>` : ''}
      </div>
      <div class="writeup-summary">${w.summary}</div>
      <div class="writeup-tags">${tags}</div>
    </a>`;
}

/* ════════════════════════════════════════════════════════════════
   NOTES
   ════════════════════════════════════════════════════════════════ */
let allNotes = [];

async function loadNotes(slug) {
  if (slug) {
    await showNote(slug);
  } else {
    showNotesIndex();
    await loadNotesIndex();
  }
}

function showNotesIndex() {
  $('#notes-index').classList.remove('hidden');
  $('#note-viewer').classList.add('hidden');
}

function showNotesViewer() {
  $('#notes-index').classList.add('hidden');
  $('#note-viewer').classList.remove('hidden');
}

async function loadNotesIndex() {
  const list = $('#notes-list');
  if (!list || list.dataset.loaded) return;

  try {
    const manifest = await fetchJSON('content/notes/manifest.json');
    allNotes = manifest;
    list.dataset.loaded = 'true';
    renderNotesList(allNotes);
    setupNotesSearch();
  } catch (e) {
    list.innerHTML = errorState('notes', e);
  }
}

function renderNotesList(notes) {
  const list = $('#notes-list');
  if (!notes.length) {
    if (allNotes.length) {
      list.innerHTML = '<p class="loading-state" aria-live="polite">No matching notes. Try a different search.</p>';
      return;
    }

    list.innerHTML = `
      <div class="loading-state" aria-live="polite">
        <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
          <span class="tag tag-yellow">COMING SOON</span>
          <span>📝 Notes are getting written.</span>
        </div>
        <div style="margin-top:.75rem;color:var(--text-2)">
          Check back soon — this section will fill up as I publish new writeups and cheat sheets.
        </div>
      </div>`;
    return;
  }

  list.innerHTML = notes.map((n) => `
    <button class="note-card" onclick="openNote('${n.slug}')" aria-label="Read note: ${n.title}">
      <div class="note-card-left">
        <span class="note-icon" aria-hidden="true">${n.icon || '📄'}</span>
        <div class="note-info">
          <div class="note-title">${n.title}</div>
          <div class="note-meta">${n.date} · ${n.category}</div>
        </div>
      </div>
      <div class="note-tags">
        ${(n.tags || []).map((t) => `<span class="tag tag-green">${t}</span>`).join('')}
      </div>
      <span class="note-arrow" aria-hidden="true">→</span>
    </button>`).join('');
}

function setupNotesSearch() {
  const input = $('#notesSearch');
  if (!input || input.dataset.bound) return;
  input.dataset.bound = 'true';

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q) {
      renderNotesList(allNotes);
      return;
    }
    const filtered = allNotes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        (n.category || '').toLowerCase().includes(q)
    );
    renderNotesList(filtered);
  });
}

function openNote(slug) {
  navigate('notes', slug);
}

async function showNote(slug) {
  showNotesViewer();
  const viewer = $('#note-content');

  try {
    const md = await fetchText(`content/notes/${slug}.md`);

    // Configure marked
    const renderer = new marked.Renderer();
    marked.setOptions({
      renderer,
      gfm: true,
      breaks: true,
    });

    viewer.innerHTML = marked.parse(md);

    // Syntax highlighting
    viewer.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });

    // Set page title based on first h1
    const h1 = viewer.querySelector('h1');
    if (h1) document.title = `${h1.textContent} · Toxkay`;
  } catch (e) {
    const p = document.createElement('p');
    p.style.color = 'var(--red)';
    p.textContent = `Error loading note: ${e.message}`;
    viewer.innerHTML = '';
    viewer.appendChild(p);
  }
}

/* ════════════════════════════════════════════════════════════════
   MISC HELPERS
   ════════════════════════════════════════════════════════════════ */
function errorState(name, err) {
  const p = document.createElement('p');
  p.style.cssText = 'color:var(--red);font-family:var(--font-mono);font-size:.875rem';
  p.textContent = `Failed to load ${name}: ${err.message}`;
  return p.outerHTML;
}

/* ════════════════════════════════════════════════════════════════
   NAVBAR BEHAVIOUR
   ════════════════════════════════════════════════════════════════ */
function setupNavbar() {
  // Mobile toggle
  const toggle = $('#navToggle');
  const links  = $('#navLinks');

  toggle?.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });

  // Close mobile menu on link click
  $$('.nav-link').forEach((a) =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );

  // Scroll shadow
  const navbar = $('#navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
}

/* ── Back button in notes viewer ─────────────────────────────── */
function setupBackButton() {
  $('#notes-back')?.addEventListener('click', () => {
    document.title = 'Toxkay | Offensive Security Engineer';
    navigate('notes');
  });
}

/* ── Footer year ─────────────────────────────────────────────── */
function setFooterYear() {
  const el = $('#footer-year');
  if (el) el.textContent = new Date().getFullYear();
}

/* ════════════════════════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  setupNavbar();
  setupBackButton();
  setFooterYear();

  // Listen to hash changes
  window.addEventListener('hashchange', render);
  window.addEventListener('popstate', render);

  // Initial render
  render();
});
