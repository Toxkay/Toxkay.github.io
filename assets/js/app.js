/* ═══════════════════════════════════════════════════════════════
   Toxkay.github.io — app.js
   SPA router + Timeline Archive + In-Website Writeup Reader + CLI
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Constants ────────────────────────────────────────────────── */
const SECTIONS = ['about', 'archive', 'projects', 'writeups', 'cv'];
const DEFAULT_SECTION = 'about';

/* ── Cache ────────────────────────────────────────────────────── */
const cache = {};

/* ── State ────────────────────────────────────────────────────── */
let allArchiveItems = [];
let activeArchiveTag = 'All';
let allWriteups = [];

/* ── DOM helpers ──────────────────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* ════════════════════════════════════════════════════════════════
   ROUTER
   ════════════════════════════════════════════════════════════════ */
function getRoute() {
  const hash = window.location.hash.slice(1) || DEFAULT_SECTION;
  // writeups/slug  →  { section: 'writeups', slug: 'slug' }
  // writeups       →  { section: 'writeups', slug: null }
  // archive        →  { section: 'archive', slug: null }
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

  // Show/hide section containers
  SECTIONS.forEach((s) => {
    const el = $(`#section-${s}`);
    if (el) el.classList.toggle('hidden', s !== target);
  });

  // Update navbar active links
  $$('.nav-link').forEach((a) => {
    a.classList.toggle('active', a.dataset.section === target);
  });

  // Load section content
  switch (target) {
    case 'archive':  loadArchive(); break;
    case 'projects': loadProjects(); break;
    case 'writeups': loadWriteups(slug); break;
  }

  if (!slug) {
    document.title = 'Toxkay | Offensive Security Engineer';
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* ════════════════════════════════════════════════════════════════
   FETCH HELPERS
   ════════════════════════════════════════════════════════════════ */
async function fetchJSON(baseUrl) {
  // Append cache buster timestamp to prevent stale local cache
  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${baseUrl}`);
  return await res.json();
}

async function fetchText(baseUrl) {
  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${baseUrl}`);
  return await res.text();
}

/* ════════════════════════════════════════════════════════════════
   TIMELINE ARCHIVE
   ════════════════════════════════════════════════════════════════ */
async function loadArchive() {
  const container = $('#archive-timeline');
  if (!container) return;

  try {
    const [projects, writeups, certs] = await Promise.all([
      fetchJSON('data/projects.json').catch(() => []),
      fetchJSON('data/writeups.json').catch(() => []),
      fetchJSON('data/certs.json').catch(() => [])
    ]);

    const normalizedProjects = projects.map(p => ({
      type: 'Project',
      title: p.name,
      summary: p.description,
      url: p.url,
      year: p.year || '2025',
      date: p.date || `${p.year || '2025'}-01-01`,
      tags: p.tags || ['Projects'],
      icon: p.icon || '⚙'
    }));

    const normalizedWriteups = writeups.map(w => ({
      type: 'Writeup',
      title: w.title,
      summary: w.summary,
      slug: w.slug,
      url: w.url,
      year: w.year || '2026',
      date: w.date || `${w.year || '2026'}-01-01`,
      tags: w.tags || ['Writeups'],
      platform: w.platform,
      readTime: w.readTime,
      icon: '📝'
    }));

    const normalizedCerts = certs.map(c => ({
      type: 'Cert',
      title: c.title,
      summary: c.summary,
      issuer: c.issuer,
      year: c.year || '2026',
      date: c.date || `${c.year || '2026'}-01-01`,
      tags: c.tags || ['Certs'],
      icon: '🛡️'
    }));

    allArchiveItems = [...normalizedWriteups, ...normalizedProjects, ...normalizedCerts].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    setupArchiveFilters();
    renderArchiveTimeline(activeArchiveTag);
  } catch (e) {
    container.innerHTML = errorState('archive timeline', e);
  }
}

function setupArchiveFilters() {
  const filterBar = $('#archiveFilters');
  if (!filterBar || filterBar.dataset.bound) return;
  filterBar.dataset.bound = 'true';

  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-pill');
    if (!btn) return;

    $$('.filter-pill', filterBar).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    activeArchiveTag = btn.dataset.tag || 'All';
    renderArchiveTimeline(activeArchiveTag);
  });
}

