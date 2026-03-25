/**
 * Maurseth Gallery — Static site builder
 *
 * Reads CMS content from content/ and generates a complete static site
 * with parallax hero, Elina Voss hover effects on gallery, and full
 * Danish-language artist portfolio.
 */

import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = import.meta.dirname ?? dirname(new URL(import.meta.url).pathname);
const BASE = (process.env.BASE_PATH ?? '').replace(/\/+$/, '');
const DIST = join(ROOT, process.env.BUILD_OUT_DIR ?? 'dist');
const CONTENT = join(ROOT, 'content');
const MEDIA_SRC = join(ROOT, 'public', 'uploads');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Doc<T = Record<string, any>> {
  slug: string;
  status: string;
  data: T;
  id: string;
}

interface Globals {
  siteName: string;
  artistName: string;
  artistTitle: string;
  email: string;
  phone: string;
  studioAddress: string;
  postAddress: string;
  instagramUrl: string;
  facebookUrl: string;
  heroImage: string;
  logoImage: string;
  footerText: string;
  metaDescription: string;
}

interface GalleryItem {
  title: string;
  medium: string;
  dimensions: string;
  year: number;
  image: string;
  sold: boolean;
  category: string;
  sortOrder: number;
}

interface Exhibition {
  title: string;
  year: number;
  venue: string;
  location: string;
  description: string;
  featuredImage: string;
  startDate: string;
  endDate: string;
  category: string;
}

interface Post {
  title: string;
  date: string;
  excerpt: string;
  content: string;
  featuredImage: string;
  category: string;
  tags: string[];
}

interface PageData {
  title: string;
  metaDescription: string;
  sections: Section[];
}

interface Section {
  _block: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string) { mkdirSync(dir, { recursive: true }); }

function writeFile(filePath: string, content: string) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, 'utf-8');
  console.log(`  ${filePath.replace(ROOT + '/', '')}`);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function loadCollection<T>(name: string): Doc<T>[] {
  const dir = join(CONTENT, name);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Doc<T>)
    .filter(d => d.status === 'published');
}

function loadGlobals(): Globals {
  const site = JSON.parse(readFileSync(join(CONTENT, 'globals', 'site.json'), 'utf-8'));
  return site.data;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('da-DK', { year: 'numeric', month: 'long', day: 'numeric' });
}