function renderArchiveTimeline(tag = 'All') {
  const container = $('#archive-timeline');
  if (!container) return;

  const filtered = (tag === 'All')
    ? allArchiveItems
    : allArchiveItems.filter(item => (item.tags || []).includes(tag) || item.type === tag);

  if (!filtered.length) {
    container.innerHTML = `
      <div class="loading-state">
        <span class="term-prompt">$ </span>No items found for tag <span class="tag tag-yellow">${tag}</span>
      </div>`;
    return;
  }

  // Group by Year
  const grouped = {};
  filtered.forEach(item => {
    const y = item.year || 'Older';
    if (!grouped[y]) grouped[y] = [];
    grouped[y].push(item);
  });

  const years = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  container.innerHTML = years.map(year => `
    <div class="timeline-year-group">
      <div class="timeline-year-badge">
        <span class="year-prefix">// </span>${year}
      </div>
      <div class="timeline-items">
        ${grouped[year].map(renderTimelineItem).join('')}
      </div>
    </div>
  `).join('');
}

function renderTimelineItem(item) {
  const tagsHtml = (item.tags || []).map(t => `<span class="tag tag-cyan">${t}</span>`).join('');
  const badgeClass = item.type === 'Writeup' ? 'tag-purple' : item.type === 'Project' ? 'tag-green' : 'tag-yellow';

  let clickAttr = '';
  let hrefAttr = '#';
  let externalIcon = '';

  if (item.type === 'Writeup' && item.slug) {
    clickAttr = `onclick="navigate('writeups', '${item.slug}')"`;
    hrefAttr = `#writeups/${item.slug}`;
  } else if (item.url) {
    hrefAttr = item.url;
    clickAttr = `target="_blank" rel="noopener"`;
    externalIcon = `<svg class="ext-link-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M6.22 8.72a.75.75 0 001.06 1.06l5.22-5.22v1.69a.75.75 0 001.5 0v-3.5a.75.75 0 00-.75-.75h-3.5a.75.75 0 000 1.5h1.69L6.22 8.72z"/><path d="M3.5 6.75c0-.69.56-1.25 1.25-1.25H7A.75.75 0 007 4H4.75A2.75 2.75 0 002 6.75v4.5A2.75 2.75 0 004.75 14h4.5A2.75 2.75 0 0012 11.25V9a.75.75 0 00-1.5 0v2.25c0 .69-.56 1.25-1.25 1.25h-4.5c-.69 0-1.25-.56-1.25-1.25v-4.5z"/></svg>`;
  }

  return `
    <div class="timeline-card">
      <div class="timeline-card-header">
        <div class="timeline-card-title-group">
          <span class="tag ${badgeClass}">[${item.type.toUpperCase()}]</span>
          <a href="${hrefAttr}" ${clickAttr} class="timeline-item-title">${item.title}</a>
          ${externalIcon}
        </div>
        <span class="timeline-date">${item.date}</span>
      </div>
      <div class="timeline-summary">${item.summary || ''}</div>
      <div class="timeline-tags">${tagsHtml}</div>
    </div>`;
}

/* ════════════════════════════════════════════════════════════════
   PROJECTS
   ════════════════════════════════════════════════════════════════ */
async function loadProjects() {
  const grid = $('#projects-grid');
  if (!grid) return;

  try {
    const projects = await fetchJSON('data/projects.json');
    grid.innerHTML = projects.map(renderProjectCard).join('');
  } catch (e) {
    grid.innerHTML = errorState('projects', e);
  }
}

function renderProjectCard(p) {
  const primaryLang = p.language ? p.language.toLowerCase().split(/[\s,]+/)[0] : '';
  const langDot = p.language
    ? `<span class="lang-dot lang-${primaryLang}"></span>${p.language}`
    : '';

  const tags = (p.tags || []).map((t) => `<span class="tag tag-cyan">${t}</span>`).join('');

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
      </div>
    </div>`;
}

/* ════════════════════════════════════════════════════════════════
   WRITEUPS & IN-WEBSITE READER
   ════════════════════════════════════════════════════════════════ */
async function loadWriteups(slug) {
  if (slug) {
    await showWriteupReader(slug);
  } else {
    showWriteupsIndex();
    await loadWriteupsIndex();
  }
}

function showWriteupsIndex() {
  $('#writeups-index')?.classList.remove('hidden');
  $('#writeup-viewer')?.classList.add('hidden');
}

function showWriteupsViewer() {
  $('#writeups-index')?.classList.add('hidden');
  $('#writeup-viewer')?.classList.remove('hidden');
}

async function loadWriteupsIndex() {
  const list = $('#writeups-list');
  if (!list) return;

  try {
    const writeups = await fetchJSON('data/writeups.json');
    allWriteups = writeups;
    renderWriteupsList(allWriteups);
    setupWriteupsSearch();
  } catch (e) {
    list.innerHTML = errorState('writeups', e);
  }
}

function renderWriteupsList(writeups) {
  const list = $('#writeups-list');
  if (!list) return;

  if (!writeups.length) {
    list.innerHTML = '<p class="loading-state">No matching writeups found.</p>';
    return;
  }

  list.innerHTML = writeups.map((w) => {
    const tags = (w.tags || []).map((t) => `<span class="tag tag-purple">${t}</span>`).join('');
    const clickHandler = w.slug
      ? `onclick="navigate('writeups', '${w.slug}')"`
      : `href="${w.url}" target="_blank" rel="noopener"`;

    return `
      <div class="writeup-item-outer">
        <div class="writeup-date-tab" aria-label="Published date">
          <span class="date-icon">📅</span>
          <span class="date-text">${w.date}</span>
        </div>
        <div class="writeup-card" ${clickHandler} role="button" tabindex="0">
          <div class="writeup-header">
            <div class="writeup-title">${w.title}</div>
            <span class="writeup-read-btn">Read Article <span class="read-arrow">→</span></span>
          </div>
          <div class="writeup-meta">
            ${w.platform ? `<span class="meta-item"><span class="meta-icon">🎯</span> ${w.platform}</span>` : ''}
            ${w.readTime ? `<span class="meta-item"><span class="meta-icon">⏱️</span> ${w.readTime}</span>` : ''}
          </div>
          <div class="writeup-summary">${w.summary}</div>
          <div class="writeup-tags">${tags}</div>
        </div>
      </div>`;
  }).join('');
}

function setupWriteupsSearch() {
  const input = $('#writeupsSearch');
  if (!input || input.dataset.bound) return;
  input.dataset.bound = 'true';

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q) {
      renderWriteupsList(allWriteups);
      return;
    }
    const filtered = allWriteups.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        (w.summary || '').toLowerCase().includes(q) ||
        (w.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        (w.platform || '').toLowerCase().includes(q)
    );
    renderWriteupsList(filtered);
  });
}

async function showWriteupReader(slug) {
  showWriteupsViewer();
  const viewer = $('#writeup-content');
  if (!viewer) return;

  if (!allWriteups || !allWriteups.length) {
    try {
      allWriteups = await fetchJSON('data/writeups.json');
    } catch (_) {}
  }
  const writeupInfo = (allWriteups || []).find((item) => item.slug === slug);

  try {
    viewer.innerHTML = `<div class="loading-state"><span class="term-prompt">$ </span>loading article content<span class="typing-cursor">▌</span></div>`;
    const md = await fetchText(`content/writeups/${slug}.md`);

    let parsedHtml = '';
    // Configure marked
    if (typeof marked !== 'undefined') {
      const renderer = new marked.Renderer();
      marked.setOptions({
        renderer,
        gfm: true,
        breaks: true,
      });
      parsedHtml = marked.parse(md);
    } else {
      parsedHtml = `<pre>${md}</pre>`;
    }

    if (writeupInfo) {
      const headerHtml = `
        <div class="article-outer-header">
          <div class="writeup-date-tab" aria-label="Published date">
            <span class="date-icon">📅</span>
            <span class="date-text">${writeupInfo.date}</span>
          </div>
          <div class="article-meta-badges">
            ${writeupInfo.platform ? `<span class="meta-item"><span class="meta-icon">🎯</span> ${writeupInfo.platform}</span>` : ''}
            ${writeupInfo.readTime ? `<span class="meta-item"><span class="meta-icon">⏱️</span> ${writeupInfo.readTime}</span>` : ''}
          </div>
        </div>`;
      viewer.innerHTML = headerHtml + parsedHtml;
    } else {
      viewer.innerHTML = parsedHtml;
    }

    // Syntax highlighting
    if (typeof hljs !== 'undefined') {
      viewer.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }

    // Set title
    const h1 = viewer.querySelector('h1');
    if (h1) document.title = `${h1.textContent} · Toxkay Writeups`;

    // Generate Dynamic Table of Contents (Side Navigation)
    generateTableOfContents(viewer);
  } catch (e) {
    viewer.innerHTML = `
      <div class="loading-state" style="color:var(--red)">
        Failed to load writeup article: ${e.message}
      </div>`;
    $('#writeup-toc')?.classList.add('hidden');
  }
}

let tocObserver = null;

function generateTableOfContents(articleEl) {
  const tocNav = $('#toc-nav');
  const tocSidebar = $('#writeup-toc');
  if (!tocNav || !tocSidebar) return;

  tocNav.innerHTML = '';

  // Query all headings inside writeup (excluding the top article title H1)
  const allHeadings = [...articleEl.querySelectorAll('h1, h2, h3, h4')];
  const headings = allHeadings.filter((h, idx) => {
    if (idx === 0 && h.tagName.toLowerCase() === 'h1') return false;
    return true;
  });

  if (!headings.length) {
    tocSidebar.classList.add('hidden');
    return;
  }

  tocSidebar.classList.remove('hidden', 'pinned', 'force-closed');

  // Toggle pinned state when icon / header title is clicked
  const tocToggle = $('#toc-toggle');
  if (tocToggle && !tocToggle.dataset.bound) {
    tocToggle.dataset.bound = 'true';
    tocToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      tocSidebar.classList.remove('force-closed');
      tocSidebar.classList.toggle('pinned');
    });
  }

  // Remove force-closed state when mouse leaves sidebar
  if (!tocSidebar.dataset.bound) {
    tocSidebar.dataset.bound = 'true';
    tocSidebar.addEventListener('mouseleave', () => {
      tocSidebar.classList.remove('force-closed');
    });
  }

  const headingItems = [];

  headings.forEach((h, idx) => {
    if (!h.id) {
      const slugText = h.textContent
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      h.id = slugText || `sec-${idx + 1}`;
    }

    const isH3 = h.tagName.toLowerCase() === 'h3';
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.className = `toc-link ${isH3 ? 'h3' : 'h2'}`;
    a.textContent = h.textContent.trim();
    a.title = h.textContent.trim();

    a.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Auto-collapse sidebar upon clicking a section title
      tocSidebar.classList.remove('pinned');
      tocSidebar.classList.add('force-closed');
      if (document.activeElement) document.activeElement.blur();

      const target = document.getElementById(h.id);
      if (target) {
        const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;
        const targetTop = target.getBoundingClientRect().top + window.pageYOffset - navH - 24;
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
    });

    tocNav.appendChild(a);
    headingItems.push({ heading: h, link: a });
  });

  // Setup ScrollSpy
  if (tocObserver) tocObserver.disconnect();

  const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 64;
  tocObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        headingItems.forEach(({ heading, link }) => {
          if (heading === entry.target) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  }, {
    rootMargin: `-${navH + 10}px 0px -65% 0px`,
    threshold: 0
  });

  headings.forEach((h) => tocObserver.observe(h));
}

/* ── Back button in Writeups Viewer ─────────────────────────── */
function setupBackButton() {
  $('#writeups-back')?.addEventListener('click', () => {
    document.title = 'Toxkay | Offensive Security Engineer';
    navigate('writeups');
  });
}

/* ════════════════════════════════════════════════════════════════
   INTERACTIVE HERO TERMINAL CLI
   ════════════════════════════════════════════════════════════════ */
function setupHeroTerminal() {
  const form = $('#termForm');
  const input = $('#termInput');
  const history = $('#termHistory');

  if (!form || !input || !history) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const cmd = input.value.trim();
    if (!cmd) return;

    input.value = '';
    executeCliCommand(cmd, history);
  });
}

function executeCliCommand(cmd, historyEl) {
  const lower = cmd.toLowerCase();

  // Print command line
  const cmdLine = document.createElement('p');
  cmdLine.className = 'term-line';
  cmdLine.innerHTML = `<span class="term-prompt">$ </span><span class="term-cmd">${escapeHTML(cmd)}</span>`;
  historyEl.appendChild(cmdLine);

  const outputLine = document.createElement('div');
  outputLine.className = 'term-output-block';

  switch (lower) {
    case 'help':
      outputLine.innerHTML = `
        <div style="color:var(--cyan)">Available commands:</div>
        <div>  <span style="color:var(--accent)">archive</span>   — Jump to chronological research timeline</div>
        <div>  <span style="color:var(--accent)">projects</span>  — View open-source tools & exploits</div>
        <div>  <span style="color:var(--accent)">writeups</span>  — Read security writeups</div>
        <div>  <span style="color:var(--accent)">whoami</span>    — Print bio summary</div>
        <div>  <span style="color:var(--accent)">cv</span>        — Access Curriculum Vitae</div>
        <div>  <span style="color:var(--accent)">clear</span>     — Clear terminal history</div>
      `;
      break;

    case 'archive':
      navigate('archive');
      outputLine.textContent = 'Navigating to #archive...';
      break;

    case 'projects':
      navigate('projects');
      outputLine.textContent = 'Navigating to #projects...';
      break;

    case 'writeups':
      navigate('writeups');
      outputLine.textContent = 'Navigating to #writeups...';
      break;

    case 'whoami':
      outputLine.innerHTML = 'toxkay — Offensive Security Engineer, Red Teamer, Bug Hunter';
      break;

    case 'cv':
      outputLine.innerHTML = 'CV Download available: <a href="assets/cv/Toxkay-CV.pdf?v=2" download style="color:var(--accent)">Toxkay-CV.pdf</a>';
      break;

    case 'clear':
      historyEl.innerHTML = '';
      return;

    default:
      outputLine.innerHTML = `<span style="color:var(--red)">zsh: command not found: ${escapeHTML(cmd)}</span>. Type <span style="color:var(--accent)">help</span> for available commands.`;
      break;
  }

  historyEl.appendChild(outputLine);

  const termBody = $('#termBody');
  if (termBody) termBody.scrollTop = termBody.scrollHeight;
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

/* ════════════════════════════════════════════════════════════════
   MISC HELPERS
   ════════════════════════════════════════════════════════════════ */
function errorState(name, err) {
  return `
    <div style="color:var(--red);font-family:var(--font-mono);font-size:.875rem;padding:1rem 0">
      Failed to load ${name}: ${err.message}
    </div>`;
}

function setupNavbar() {
  const toggle = $('#navToggle');
  const links  = $('#navLinks');

  toggle?.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });

  $$('.nav-link').forEach((a) =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );

  const navbar = $('#navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
}

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
  setupHeroTerminal();
  setFooterYear();

  window.addEventListener('hashchange', render);
  window.addEventListener('popstate', render);

  render();
});