function markdownToHtml(md: string): string {
  if (!md) return '';
  let html = md;

  html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/(?:^- .+\n?)+/gm, (match) => {
    const items = match.trim().split('\n').map(l => `<li>${l.replace(/^- /, '')}</li>`).join('\n');
    return `<ul>\n${items}\n</ul>\n`;
  });

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const imgSrc = src.startsWith('/uploads/') ? `${BASE}${src}` : src.startsWith('uploads/') ? `${BASE}/${src}` : src;
    return `<img src="${esc(imgSrc)}" alt="${esc(alt)}" loading="lazy" />`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  const lines = html.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { result.push(''); continue; }
    if (/^<(h[1-4]|ul|ol|li|blockquote|\/ul|\/ol|\/blockquote|img|figure|figcaption)/.test(trimmed)) {
      result.push(trimmed);
    } else {
      result.push(`<p>${trimmed}</p>`);
    }
  }
  return result.filter((l, i, a) => !(l === '' && (i === 0 || i === a.length - 1 || a[i - 1] === ''))).join('\n');
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const CSS = `
:root {
  --bg: #faf8f5;
  --bg-dark: #1a1714;
  --text: #1a1714;
  --text-light: #f5f0eb;
  --muted: #8a8078;
  --accent: #b8860b;
  --accent-light: #d4a843;
  --border: rgba(26, 23, 20, 0.1);
  --border-light: rgba(245, 240, 235, 0.15);
  --serif: 'Cormorant Garamond', 'Georgia', serif;
  --sans: 'Inter', system-ui, sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--sans); background: var(--bg); color: var(--text);
  line-height: 1.7; -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration: none; }
img { max-width: 100%; display: block; }

/* ---- Nav ---- */
.nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: rgba(250, 248, 245, 0.9);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
}
.nav-inner {
  max-width: 1200px; margin: 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 2rem;
}
.nav-logo {
  font-family: var(--serif); font-size: 1.5rem; font-weight: 600;
  letter-spacing: 0.02em; color: var(--text);
}
.nav-logo span { font-weight: 300; color: var(--muted); font-size: 0.9rem; margin-left: 0.5rem; }
.nav-links { display: flex; gap: 1.75rem; list-style: none; }
.nav-links a {
  color: var(--muted); font-size: 0.8125rem; font-weight: 500;
  letter-spacing: 0.04em; text-transform: uppercase;
  transition: color 0.3s; padding: 0.25rem 0;
  border-bottom: 2px solid transparent;
}
.nav-links a:hover, .nav-links a.active {
  color: var(--text); border-bottom-color: var(--accent);
}

/* Nav dropdown */
.nav-dropdown { position: relative; }
.nav-dropdown > a::after { content: ' \\25BE'; font-size: 0.65em; }
.nav-dropdown-menu {
  display: none; position: absolute; top: 100%; left: -0.75rem;
  padding-top: 0.5rem;
  z-index: 110;
}
.nav-dropdown-menu-inner {
  background: rgba(250,248,245,0.97); backdrop-filter: blur(12px);
  border: 1px solid var(--border); border-radius: 6px;
  padding: 0.5rem 0; min-width: 160px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}
.nav-dropdown:hover .nav-dropdown-menu { display: block; }
.nav-dropdown-menu-inner a {
  display: block; padding: 0.5rem 1.25rem; font-size: 0.8125rem;
  color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em;
  border-bottom: none !important;
}
.nav-dropdown-menu-inner a:hover { color: var(--text); background: rgba(0,0,0,0.03); }

/* Gallery filters */
.gallery-filters {
  display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 2rem; align-items: center;
}
.gallery-tab {
  padding: 0.4rem 1rem; font-size: 0.8rem; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--muted); border: 1px solid var(--border);
  border-radius: 3px; cursor: pointer; background: transparent; transition: 0.2s;
  text-decoration: none; display: inline-block;
}
.gallery-tab:hover { color: var(--text); border-color: var(--text); }
.gallery-tab.active { color: var(--accent); border-color: var(--accent); background: rgba(184,134,11,0.05); }
/* Year filter — custom dropdown (no native select) */
.year-dropdown { position: relative; margin-left: auto; }
.year-dropdown-toggle {
  padding: 0.4rem 1rem; font-size: 0.8rem; letter-spacing: 0.06em;
  text-transform: uppercase; border: 1px solid var(--border); border-radius: 3px;
  background: transparent; color: var(--text); font-family: var(--sans);
  cursor: pointer; display: flex; align-items: center; gap: 0.5rem;
}
.year-dropdown-toggle::after { content: '\\25BE'; font-size: 0.65em; color: var(--muted); }
.year-dropdown-toggle.active { color: var(--accent); border-color: var(--accent); }
.year-dropdown-menu {
  display: none; position: absolute; top: 100%; right: 0;
  padding-top: 0.4rem; z-index: 50;
}
.year-dropdown.open .year-dropdown-menu { display: block; }
.year-dropdown-menu-inner {
  background: var(--bg); border: 1px solid var(--border); border-radius: 6px;
  padding: 0.4rem 0; min-width: 130px; max-height: 280px; overflow-y: auto;
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}
.year-dropdown-menu-inner button {
  display: block; width: 100%; text-align: left;
  padding: 0.45rem 1rem; font-size: 0.8rem; letter-spacing: 0.04em;
  font-family: var(--sans); color: var(--muted); background: none; border: none;
  cursor: pointer; transition: 0.15s;
}
.year-dropdown-menu-inner button:hover { color: var(--text); background: rgba(0,0,0,0.03); }
.year-dropdown-menu-inner button.active { color: var(--accent); font-weight: 500; }

/* Load more */
.load-more-btn {
  display: block; margin: 3rem auto 0; padding: 0.75rem 2.5rem;
  font-size: 0.85rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--accent); border: 1px solid var(--accent); border-radius: 3px;
  background: transparent; cursor: pointer; transition: 0.2s; font-family: var(--sans);
}
.load-more-btn:hover { background: var(--accent); color: #fff; }

.nav-hamburger {
  display: none; background: none; border: none; cursor: pointer;
  width: 28px; height: 20px; position: relative;
}
.nav-hamburger span {
  display: block; width: 100%; height: 2px; background: var(--text);
  position: absolute; left: 0; transition: 0.3s;
}
.nav-hamburger span:nth-child(1) { top: 0; }
.nav-hamburger span:nth-child(2) { top: 9px; }
.nav-hamburger span:nth-child(3) { top: 18px; }

/* ---- Hero / Parallax ---- */
.hero {
  position: relative; height: 85vh; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  margin-top: 60px;
}
.hero-bg {
  position: absolute; inset: -15% 0; height: 130%;
  object-fit: cover; width: 100%;
  will-change: transform;
}
.hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(26,23,20,0.2) 0%, rgba(26,23,20,0.6) 100%);
}
.hero-content {
  position: relative; z-index: 2; text-align: center; color: var(--text-light);
}
.hero-content h1 {
  font-family: var(--serif); font-size: 4rem; font-weight: 300;
  letter-spacing: 0.04em; line-height: 1.15;
}
.hero-content p {
  font-size: 1rem; font-weight: 400; letter-spacing: 0.18em;
  text-transform: uppercase; margin-top: 1rem; color: rgba(245,240,235,0.75);
}

/* ---- Gallery Grid (Elina Voss pattern) ---- */
.gallery-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
}
.gallery-item {
  position: relative; overflow: hidden; aspect-ratio: 1/1;
  cursor: pointer; display: block;
}
.gallery-item img {
  width: 100%; height: 100%; object-fit: cover;
  transition: transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.6s;
}
.gallery-item:hover img {
  transform: scale(1.05); filter: brightness(0.5);
}
.gallery-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.5s; padding: 1rem;
}
.gallery-item:hover .gallery-overlay { opacity: 1; }
.gallery-overlay h3 {
  font-family: var(--serif); font-size: 1.25rem; font-weight: 400;
  letter-spacing: 0.06em; color: #fff; text-align: center;
}
.gallery-overlay .meta {
  font-size: 0.7rem; font-weight: 400; letter-spacing: 0.1em;
  text-transform: uppercase; color: rgba(255,255,255,0.6); margin-top: 0.4rem;
}

/* ---- Section layout ---- */
.section { max-width: 1200px; margin: 0 auto; padding: 5rem 2rem; }
.section-narrow { max-width: 800px; margin: 0 auto; padding: 4rem 2rem; }
.section-heading {
  font-family: var(--serif); font-size: 2.5rem; font-weight: 300;
  letter-spacing: 0.02em; margin-bottom: 2rem;
}
.section-divider {
  width: 60px; height: 1px; background: var(--accent); margin-bottom: 3rem;
}

/* ---- Prose (richtext) ---- */
.prose { font-size: 1.0625rem; line-height: 1.9; color: var(--text); }
.prose p { margin-bottom: 1.5em; }
.prose h2 { font-family: var(--serif); font-size: 1.75rem; font-weight: 400; margin-top: 2.5em; margin-bottom: 0.75em; }
.prose h3 { font-family: var(--serif); font-size: 1.35rem; font-weight: 400; margin-top: 2em; margin-bottom: 0.5em; }
.prose h4 { font-size: 1.1rem; font-weight: 600; margin-top: 1.5em; margin-bottom: 0.5em; }
.prose ul { list-style: disc; padding-left: 1.5em; margin-bottom: 1.5em; }
.prose li { margin-bottom: 0.4em; }
.prose blockquote { border-left: 3px solid var(--accent); padding: 0.75em 1.25em; margin: 1.5em 0; font-style: italic; color: var(--muted); }
.prose a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
.prose img { border-radius: 4px; margin: 1.5em 0; }

/* ---- Profile ---- */
.profile-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: start;
}
.profile-grid img {
  width: 100%; border-radius: 4px; object-fit: cover; aspect-ratio: 3/4;
}

/* ---- Exhibition list ---- */
.exhibition-year-heading { font-family: var(--serif); font-size: 2rem; font-weight: 300; margin-top: 3.5rem; margin-bottom: 1.5rem; color: var(--accent); padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
.exhibition-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; }
.exhibition-card {
  display: block; text-decoration: none; color: inherit;
  border: 1px solid var(--border); border-radius: 6px; overflow: hidden;
  transition: box-shadow 0.3s, transform 0.3s;
}
.exhibition-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.08); transform: translateY(-2px); }
.exhibition-card-img {
  width: 100%; aspect-ratio: 16/10; object-fit: cover; display: block;
  background: #f0ede8;
}
.exhibition-card-body { padding: 1.25rem; }
.exhibition-card-body h3 { font-family: var(--serif); font-size: 1.1rem; font-weight: 400; line-height: 1.4; margin-bottom: 0.4rem; }
.exhibition-card-body .ex-meta { font-size: 0.8rem; color: var(--muted); }
.exhibition-card-body .ex-excerpt { font-size: 0.875rem; color: var(--muted); margin-top: 0.5rem; line-height: 1.6; }

/* Exhibition detail */
.ex-detail-hero { width: 100%; max-height: 500px; object-fit: cover; display: block; }
.ex-detail-header { max-width: 800px; margin: 0 auto; padding: 3rem 2rem 1rem; }
.ex-detail-header h1 { font-family: var(--serif); font-size: 2.5rem; font-weight: 300; line-height: 1.2; }
.ex-detail-meta { display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 1rem; font-size: 0.85rem; color: var(--muted); }
.ex-detail-meta span { display: flex; align-items: center; gap: 0.3rem; }

/* Recent exhibitions grid */
.recent-exhibitions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.recent-ex-card { display: block; text-decoration: none; color: inherit; }
.recent-ex-card img { width: 100%; aspect-ratio: 3/2; object-fit: cover; border-radius: 4px; transition: opacity 0.3s; }
.recent-ex-card:hover img { opacity: 0.8; }
.recent-ex-card h4 { font-size: 0.85rem; font-weight: 500; margin-top: 0.5rem; line-height: 1.4; }
.recent-ex-card .ex-meta { font-size: 0.75rem; color: var(--muted); }

@media (max-width: 768px) {
  .exhibition-cards { grid-template-columns: 1fr; }
  .recent-exhibitions { grid-template-columns: repeat(2, 1fr); }
}

/* ---- Posts ---- */
.post-card {
  display: grid; grid-template-columns: 200px 1fr; gap: 1.5rem;
  padding: 1.5rem 0; border-bottom: 1px solid var(--border);
  align-items: start;
}
.post-card img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 4px; }
.post-card h3 { font-family: var(--serif); font-size: 1.25rem; font-weight: 400; margin-bottom: 0.5rem; }
.post-card .date { font-size: 0.8rem; color: var(--muted); margin-bottom: 0.5rem; }
.post-card .excerpt { font-size: 0.9rem; color: var(--muted); line-height: 1.6; }
.post-card:hover h3 { color: var(--accent); }

/* ---- Contact ---- */
.contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; }
.contact-block h3 { font-family: var(--serif); font-size: 1.25rem; margin-bottom: 0.75rem; }
.contact-block p { color: var(--muted); line-height: 1.8; }
.contact-block a { color: var(--accent); }

/* ---- Footer ---- */
.footer {
  background: var(--bg-dark); color: var(--text-light); padding: 3rem 2rem;
  text-align: center; font-size: 0.85rem;
}
.footer a { color: var(--accent-light); }
.footer .social { display: flex; justify-content: center; gap: 1.5rem; margin-bottom: 1rem; }

/* ---- Responsive ---- */
@media (max-width: 768px) {
  .nav-links { display: none; }
  .nav-hamburger { display: block; }
  .hero-content h1 { font-size: 2.5rem; }
  .gallery-grid { grid-template-columns: repeat(2, 1fr); }
  .profile-grid { grid-template-columns: 1fr; }
  .post-card { grid-template-columns: 1fr; }
  .contact-grid { grid-template-columns: 1fr; }
  .section { padding: 3rem 1.25rem; }
}
@media (max-width: 480px) {
  .gallery-grid { grid-template-columns: 1fr; }
  .hero { height: 60vh; }
}
`;

// ---------------------------------------------------------------------------
// Shared HTML fragments
// ---------------------------------------------------------------------------

function head(title: string, globals: Globals, description?: string): string {
  const desc = description || globals.metaDescription;
  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)} — ${esc(globals.artistName)}</title>
  ${desc ? `<meta name="description" content="${esc(desc)}" />` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <style>${CSS}</style>
</head>`;
}

function nav(globals: Globals, active?: string): string {
  return `
<nav class="nav">
  <div class="nav-inner">
    <a href="${BASE}/" class="nav-logo">${esc(globals.artistName)}<span>${esc(globals.artistTitle)}</span></a>
    <div class="nav-links">
      <a href="${BASE}/" class="${active === 'forside' ? 'active' : ''}">Forside</a>
      <div class="nav-dropdown">
        <a href="${BASE}/galleri/" class="${active === 'galleri' ? 'active' : ''}">Galleri</a>
        <div class="nav-dropdown-menu"><div class="nav-dropdown-menu-inner">
          <a href="${BASE}/galleri/vaerker/">Værker</a>
          <a href="${BASE}/galleri/grafik/">Grafik</a>
          <a href="${BASE}/galleri/collager/">Collager</a>
        </div></div>
      </div>
      <a href="${BASE}/udstillinger/" class="${active === 'udstillinger' ? 'active' : ''}">Udstillinger</a>
      <a href="${BASE}/profil/" class="${active === 'profil' ? 'active' : ''}">Profil</a>
      <a href="${BASE}/nyheder/" class="${active === 'nyheder' ? 'active' : ''}">Nyheder</a>
      <a href="${BASE}/kontakt/" class="${active === 'kontakt' ? 'active' : ''}">Kontakt</a>
    </div>
    <button class="nav-hamburger" onclick="document.querySelector('.nav-links').style.display=document.querySelector('.nav-links').style.display==='flex'?'none':'flex'" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>`;
}

function footer(globals: Globals): string {
  return `
<footer class="footer">
  <div class="social">
    ${globals.instagramUrl ? `<a href="${esc(globals.instagramUrl)}" target="_blank" rel="noopener">Instagram</a>` : ''}
    ${globals.facebookUrl ? `<a href="${esc(globals.facebookUrl)}" target="_blank" rel="noopener">Facebook</a>` : ''}
    ${globals.email ? `<a href="mailto:${esc(globals.email)}">${esc(globals.email)}</a>` : ''}
  </div>
  <p>${esc(globals.footerText)}</p>
</footer>`;
}

// ---------------------------------------------------------------------------
// Block renderers
// ---------------------------------------------------------------------------

function renderHero(block: Section, globals: Globals): string {
  const img = block.image || globals.heroImage;
  const imgSrc = img ? (img.startsWith('http') ? img : `${BASE}/${img}`) : '';
  return `
<section class="hero">
  ${imgSrc ? `<img class="hero-bg" src="${esc(imgSrc)}" alt="" id="parallax-hero" />` : ''}
  <div class="hero-overlay"></div>
  <div class="hero-content">
    <h1>${esc(block.title || globals.artistName)}</h1>
    ${block.subtitle ? `<p>${esc(block.subtitle)}</p>` : ''}
  </div>
</section>
<script>
(function(){
  var hero = document.getElementById('parallax-hero');
  if (!hero) return;
  window.addEventListener('scroll', function() {
    hero.style.transform = 'translateY(' + (window.scrollY * 0.35) + 'px)';
  }, { passive: true });
})();
</script>`;
}

function renderTextSection(block: Section): string {
  return `
<section class="section-narrow">
  ${block.heading ? `<h2 class="section-heading">${esc(block.heading)}</h2><div class="section-divider"></div>` : ''}
  <div class="prose">${markdownToHtml(block.content || '')}</div>
</section>`;
}

function renderProfile(block: Section): string {
  const imgSrc = block.portraitImage ? (block.portraitImage.startsWith('http') ? block.portraitImage : `${BASE}/${block.portraitImage}`) : '';
  return `
<section class="section">
  ${block.heading ? `<h2 class="section-heading">${esc(block.heading)}</h2><div class="section-divider"></div>` : ''}
  <div class="profile-grid">
    <div class="prose">${markdownToHtml(block.bio || '')}</div>
    ${imgSrc ? `<img src="${esc(imgSrc)}" alt="${esc(block.heading || '')}" loading="lazy" />` : ''}
  </div>
</section>`;
}

function renderContactInfo(block: Section): string {
  return `
<section class="section">
  ${block.heading ? `<h2 class="section-heading">${esc(block.heading)}</h2><div class="section-divider"></div>` : ''}
  <div class="contact-grid">
    <div class="contact-block">
      <h3>Atelier</h3>
      <p>${(block.address || '').replace(/\n/g, '<br>')}</p>
    </div>
    <div class="contact-block">
      <h3>Kontakt</h3>
      ${block.email ? `<p><a href="mailto:${esc(block.email)}">${esc(block.email)}</a></p>` : ''}
      ${block.phone ? `<p><a href="tel:${esc(block.phone)}">${esc(block.phone)}</a></p>` : ''}
    </div>
  </div>
</section>`;
}

function renderArtworkGrid(block: Section, gallery: Doc<GalleryItem>[]): string {
  let items = gallery;
  if (block.category && block.category !== 'all') {
    items = items.filter(g => g.data.category === block.category);
  }
  items.sort((a, b) => (a.data.sortOrder || 0) - (b.data.sortOrder || 0));
  if (block.maxItems && block.maxItems > 0) {
    items = items.slice(0, block.maxItems);
  }

  const cards = items.map(g => {
    const imgSrc = g.data.image ? `${BASE}/${g.data.image}` : '';
    const meta = [g.data.medium, g.data.dimensions].filter(Boolean).join(' · ');
    return `
    <a class="gallery-item" href="${BASE}/galleri/${g.slug}/">
      ${imgSrc ? `<img src="${esc(imgSrc)}" alt="${esc(g.data.title)}" loading="lazy" />` : ''}
      <div class="gallery-overlay">
        <h3>${esc(g.data.title)}</h3>
        ${meta ? `<span class="meta">${esc(meta)}</span>` : ''}
      </div>
    </a>`;
  }).join('\n');

  return `
<section class="section">
  ${block.heading ? `<h2 class="section-heading">${esc(block.heading)}</h2><div class="section-divider"></div>` : ''}
  <div class="gallery-grid">
    ${cards}
  </div>
</section>`;
}

function renderExhibitionList(block: Section, exhibitions: Doc<Exhibition>[]): string {
  let items = [...exhibitions];

  // Filter by years if specified
  if (block.showYears) {
    const years = block.showYears.split(',').map((y: string) => parseInt(y.trim())).filter((y: number) => !isNaN(y));
    if (years.length > 0) {
      items = items.filter(e => years.includes(e.data.year));
    }
  }

  // Group by year, sorted descending
  const byYear = new Map<number, Doc<Exhibition>[]>();
  for (const ex of items) {
    const y = ex.data.year || 0;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(ex);
  }
  const sortedYears = [...byYear.keys()].sort((a, b) => b - a);

  const html = sortedYears.map(year => {
    const exs = byYear.get(year)!;
    const cards = exs.map(e => {
      const img = e.data.featuredImage;
      const imgSrc = img ? (img.startsWith('http') ? img : `${BASE}/${img}`) : '';
      // Extract first ~100 chars of description as excerpt
      const rawExcerpt = (e.data.description || '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*_\[\]]/g, '').trim();
      const excerpt = rawExcerpt.slice(0, 120) + (rawExcerpt.length > 120 ? '…' : '');
      const venue = [e.data.venue, e.data.location].filter(Boolean).join(', ');
      return `
      <a class="exhibition-card" href="${BASE}/udstillinger/${e.slug}/">
        ${imgSrc ? `<img class="exhibition-card-img" src="${esc(imgSrc)}" alt="${esc(e.data.title)}" loading="lazy" />` : ''}
        <div class="exhibition-card-body">
          <h3>${esc(e.data.title)}</h3>
          <div class="ex-meta">${year}${venue ? ` · ${esc(venue)}` : ''}</div>
          ${excerpt ? `<p class="ex-excerpt">${esc(excerpt)}</p>` : ''}
        </div>
      </a>`;
    }).join('\n');
    return `<h3 class="exhibition-year-heading">${year || 'Ukendt år'}</h3>\n<div class="exhibition-cards">${cards}</div>`;
  }).join('\n');

  return `
<section class="section">
  ${block.heading ? `<h2 class="section-heading">${esc(block.heading)}</h2><div class="section-divider"></div>` : ''}
  ${html}
</section>`;
}

function renderCvSection(block: Section): string {
  return `
<section class="section-narrow">
  ${block.heading ? `<h2 class="section-heading">${esc(block.heading)}</h2><div class="section-divider"></div>` : ''}
  <div class="prose">${markdownToHtml(block.content || '')}</div>
</section>`;
}

function renderImageGallery(block: Section): string {
  const images: Array<{url: string; alt: string}> = block.images || [];
  const cards = images.map(img => `
    <div class="gallery-item">
      <img src="${esc(img.url.startsWith('http') ? img.url : `${BASE}/${img.url}`)}" alt="${esc(img.alt || '')}" loading="lazy" />
    </div>`).join('\n');

  return `
<section class="section">
  ${block.heading ? `<h2 class="section-heading">${esc(block.heading)}</h2><div class="section-divider"></div>` : ''}
  <div class="gallery-grid">${cards}</div>
</section>`;
}

// ---------------------------------------------------------------------------
// Block dispatcher
// ---------------------------------------------------------------------------

function renderSections(sections: Section[], globals: Globals, gallery: Doc<GalleryItem>[], exhibitions: Doc<Exhibition>[]): string {
  return sections.map(s => {
    switch (s._block) {
      case 'hero': return renderHero(s, globals);
      case 'text-section': return renderTextSection(s);
      case 'profile': return renderProfile(s);
      case 'contact-info': return renderContactInfo(s);
      case 'artwork-grid': return renderArtworkGrid(s, gallery);
      case 'exhibition-list': return renderExhibitionList(s, exhibitions);
      case 'cv-section': return renderCvSection(s);
      case 'image-gallery': return renderImageGallery(s);
      default:
        console.warn(`  ⚠ Unknown block: ${s._block}`);
        return '';
    }
  }).join('\n');
}

// ---------------------------------------------------------------------------
// Page builders
// ---------------------------------------------------------------------------

function buildPage(page: Doc<PageData>, globals: Globals, gallery: Doc<GalleryItem>[], exhibitions: Doc<Exhibition>[], active?: string): string {
  const sections = page.data.sections || [];
  return `${head(page.data.title, globals, page.data.metaDescription)}
<body>
  ${nav(globals, active)}
  ${renderSections(sections, globals, gallery, exhibitions)}
  ${footer(globals)}
</body>
</html>`;
}

function buildExhibitionDetail(ex: Doc<Exhibition>, globals: Globals, allExhibitions: Doc<Exhibition>[]): string {
  const d = ex.data;
  const imgSrc = d.featuredImage ? (d.featuredImage.startsWith('http') ? d.featuredImage : `${BASE}/${d.featuredImage}`) : '';

  // Recent exhibitions (6, excluding current)
  const recent = allExhibitions
    .filter(e => e.slug !== ex.slug && e.data.featuredImage)
    .sort((a, b) => (b.data.year || 0) - (a.data.year || 0))
    .slice(0, 6);

  const recentHtml = recent.length > 0 ? `
  <section class="section">
    <h2 class="section-heading">Seneste udstillinger</h2>
    <div class="section-divider"></div>
    <div class="recent-exhibitions">
      ${recent.map(r => {
        const rImg = r.data.featuredImage ? (r.data.featuredImage.startsWith('http') ? r.data.featuredImage : `${BASE}/${r.data.featuredImage}`) : '';
        return `
      <a class="recent-ex-card" href="${BASE}/udstillinger/${r.slug}/">
        ${rImg ? `<img src="${esc(rImg)}" alt="${esc(r.data.title)}" loading="lazy" />` : ''}
        <h4>${esc(r.data.title)}</h4>
        <span class="ex-meta">${r.data.year || ''}</span>
      </a>`;
      }).join('\n')}
    </div>
  </section>` : '';

  return `${head(d.title, globals)}
<body>
  ${nav(globals, 'udstillinger')}
  <div style="margin-top:60px;">
    ${imgSrc ? `<img class="ex-detail-hero" src="${esc(imgSrc)}" alt="${esc(d.title)}" />` : ''}
  </div>
  <div class="ex-detail-header">
    <h1>${esc(d.title)}</h1>
    <div class="ex-detail-meta">
      ${d.year ? `<span>${d.year}</span>` : ''}
      ${d.venue ? `<span>${esc(d.venue)}</span>` : ''}
      ${d.location ? `<span>${esc(d.location)}</span>` : ''}
      ${d.startDate ? `<span>${formatDate(d.startDate)}</span>` : ''}
    </div>
  </div>
  ${d.description ? `<div class="section-narrow"><div class="prose">${markdownToHtml(d.description)}</div></div>` : ''}
  ${recentHtml}
  <div class="section-narrow" style="padding-top:0;">
    <a href="${BASE}/udstillinger/" style="color:var(--accent);">&larr; Alle udstillinger</a>
  </div>
  ${footer(globals)}
</body>
</html>`;
}

function buildExhibitionsIndex(exhibitions: Doc<Exhibition>[], globals: Globals): string {
  const sorted = [...exhibitions].sort((a, b) => (b.data.year || 0) - (a.data.year || 0));

  // Group by year
  const byYear = new Map<number, Doc<Exhibition>[]>();
  for (const ex of sorted) {
    const y = ex.data.year || 0;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(ex);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  const html = years.map(year => {
    const exs = byYear.get(year)!;
    const cards = exs.map(e => {
      const img = e.data.featuredImage;
      const imgSrc = img ? (img.startsWith('http') ? img : `${BASE}/${img}`) : '';
      const rawExcerpt = (e.data.description || '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/[#*_\[\]]/g, '').trim();
      const excerpt = rawExcerpt.slice(0, 120) + (rawExcerpt.length > 120 ? '…' : '');
      const venue = [e.data.venue, e.data.location].filter(Boolean).join(', ');
      return `
      <a class="exhibition-card" href="${BASE}/udstillinger/${e.slug}/">
        ${imgSrc ? `<img class="exhibition-card-img" src="${esc(imgSrc)}" alt="${esc(e.data.title)}" loading="lazy" />` : ''}
        <div class="exhibition-card-body">
          <h3>${esc(e.data.title)}</h3>
          <div class="ex-meta">${year}${venue ? ` · ${esc(venue)}` : ''}</div>
          ${excerpt ? `<p class="ex-excerpt">${esc(excerpt)}</p>` : ''}
        </div>
      </a>`;
    }).join('\n');
    return `<h3 class="exhibition-year-heading">${year || 'Ukendt år'}</h3>\n<div class="exhibition-cards">${cards}</div>`;
  }).join('\n');

  const yearButtons = years.map(y => `<button onclick="filterExYear('${y}',this)">${y}</button>`).join('\n          ');

  return `${head('Udstillinger', globals)}
<body>
  ${nav(globals, 'udstillinger')}
  <div class="section" style="margin-top:60px;">
    <h1 class="section-heading">Udstillinger</h1>
    <div class="gallery-filters">
      <div class="year-dropdown" id="exYearDropdown">
        <button class="year-dropdown-toggle" id="exYearToggle" onclick="toggleExYearDropdown()">Alle år</button>
        <div class="year-dropdown-menu"><div class="year-dropdown-menu-inner">
          <button class="active" onclick="filterExYear('all',this)">Alle år</button>
          ${yearButtons}
        </div></div>
      </div>
    </div>
    <div id="exContent">
    ${html}
    </div>
  </div>
  ${footer(globals)}
  <script>
  (function(){
    var sections = document.querySelectorAll('#exContent > h3, #exContent > .exhibition-cards');
    window.toggleExYearDropdown = function() {
      document.getElementById('exYearDropdown').classList.toggle('open');
    };
    window.filterExYear = function(year, el) {
      var toggle = document.getElementById('exYearToggle');
      toggle.textContent = year === 'all' ? 'Alle år' : year;
      toggle.className = 'year-dropdown-toggle' + (year !== 'all' ? ' active' : '');
      document.getElementById('exYearDropdown').classList.remove('open');
      document.getElementById('exYearDropdown').querySelectorAll('.year-dropdown-menu-inner button').forEach(function(b){b.classList.remove('active');});
      el.classList.add('active');
      sections.forEach(function(s) {
        if (year === 'all') { s.style.display = ''; return; }
        if (s.tagName === 'H3') {
          s.style.display = s.textContent.trim() === year ? '' : 'none';
        } else {
          var prev = s.previousElementSibling;
          s.style.display = (prev && prev.textContent.trim() === year) ? '' : 'none';
        }
      });
    };
    document.addEventListener('click', function(e) {
      var dd = document.getElementById('exYearDropdown');
      if (dd && !dd.contains(e.target)) dd.classList.remove('open');
    });
  })();
  </script>
</body>
</html>`;
}

function buildGalleryDetail(item: Doc<GalleryItem>, globals: Globals): string {
  const d = item.data;
  const imgSrc = d.image ? `${BASE}/${d.image}` : '';
  const meta = [d.medium, d.dimensions, d.year ? String(d.year) : ''].filter(Boolean).join(' · ');

  return `${head(d.title, globals)}
<body>
  ${nav(globals, 'galleri')}
  <div style="margin-top: 60px;">
    ${imgSrc ? `<img src="${esc(imgSrc)}" alt="${esc(d.title)}" style="width:100%;max-height:85vh;object-fit:contain;background:#f0ede8;padding:2rem;" />` : ''}
  </div>
  <div class="section-narrow" style="padding-top:3rem;">
    <h1 class="section-heading">${esc(d.title)}</h1>
    ${meta ? `<p style="color:var(--muted);font-size:0.9rem;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:1rem;">${esc(meta)}</p>` : ''}
    ${d.sold ? '<p style="color:var(--accent);font-weight:500;">Solgt</p>' : ''}
    <p style="margin-top:2rem;"><a href="${BASE}/galleri/" style="color:var(--accent);">&larr; Tilbage til galleriet</a></p>
  </div>
  ${footer(globals)}
</body>
</html>`;
}

function buildPostPage(post: Doc<Post>, globals: Globals): string {
  const d = post.data;
  const imgSrc = d.featuredImage ? (d.featuredImage.startsWith('http') ? d.featuredImage : `${BASE}/${d.featuredImage}`) : '';

  return `${head(d.title, globals, d.excerpt)}
<body>
  ${nav(globals, 'nyheder')}
  <article style="margin-top:60px;">
    ${imgSrc ? `<img src="${esc(imgSrc)}" alt="" style="width:100%;max-height:420px;object-fit:cover;" />` : ''}
    <div class="section-narrow" style="padding-top:3rem;">
      <h1 class="section-heading">${esc(d.title)}</h1>
      ${d.date ? `<p style="color:var(--muted);font-size:0.875rem;margin-bottom:2rem;">${formatDate(d.date)}</p>` : ''}
      <div class="prose">${markdownToHtml(d.content)}</div>
      <p style="margin-top:3rem;"><a href="${BASE}/nyheder/" style="color:var(--accent);">&larr; Alle nyheder</a></p>
    </div>
  </article>
  ${footer(globals)}
</body>
</html>`;
}

function buildPostsIndex(posts: Doc<Post>[], globals: Globals): string {
  const sorted = [...posts].sort((a, b) => (b.data.date || '').localeCompare(a.data.date || ''));
  const cards = sorted.map(p => {
    const imgSrc = p.data.featuredImage ? (p.data.featuredImage.startsWith('http') ? p.data.featuredImage : `${BASE}/${p.data.featuredImage}`) : '';
    return `
    <a href="${BASE}/nyheder/${p.slug}/" class="post-card">
      ${imgSrc ? `<img src="${esc(imgSrc)}" alt="" loading="lazy" />` : '<div></div>'}
      <div>
        <div class="date">${formatDate(p.data.date)}</div>
        <h3>${esc(p.data.title)}</h3>
        ${p.data.excerpt ? `<p class="excerpt">${esc(p.data.excerpt.slice(0, 200))}</p>` : ''}
      </div>
    </a>`;
  }).join('\n');

  return `${head('Nyheder', globals)}
<body>
  ${nav(globals, 'nyheder')}
  <div class="section" style="margin-top:60px;">
    <h1 class="section-heading">Nyheder</h1>
    <div class="section-divider"></div>
    ${cards}
  </div>
  ${footer(globals)}
</body>
</html>`;
}

function buildGalleryIndex(gallery: Doc<GalleryItem>[], globals: Globals, category: string, title: string): string {
  const BATCH = 24;
  const filtered = category === 'all' ? gallery : gallery.filter(g => g.data.category === category);
  const sorted = [...filtered].sort((a, b) => (a.data.sortOrder || 0) - (b.data.sortOrder || 0));

  // Collect unique years for filter
  const years = [...new Set(sorted.map(g => g.data.year).filter(y => y > 0))].sort((a, b) => b - a);

  // Build cards as JSON data for progressive loading
  const cardData = sorted.map(g => ({
    slug: g.slug,
    title: g.data.title,
    image: g.data.image ? `${BASE}/${g.data.image}` : '',
    medium: g.data.medium || '',
    dimensions: g.data.dimensions || '',
    year: g.data.year || 0,
  }));

  // Render first batch as HTML (for SEO / no-JS fallback)
  const initialCards = sorted.slice(0, BATCH).map(g => {
    const imgSrc = g.data.image ? `${BASE}/${g.data.image}` : '';
    const meta = [g.data.medium, g.data.dimensions].filter(Boolean).join(' · ');
    return `
    <a class="gallery-item" href="${BASE}/galleri/${g.slug}/" data-year="${g.data.year || 0}">
      ${imgSrc ? `<img src="${esc(imgSrc)}" alt="${esc(g.data.title)}" loading="lazy" />` : ''}
      <div class="gallery-overlay">
        <h3>${esc(g.data.title)}</h3>
        ${meta ? `<span class="meta">${esc(meta)}</span>` : ''}
      </div>
    </a>`;
  }).join('\n');

  // Category tabs
  const tabs = [
    { label: 'Alle', cat: 'all', href: '/galleri/' },
    { label: 'Værker', cat: 'vaerker', href: '/galleri/vaerker/' },
    { label: 'Grafik', cat: 'grafik', href: '/galleri/grafik/' },
    { label: 'Collager', cat: 'collager', href: '/galleri/collager/' },
  ];
  const tabHtml = tabs.map(t =>
    `<a href="${BASE}${t.href}" class="gallery-tab${t.cat === category ? ' active' : ''}">${t.label}</a>`
  ).join('\n      ');

  // Year filter
  const yearOptions = years.map(y => `<option value="${y}">${y}</option>`).join('');

  return `${head(title, globals)}
<body>
  ${nav(globals, 'galleri')}
  <div class="section" style="margin-top:60px;">
    <h1 class="section-heading">${esc(title)}</h1>
    <div class="gallery-filters">
      ${tabHtml}
      ${years.length > 1 ? `<div class="year-dropdown" id="yearDropdown">
        <button class="year-dropdown-toggle" id="yearToggle" onclick="toggleYearDropdown()">Alle år</button>
        <div class="year-dropdown-menu"><div class="year-dropdown-menu-inner">
          <button class="active" onclick="selectYear('all',this)">Alle år</button>
          ${years.map(y => `<button onclick="selectYear('${y}',this)">${y}</button>`).join('\n          ')}
        </div></div>
      </div>` : ''}
    </div>
    <div class="gallery-grid" id="galleryGrid">
      ${initialCards}
    </div>
    ${sorted.length > BATCH ? `<button class="load-more-btn" id="loadMoreBtn" onclick="loadMore()">Vis flere (${sorted.length - BATCH} tilbage)</button>` : ''}
  </div>
  ${footer(globals)}
  <script>
  (function(){
    var BASE = ${JSON.stringify(BASE)};
    var allItems = ${JSON.stringify(cardData)};
    var shown = ${BATCH};
    var BATCH = ${BATCH};
    var currentYear = 'all';
    var grid = document.getElementById('galleryGrid');
    var btn = document.getElementById('loadMoreBtn');

    function makeCard(item) {
      var meta = [item.medium, item.dimensions].filter(Boolean).join(' \\u00B7 ');
      return '<a class="gallery-item" href="' + BASE + '/galleri/' + item.slug + '/" data-year="' + item.year + '">'
        + (item.image ? '<img src="' + item.image + '" alt="' + item.title.replace(/"/g,'&quot;') + '" loading="lazy" />' : '')
        + '<div class="gallery-overlay"><h3>' + item.title.replace(/</g,'&lt;') + '</h3>'
        + (meta ? '<span class="meta">' + meta.replace(/</g,'&lt;') + '</span>' : '')
        + '</div></a>';
    }

    function getFiltered() {
      if (currentYear === 'all') return allItems;
      var y = parseInt(currentYear);
      return allItems.filter(function(i) { return i.year === y; });
    }

    function render(items, count) {
      var html = '';
      for (var i = 0; i < Math.min(count, items.length); i++) html += makeCard(items[i]);
      grid.innerHTML = html;
      if (btn) {
        var remaining = items.length - count;
        if (remaining > 0) {
          btn.style.display = 'block';
          btn.textContent = 'Vis flere (' + remaining + ' tilbage)';
        } else {
          btn.style.display = 'none';
        }
      }
    }

    window.loadMore = function() {
      var items = getFiltered();
      shown += BATCH;
      render(items, shown);
    };

    window.filterByYear = function(year) {
      currentYear = year;
      shown = BATCH;
      render(getFiltered(), shown);
    };

    window.toggleYearDropdown = function() {
      var dd = document.getElementById('yearDropdown');
      dd.classList.toggle('open');
    };

    window.selectYear = function(year, el) {
      filterByYear(year);
      var toggle = document.getElementById('yearToggle');
      toggle.textContent = year === 'all' ? 'Alle år' : year;
      toggle.className = 'year-dropdown-toggle' + (year !== 'all' ? ' active' : '');
      var dd = document.getElementById('yearDropdown');
      dd.classList.remove('open');
      dd.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
      el.classList.add('active');
    };

    document.addEventListener('click', function(e) {
      var dd = document.getElementById('yearDropdown');
      if (dd && !dd.contains(e.target)) dd.classList.remove('open');
    });
  })();
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function build() {
  console.log('Building Maurseth Gallery...\n');
  ensureDir(DIST);

  // Load content
  const globals = loadGlobals();
  const pages = loadCollection<PageData>('pages');
  const gallery = loadCollection<GalleryItem>('gallery');
  const exhibitions = loadCollection<Exhibition>('exhibitions');
  const posts = loadCollection<Post>('posts');

  console.log(`  Content: ${pages.length} pages, ${gallery.length} gallery, ${exhibitions.length} exhibitions, ${posts.length} posts\n`);

  // Copy media
  if (existsSync(MEDIA_SRC)) {
    console.log('  Copying media...');
    cpSync(MEDIA_SRC, join(DIST, 'uploads'), { recursive: true });
  }

  // Build pages from CMS sections
  const pageRoutes: Record<string, string> = {
    'forside': '/',
    'galleri': '/galleri/',
    'collager': '/galleri/collager/',
    'udstillinger': '/udstillinger/',
    'profil': '/profil/',
    'cv': '/cv/',
    'for-tiden': '/for-tiden/',
    'kontakt': '/kontakt/',
    'atelier': '/atelier/',
    'nyheder': '/nyheder/',
  };

  const activeMap: Record<string, string> = {
    'forside': 'forside',
    'galleri': 'galleri',
    'collager': 'galleri',
    'udstillinger': 'udstillinger',
    'profil': 'profil',
    'cv': 'profil',
    'for-tiden': 'forside',
    'kontakt': 'kontakt',
    'atelier': 'kontakt',
    'nyheder': 'nyheder',
  };

  for (const page of pages) {
    const route = pageRoutes[page.slug];
    if (!route) continue;
    if (page.slug === 'nyheder') continue; // Built separately with post listing
    if (page.slug === 'galleri' || page.slug === 'collager') continue; // Built separately with gallery grid

    const outPath = route === '/' ? join(DIST, 'index.html') : join(DIST, route.slice(1), 'index.html');
    writeFile(outPath, buildPage(page, globals, gallery, exhibitions, activeMap[page.slug]));
  }

  // Gallery index pages (with category tabs)
  writeFile(join(DIST, 'galleri', 'index.html'), buildGalleryIndex(gallery, globals, 'all', 'Galleri'));
  writeFile(join(DIST, 'galleri', 'vaerker', 'index.html'), buildGalleryIndex(gallery, globals, 'vaerker', 'Værker'));
  writeFile(join(DIST, 'galleri', 'grafik', 'index.html'), buildGalleryIndex(gallery, globals, 'grafik', 'Grafik'));
  writeFile(join(DIST, 'galleri', 'collager', 'index.html'), buildGalleryIndex(gallery, globals, 'collager', 'Collager'));

  // Gallery detail pages
  for (const item of gallery) {
    writeFile(join(DIST, 'galleri', item.slug, 'index.html'), buildGalleryDetail(item, globals));
  }
  console.log(`  ${gallery.length} gallery detail pages`);

  // News index
  writeFile(join(DIST, 'nyheder', 'index.html'), buildPostsIndex(posts, globals));

  // Individual post pages
  for (const post of posts) {
    writeFile(join(DIST, 'nyheder', post.slug, 'index.html'), buildPostPage(post, globals));
  }
  console.log(`  ${posts.length} post pages`);

  // Exhibition index
  writeFile(join(DIST, 'udstillinger', 'index.html'), buildExhibitionsIndex(exhibitions, globals));

  // Exhibition detail pages
  for (const ex of exhibitions) {
    writeFile(join(DIST, 'udstillinger', ex.slug, 'index.html'), buildExhibitionDetail(ex, globals, exhibitions));
  }
  console.log(`  ${exhibitions.length} exhibition detail pages`);

  const totalPages = pages.length + gallery.length + posts.length + exhibitions.length + 4;
  console.log(`\n✅ Done! ${totalPages} pages → ${DIST.replace(ROOT + '/', '')}/`);
}

build();
