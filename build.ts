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
  cookieText: string;
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

/** Resolve image path — handles absolute URLs, /uploads/ paths, and bare uploads/ paths */
function imgUrl(src: string): string {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  if (src.startsWith('/')) return `${BASE}${src}`;
  return `${BASE}/${src}`;
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
    const imgSrc = imgUrl(src);
    return `<img src="${esc(imgSrc)}" alt="${esc(alt)}" loading="lazy" />`;
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Group lines into paragraphs: consecutive non-empty text lines become one <p> with <br>
  const lines = html.split('\n');
  const result: string[] = [];
  let textBuf: string[] = [];

  function flushText() {
    if (textBuf.length > 0) {
      result.push(`<p>${textBuf.join('<br>')}</p>`);
      textBuf = [];
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushText();
      result.push('');
      continue;
    }
    if (/^<(h[1-4]|ul|ol|li|blockquote|\/ul|\/ol|\/blockquote|img|figure|figcaption)/.test(trimmed)) {
      flushText();
      result.push(trimmed);
    } else {
      textBuf.push(trimmed);
    }
  }
  flushText();

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
.nav-logo-img { height: 36px; width: auto; }
.nav-links { display: flex; gap: 1.75rem; list-style: none; }
.nav-links a {
  color: var(--muted); font-size: 0.8125rem; font-weight: 500;
  letter-spacing: 0.04em; text-transform: uppercase;
  transition: color 0.3s; padding: 0.25rem 0;
  border-bottom: 2px solid transparent;
}
.nav-links a:hover, .nav-links a.active {
  color: var(--text); border-bottom-color: #ED155B;
}
.nav-social {
  color: var(--muted); padding: 0.25rem; border-bottom: none !important;
  display: flex; align-items: center; transition: color 0.3s;
}
.nav-social:hover { color: var(--text); border-bottom-color: transparent !important; }

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
.nav-dropdown-menu-inner a:hover { color: #ED155B; background: rgba(237,21,91,0.05); }

/* Gallery filters */
.gallery-filters {
  display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 2rem; align-items: center;
}
.gallery-tab {
  padding: 0.4rem 1rem; font-size: 0.8rem; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--muted); border: 1px solid var(--border);
  border-radius: 3px; cursor: pointer; background: rgba(237,21,91,0.03); transition: 0.2s;
  text-decoration: none; display: inline-block; font-family: var(--sans);
}
.gallery-tab:hover { color: #ED155B; border-color: #ED155B; }
.gallery-tab.active { color: #ED155B; border-color: #ED155B; background: rgba(237,21,91,0.05); }
/* Year filter — custom dropdown (no native select) */
.year-dropdown { position: relative; margin-left: auto; }
.year-dropdown-toggle {
  padding: 0.4rem 1rem; font-size: 0.8rem; letter-spacing: 0.06em;
  text-transform: uppercase; border: 1px solid var(--border); border-radius: 3px;
  background: rgba(237,21,91,0.03); color: var(--text); font-family: var(--sans);
  cursor: pointer; display: flex; align-items: center; gap: 0.5rem;
}
.year-dropdown-toggle::after { content: '\\25BE'; font-size: 0.65em; color: var(--muted); }
.year-dropdown-toggle.active { color: #ED155B; border-color: #ED155B; }
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
.year-dropdown-menu-inner button:hover { color: #ED155B; background: rgba(237,21,91,0.05); }
.year-dropdown-menu-inner button.active { color: #ED155B; font-weight: 500; }

/* Load more */
.load-more-btn {
  display: block; margin: 3rem auto 0; padding: 0.75rem 2.5rem;
  font-size: 0.85rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase;
  color: #ED155B; border: 1px solid #ED155B; border-radius: 3px;
  background: transparent; cursor: pointer; transition: 0.2s; font-family: var(--sans);
}
.load-more-btn:hover { background: #ED155B; color: #fff; }

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

/* ---- Hero / Split layout ---- */
.hero {
  position: relative; min-height: 90vh; overflow: hidden;
  margin-top: 60px; /* fixed nav height */
}
.hero-bg {
  position: absolute; inset: -15% 0; height: 130%;
  object-fit: cover; width: 100%;
  will-change: transform;
}
.hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(26,23,20,0.65) 0%, rgba(26,23,20,0.15) 60%, transparent 100%);
}
.hero-split {
  position: relative; z-index: 2;
  display: grid; grid-template-columns: 1fr 1fr; min-height: 90vh;
  max-width: 1300px; margin: 0 auto; padding: 0 3rem;
  align-items: center;
}
.hero-text { color: var(--text-light); }
.hero-text .hero-label {
  font-size: 0.75rem; font-weight: 500; letter-spacing: 0.2em;
  text-transform: uppercase; color: var(--accent-light); margin-bottom: 1.5rem;
}
.hero-text h1 {
  font-family: var(--serif); font-size: 3.75rem; font-weight: 300;
  letter-spacing: 0.02em; line-height: 1.15; margin-bottom: 1.5rem;
}
.hero-text .hero-sub {
  font-size: 1.05rem; line-height: 1.8; color: rgba(245,240,235,0.7);
  max-width: 440px;
}
.hero-text .hero-cta {
  display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 2rem;
  padding: 0.7rem 1.75rem; border: 1px solid rgba(255,255,255,0.3);
  border-radius: 3px; color: var(--text-light); font-size: 0.8rem;
  letter-spacing: 0.08em; text-transform: uppercase; transition: 0.3s;
}
.hero-text .hero-cta:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.6); }
.hero-portrait {
  display: flex; justify-content: flex-end; align-items: flex-end;
  padding-bottom: 0;
}
.hero-portrait img {
  max-height: 80vh; width: auto; max-width: 100%;
  filter: drop-shadow(0 8px 32px rgba(0,0,0,0.3));
}

/* Wave divider */
.wave-divider { margin-top: -4rem; position: relative; z-index: 3; }
.wave-divider svg { display: block; width: 100%; height: auto; }

/* ---- "For Tiden" collage ---- */
.collage-section { background: var(--bg); padding: 5rem 2rem; }
.collage-grid {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: auto auto;
  gap: 1rem;
}
.collage-grid .cg-wide { grid-column: span 2; }
.collage-grid .cg-tall { grid-row: span 2; }
.collage-grid .cg-accent {
  grid-row: span 2; background: var(--bg-dark); color: var(--text-light);
  border-radius: 8px; padding: 2.5rem 2rem;
  display: flex; flex-direction: column; justify-content: center;
}
.collage-grid .cg-accent h2 {
  font-family: var(--serif); font-size: 1.75rem; font-weight: 300;
  line-height: 1.3; color: var(--accent-light);
}
.collage-grid .cg-accent p { margin-top: 1rem; font-size: 0.9rem; color: rgba(245,240,235,0.6); }
.collage-grid .cg-accent a {
  margin-top: 1.5rem; font-size: 0.75rem; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--accent-light);
}
.collage-grid img {
  width: 100%; height: 100%; object-fit: cover; border-radius: 8px;
  transition: transform 0.6s cubic-bezier(0.25,0.46,0.45,0.94);
}
.collage-grid a:hover img { transform: scale(1.03); }

/* ---- News cards (home) ---- */
.news-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
.news-card { display: block; text-decoration: none; color: inherit; }
.news-card img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 6px; transition: opacity 0.3s; }
.news-card:hover img { opacity: 0.85; }
.news-card .news-cat { font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: #ED155B; margin-top: 0.75rem; }
.news-card h3 { font-family: var(--serif); font-size: 1.15rem; font-weight: 400; margin-top: 0.3rem; line-height: 1.4; }
.news-card .news-date { font-size: 0.8rem; color: var(--muted); margin-top: 0.3rem; }

@media (max-width: 768px) {
  .hero-split { grid-template-columns: 1fr; text-align: center; padding: 0 1.5rem; }
  .hero-portrait { justify-content: center; padding-top: 2rem; }
  .hero-portrait img { max-height: 50vh; }
  .hero-text h1 { font-size: 2.5rem; }
  .collage-grid { grid-template-columns: 1fr 1fr; }
  .news-grid { grid-template-columns: 1fr; }
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

/* ---- Page top (consistent spacing below fixed nav) ---- */
.page-top { padding-top: 100px; }

/* ---- Section layout ---- */
.section { max-width: 1200px; margin: 0 auto; padding: 5rem 2rem; }
.section-narrow { max-width: 800px; margin: 0 auto; padding: 4rem 2rem; }
.section-heading {
  font-family: var(--serif); font-size: 2.5rem; font-weight: 300;
  letter-spacing: 0.02em; margin-bottom: 2rem;
}
.section-divider {
  width: 60px; height: 1px; background: #ED155B; margin-bottom: 3rem;
}

/* ---- Prose (richtext) ---- */
.prose { font-size: 1.0625rem; line-height: 1.9; color: var(--text); }
.prose p { margin-bottom: 1.5em; }
.prose h2 { font-family: var(--serif); font-size: 1.75rem; font-weight: 400; margin-top: 2.5em; margin-bottom: 0.75em; }
.prose h3 { font-family: var(--serif); font-size: 1.35rem; font-weight: 400; margin-top: 2em; margin-bottom: 0.5em; }
.prose h4 { font-size: 1.1rem; font-weight: 600; margin-top: 1.5em; margin-bottom: 0.5em; }
.prose ul { list-style: disc; padding-left: 1.5em; margin-bottom: 1.5em; }
.prose li { margin-bottom: 0.4em; }
.prose blockquote { border-left: 3px solid #ED155B; padding: 0.75em 1.25em; margin: 1.5em 0; font-style: italic; color: var(--muted); }
.prose a { color: #ED155B; text-decoration: underline; text-underline-offset: 2px; }
.prose img { border-radius: 4px; margin: 1.5em 0; }

/* ---- Profile ---- */
.profile-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: start;
}
.profile-grid img {
  width: 100%; border-radius: 4px; object-fit: cover; aspect-ratio: 3/4;
}

/* ---- Exhibition list ---- */
.exhibition-year-heading { font-family: var(--serif); font-size: 2rem; font-weight: 300; margin-top: 3.5rem; margin-bottom: 1.5rem; color: #ED155B; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
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
.post-card:hover h3 { color: #ED155B; }

/* ---- Contact ---- */
.contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; }
.contact-block h3 { font-family: var(--serif); font-size: 1.25rem; margin-bottom: 0.75rem; }
.contact-block p { color: var(--muted); line-height: 1.8; }
.contact-block a { color: #ED155B; }

/* ---- Footer ---- */
.footer {
  background: var(--bg-dark); color: var(--text-light); padding: 4rem 2rem 2rem;
  font-size: 0.85rem;
}
.footer a { color: #ED155B; transition: opacity 0.2s; }
.footer a:hover { opacity: 0.8; }
.footer-grid {
  max-width: 1200px; margin: 0 auto;
  display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 2rem;
}
.footer-col h4 { font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(245,240,235,0.5); margin-bottom: 0.75rem; }
.footer-col p { color: rgba(245,240,235,0.7); line-height: 1.7; margin-bottom: 0.25rem; }
.footer-col p a { color: #ED155B; }
.footer-social { display: flex; gap: 0.75rem; margin-top: 0.75rem; }
.footer-social a { color: rgba(245,240,235,0.5); }
.footer-social a:hover { color: #ED155B; }
.footer-bottom { max-width: 1200px; margin: 3rem auto 0; padding-top: 1.5rem; border-top: 1px solid rgba(245,240,235,0.1); text-align: center; color: rgba(245,240,235,0.4); }
@media (max-width: 768px) { .footer-grid { grid-template-columns: 1fr 1fr; } }

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

/* ---- Statement section (full-width bg image + text) ---- */
.statement {
  position: relative; min-height: 500px; overflow: hidden;
  display: flex; align-items: center; justify-content: center; text-align: center;
}
.statement-bg {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
}
.statement-overlay {
  position: absolute; inset: 0;
  background: rgba(26,23,20,0.55);
}
.statement-content {
  position: relative; z-index: 2; max-width: 700px; padding: 4rem 2rem; color: var(--text-light);
}
.statement-content h2 {
  font-size: 0.85rem; font-weight: 600; letter-spacing: 0.15em;
  text-transform: uppercase; margin-bottom: 1.5rem;
}
.statement-content p {
  font-family: var(--serif); font-size: 1.2rem; font-weight: 300;
  line-height: 1.7; color: rgba(245,240,235,0.85);
}
.statement-ctas { display: flex; justify-content: center; gap: 1rem; margin-top: 2rem; }
.statement-cta {
  padding: 0.7rem 2rem; font-size: 0.8rem; font-weight: 500;
  letter-spacing: 0.06em; text-transform: uppercase; border-radius: 3px;
  cursor: pointer; transition: 0.3s; font-family: var(--sans); text-decoration: none;
}
.statement-cta-primary { background: rgba(255,255,255,0.9); color: var(--bg-dark); border: none; }
.statement-cta-primary:hover { background: #fff; }
.statement-cta-secondary { background: transparent; color: var(--text-light); border: 1px solid rgba(255,255,255,0.4); }
.statement-cta-secondary:hover { border-color: #fff; background: rgba(255,255,255,0.1); }

/* ---- Tag pills ---- */
.tag-pill {
  display: inline-block; padding: 0.25rem 0.75rem; font-size: 0.7rem;
  letter-spacing: 0.06em; border: 1px solid rgba(237,21,91,0.3);
  border-radius: 99px; color: #ED155B; background: rgba(237,21,91,0.04);
  text-decoration: none; transition: 0.2s; font-family: var(--sans);
}
.tag-pill:hover { background: rgba(237,21,91,0.1); border-color: #ED155B; }
.tag-pills { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.tag-count { font-size: 0.65rem; color: var(--muted); margin-left: 0.2rem; }

/* Tags page */
.tags-cloud { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.tags-cloud .tag-pill { font-size: 0.8rem; padding: 0.4rem 1rem; }

/* ---- Cookie consent ---- */
.cookie-banner {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 200;
  background: var(--bg-dark); color: var(--text-light); padding: 1.25rem 2rem;
  display: flex; align-items: center; justify-content: center; gap: 1.5rem;
  font-size: 0.85rem; box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
}
.cookie-banner p { color: rgba(245,240,235,0.7); max-width: 600px; }
.cookie-banner a { color: #ED155B; text-decoration: underline; }
.cookie-btn {
  padding: 0.5rem 1.5rem; border: none; border-radius: 3px; cursor: pointer;
  font-size: 0.8rem; font-weight: 500; letter-spacing: 0.04em; font-family: var(--sans);
}
.cookie-btn-accept { background: #ED155B; color: #fff; }
.cookie-btn-accept:hover { opacity: 0.9; }
@media (max-width: 768px) { .cookie-banner { flex-direction: column; text-align: center; } }
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
  <link rel="icon" type="image/svg+xml" href="${BASE}/assets/favicon.svg" />
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
    <a href="${BASE}/" class="nav-logo">${globals.logoImage ? `<img src="${imgUrl(globals.logoImage)}" alt="${esc(globals.artistName)}" class="nav-logo-img" />` : `${esc(globals.artistName)}<span>${esc(globals.artistTitle)}</span>`}</a>
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
      <div class="nav-dropdown">
        <a href="${BASE}/profil/" class="${active === 'profil' ? 'active' : ''}">Profil</a>
        <div class="nav-dropdown-menu"><div class="nav-dropdown-menu-inner">
          <a href="${BASE}/profil/">Om mig</a>
          <a href="${BASE}/cv/">CV</a>
        </div></div>
      </div>
      <a href="${BASE}/udstillinger/" class="${active === 'udstillinger' ? 'active' : ''}">Udstillinger</a>
      <a href="${BASE}/for-tiden/" class="${active === 'for-tiden' ? 'active' : ''}">For tiden</a>
      <div class="nav-dropdown">
        <a href="${BASE}/kontakt/" class="${active === 'kontakt' ? 'active' : ''}">Kontakt</a>
        <div class="nav-dropdown-menu"><div class="nav-dropdown-menu-inner">
          <a href="${BASE}/kontakt/">Kontakt</a>
          <a href="${BASE}/atelier/">Mit atelier</a>
        </div></div>
      </div>
      ${globals.facebookUrl ? `<a href="${esc(globals.facebookUrl)}" target="_blank" rel="noopener" class="nav-social" aria-label="Facebook"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>` : ''}
      ${globals.instagramUrl ? `<a href="${esc(globals.instagramUrl)}" target="_blank" rel="noopener" class="nav-social" aria-label="Instagram"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>` : ''}
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
  <div class="footer-grid">
    <div class="footer-col">
      <h4>${esc(globals.artistName)}</h4>
      <p>${esc(globals.artistTitle)}</p>
      <div class="footer-social">
        ${globals.instagramUrl ? `<a href="${esc(globals.instagramUrl)}" target="_blank" rel="noopener" aria-label="Instagram"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>` : ''}
        ${globals.facebookUrl ? `<a href="${esc(globals.facebookUrl)}" target="_blank" rel="noopener" aria-label="Facebook"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>` : ''}
      </div>
    </div>
    <div class="footer-col">
      <h4>Atelier</h4>
      <p>${(globals.studioAddress || '').replace(/\n/g, '<br>')}</p>
    </div>
    <div class="footer-col">
      <h4>Kontakt</h4>
      ${globals.email ? `<p><a href="mailto:${esc(globals.email)}">${esc(globals.email)}</a></p>` : ''}
      ${globals.phone ? `<p><a href="tel:${esc(globals.phone)}">${esc(globals.phone)}</a></p>` : ''}
    </div>
    <div class="footer-col">
      <h4>Sider</h4>
      <p><a href="${BASE}/galleri/vaerker/">Galleri</a></p>
      <p><a href="${BASE}/udstillinger/">Udstillinger</a></p>
      <p><a href="${BASE}/for-tiden/">For tiden</a></p>
      <p><a href="${BASE}/kontakt/">Kontakt</a></p>
      <p><a href="${BASE}/tags/">Tags</a></p>
      <p><a href="${BASE}/siteoversigt/">Oversigt</a></p>
    </div>
  </div>
  <div class="footer-bottom">
    <p>${esc(globals.footerText)} · Crafted by <a href="https://webhouse.dk" target="_blank" rel="noopener">WebHouse</a> · Powered by <a href="https://webhouse.app" target="_blank" rel="noopener">webhouse.app</a></p>
  </div>
</footer>
<div class="cookie-banner" id="cookieBanner" style="display:none;">
  <p>${esc(globals.cookieText || 'Denne hjemmeside bruger cookies til at forbedre din oplevelse.')}</p>
  <button class="cookie-btn cookie-btn-accept" onclick="document.getElementById('cookieBanner').style.display='none';localStorage.setItem('cookies-accepted','1')">Accepter</button>
</div>
<script>if(!localStorage.getItem('cookies-accepted'))document.getElementById('cookieBanner').style.display='flex';</script>`;
}

function renderTagPills(tags: string[]): string {
  if (!tags || tags.length === 0) return '';
  return `<div class="tag-pills">${tags.map(t => `<a class="tag-pill" href="${BASE}/tags/${encodeURIComponent(t)}/">#${esc(t)}</a>`).join('')}</div>`;
}

function collectAllTags(...collections: Doc<any>[][]): Map<string, number> {
  const tagCount = new Map<string, number>();
  for (const docs of collections) {
    for (const d of docs) {
      const tags = d.data.tags;
      if (Array.isArray(tags)) {
        for (const t of tags) {
          tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
        }
      }
    }
  }
  return tagCount;
}

// ---------------------------------------------------------------------------
// Block renderers
// ---------------------------------------------------------------------------

function renderHero(block: Section, globals: Globals, isHome = false): string {
  const bgImg = imgUrl(globals.heroImage);
  const portraitImg = `${BASE}/uploads/901-grethepenslerr.png`;

  if (isHome) {
    return `
<section class="hero">
  ${bgImg ? `<img class="hero-bg" src="${esc(`${BASE}/uploads/914-forsidebaggrund.jpg`)}" alt="" id="parallax-hero" />` : ''}
  <div class="hero-overlay"></div>
  <div class="hero-split">
    <div class="hero-text">
      <div class="hero-label">${esc(globals.artistTitle || 'Billedkunstner')}</div>
      <h1>${esc(block.title || globals.artistName)}</h1>
      <p class="hero-sub">Akrylmalerier, grafik og collager. Udstiller i Danmark, Norge og Island siden 2005.</p>
      <a href="${BASE}/galleri/" class="hero-cta">Se galleriet &rarr;</a>
    </div>
    <div class="hero-portrait">
      <img src="${esc(portraitImg)}" alt="${esc(globals.artistName)}" />
    </div>
  </div>
</section>
<div class="wave-divider">
  <svg viewBox="0 0 1440 80" preserveAspectRatio="none"><path fill="var(--bg)" d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z"/></svg>
</div>
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

  // Non-home hero (simple centered)
  const img = block.image || globals.heroImage;
  const imgSrc = img ? (imgUrl(img)) : '';
  return `
<section class="hero" style="min-height:60vh;">
  ${imgSrc ? `<img class="hero-bg" src="${esc(imgSrc)}" alt="" id="parallax-hero" />` : ''}
  <div class="hero-overlay"></div>
  <div style="position:relative;z-index:2;text-align:center;color:var(--text-light);">
    <h1 style="font-family:var(--serif);font-size:3.5rem;font-weight:300;">${esc(block.title || '')}</h1>
    ${block.subtitle ? `<p style="font-size:1rem;letter-spacing:0.18em;text-transform:uppercase;margin-top:1rem;color:rgba(245,240,235,0.75);">${esc(block.subtitle)}</p>` : ''}
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
<section class="section">
  ${block.heading ? `<h2 class="section-heading">${esc(block.heading)}</h2><div class="section-divider"></div>` : ''}
  <div class="prose" style="max-width:800px;">${markdownToHtml(block.content || '')}</div>
</section>`;
}

function renderProfile(block: Section): string {
  const imgSrc = imgUrl(block.portraitImage);
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
    const imgSrc = imgUrl(g.data.image);
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
      const imgSrc = img ? (imgUrl(img)) : '';
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

function renderStatement(block: Section): string {
  const imgSrc = imgUrl(block.image);
  return `
<section class="statement">
  ${imgSrc ? `<img class="statement-bg" src="${esc(imgSrc)}" alt="" />` : ''}
  <div class="statement-overlay"></div>
  <div class="statement-content">
    ${block.title ? `<h2>${esc(block.title)}</h2>` : ''}
    ${block.text ? `<p>${esc(block.text)}</p>` : ''}
    ${(block.cta1Label || block.cta2Label) ? `<div class="statement-ctas">
      ${block.cta1Label ? `<a class="statement-cta statement-cta-primary" href="${BASE}${block.cta1Href || '/'}">${esc(block.cta1Label)}</a>` : ''}
      ${block.cta2Label ? `<a class="statement-cta statement-cta-secondary" href="${BASE}${block.cta2Href || '/'}">${esc(block.cta2Label)}</a>` : ''}
    </div>` : ''}
  </div>
</section>`;
}

function renderCvSection(block: Section): string {
  return `
<section class="section">
  ${block.heading ? `<h2 class="section-heading">${esc(block.heading)}</h2><div class="section-divider"></div>` : ''}
  <div class="prose" style="max-width:800px;">${markdownToHtml(block.content || '')}</div>
</section>`;
}

function renderImageGallery(block: Section): string {
  const images: Array<{url: string; alt: string}> = block.images || [];
  const cards = images.map(img => `
    <div class="gallery-item">
      <img src="${esc(imgUrl(img.url))}" alt="${esc(img.alt || '')}" loading="lazy" />
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
      case 'statement': return renderStatement(s);
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

function buildHome(globals: Globals, gallery: Doc<GalleryItem>[], exhibitions: Doc<Exhibition>[], posts: Doc<Post>[]): string {
  // Featured artwork images for collage
  const collageImages = [
    { file: 'uploads/2268-sofia-paa-papir.jpg', title: 'Sofia', wide: true },
    { file: 'uploads/2300-nora-akryl-60-x-120.jpg', title: 'Nora', tall: true },
    { file: 'uploads/2297-ava-210-3.jpg', title: 'Ava' },
    { file: 'uploads/1027-vandreren-akryl-70-x70.jpg', title: 'Vandreren' },
    { file: 'uploads/2409-anna-akryl-60-x-120-kopi.jpg', title: 'Anna' },
  ];

  const collageHtml = `
  <div class="collage-grid">
    <a href="${BASE}/galleri/" class="cg-wide" style="overflow:hidden;border-radius:8px;">
      <img src="${imgUrl(collageImages[0].file)}" alt="${collageImages[0].title}" loading="lazy" />
    </a>
    <div class="cg-accent">
      <h2>For Tiden Er Jeg I Diskussion Med Mig Selv</h2>
      <p>Akrylmalerier, grafik og collager fra atelieret i Aalborg</p>
      <a href="${BASE}/for-tiden/">For tiden &rarr;</a>
      <a href="${BASE}/udstillinger/" style="margin-top:0.5rem;">Se udstillinger &rarr;</a>
    </div>
    <a href="${BASE}/galleri/" class="cg-tall" style="overflow:hidden;border-radius:8px;">
      <img src="${imgUrl(collageImages[1].file)}" alt="${collageImages[1].title}" loading="lazy" />
    </a>
    <a href="${BASE}/galleri/" style="overflow:hidden;border-radius:8px;">
      <img src="${imgUrl(collageImages[2].file)}" alt="${collageImages[2].title}" loading="lazy" />
    </a>
    <a href="${BASE}/galleri/" style="overflow:hidden;border-radius:8px;">
      <img src="${imgUrl(collageImages[3].file)}" alt="${collageImages[3].title}" loading="lazy" />
    </a>
    <a href="${BASE}/galleri/" style="overflow:hidden;border-radius:8px;">
      <img src="${imgUrl(collageImages[4].file)}" alt="${collageImages[4].title}" loading="lazy" />
    </a>
  </div>`;

  // Recent exhibitions (with images, max 4)
  const recentEx = [...exhibitions]
    .filter(e => e.data.featuredImage)
    .sort((a, b) => (b.data.year || 0) - (a.data.year || 0))
    .slice(0, 4);

  const exCards = recentEx.map(e => {
    const img = e.data.featuredImage;
    const imgSrc = imgUrl(img);
    return `
    <a class="exhibition-card" href="${BASE}/udstillinger/${e.slug}/">
      <img class="exhibition-card-img" src="${esc(imgSrc)}" alt="${esc(e.data.title)}" loading="lazy" />
      <div class="exhibition-card-body">
        <h3>${esc(e.data.title)}</h3>
        <div class="ex-meta">${e.data.year || ''}</div>
      </div>
    </a>`;
  }).join('\n');

  // Recent news (max 3)
  const recentPosts = [...posts]
    .sort((a, b) => (b.data.date || '').localeCompare(a.data.date || ''))
    .slice(0, 3);

  const newsCards = recentPosts.map(p => {
    const img = p.data.featuredImage;
    const imgSrc = img ? (imgUrl(img)) : '';
    return `
    <a class="news-card" href="${BASE}/nyheder/${p.slug}/">
      ${imgSrc ? `<img src="${esc(imgSrc)}" alt="" loading="lazy" />` : ''}
      <div class="news-cat">${esc(p.data.category || 'Nyheder')}</div>
      <h3>${esc(p.data.title)}</h3>
      <div class="news-date">${formatDate(p.data.date)}</div>
    </a>`;
  }).join('\n');

  return `${head(globals.artistName, globals, globals.metaDescription)}
<body>
  ${nav(globals, 'forside')}
  ${renderHero({_block:'hero', title: globals.artistName, subtitle: globals.artistTitle}, globals, true)}

  <section class="collage-section">
    <div class="section" style="padding-top:2rem;">
      <h2 class="section-heading">Udvalgte værker</h2>
      <div class="section-divider"></div>
    </div>
    ${collageHtml}
  </section>

  <section class="statement">
    <img class="statement-bg" src="${BASE}/uploads/1036-dark-land-akryl-80-x-100.jpg" alt="" />
    <div class="statement-overlay"></div>
    <div class="statement-content">
      <h2>${esc(globals.artistName)} ${esc(globals.artistTitle)}</h2>
      <p>Med t&aelig;tte b&aring;nd til Vestlandet og r&oslash;dder fra Maurseth p&aring; Hardangervidda, hvor kunstnere har fulgt sl&aelig;gten fra 1800-tallet frem til i dag, er Grethe Maurseths DNA med i hvert maleri.</p>
      <div class="statement-ctas">
        <a class="statement-cta statement-cta-primary" href="${BASE}/galleri/vaerker/">Se galleri</a>
        <a class="statement-cta statement-cta-secondary" href="${BASE}/profil/">Biografi</a>
      </div>
    </div>
  </section>

  <section class="section">
    <h2 class="section-heading">Aktuelle udstillinger</h2>
    <div class="section-divider"></div>
    <div class="exhibition-cards">${exCards}</div>
    <p style="margin-top:2rem;"><a href="${BASE}/udstillinger/" style="color:#ED155B;font-size:0.85rem;letter-spacing:0.06em;text-transform:uppercase;">Se alle udstillinger &rarr;</a></p>
  </section>

  <section class="section">
    <h2 class="section-heading">Nyheder</h2>
    <div class="section-divider"></div>
    <div class="news-grid">${newsCards}</div>
    <p style="margin-top:2rem;"><a href="${BASE}/nyheder/" style="color:#ED155B;font-size:0.85rem;letter-spacing:0.06em;text-transform:uppercase;">Alle nyheder &rarr;</a></p>
  </section>

  ${footer(globals)}
</body>
</html>`;
}

function buildExhibitionDetail(ex: Doc<Exhibition>, globals: Globals, allExhibitions: Doc<Exhibition>[]): string {
  const d = ex.data;
  const imgSrc = imgUrl(d.featuredImage);

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
        const rImg = imgUrl(r.data.featuredImage);
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
  ${imgSrc ? `<div class="page-top"><img class="ex-detail-hero" src="${esc(imgSrc)}" alt="${esc(d.title)}" /></div>` : ''}
  <div class="section${imgSrc ? '' : ' page-top'}">
    <h1 class="section-heading">${esc(d.title)}</h1>
    <div class="ex-detail-meta" style="margin-bottom:2rem;">
      ${d.year ? `<span>${d.year}</span>` : ''}
      ${d.venue ? `<span>${esc(d.venue)}</span>` : ''}
      ${d.location ? `<span>${esc(d.location)}</span>` : ''}
      ${d.startDate ? `<span>${formatDate(d.startDate)}</span>` : ''}
    </div>
    ${d.description ? `<div class="prose" style="max-width:800px;">${markdownToHtml(d.description)}</div>` : ''}
    ${(ex.data as any).tags?.length ? `<div style="margin-top:2rem;">${renderTagPills((ex.data as any).tags)}</div>` : ''}
    <p style="margin-top:2rem;"><a href="${BASE}/udstillinger/" style="color:#ED155B;">&larr; Alle udstillinger</a></p>
  </div>
  ${footer(globals)}
</body>
</html>`;
}

function buildExhibitionsIndex(exhibitions: Doc<Exhibition>[], globals: Globals, introHtml = ''): string {
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
      const imgSrc = img ? (imgUrl(img)) : '';
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
  <div class="section page-top">
    <h1 class="section-heading">Udstillinger</h1>
    <div class="section-divider"></div>
    ${introHtml}
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
  const imgSrc = imgUrl(d.image);
  const meta = [d.medium, d.dimensions, d.year ? String(d.year) : ''].filter(Boolean).join(' · ');

  return `${head(d.title, globals)}
<body>
  ${nav(globals, 'galleri')}
  <div class="page-top">
    ${imgSrc ? `<img src="${esc(imgSrc)}" alt="${esc(d.title)}" style="width:100%;max-height:85vh;object-fit:contain;background:#f0ede8;padding:2rem;" />` : ''}
  </div>
  <div class="section-narrow" style="padding-top:3rem;">
    <h1 class="section-heading">${esc(d.title)}</h1>
    ${meta ? `<p style="color:var(--muted);font-size:0.9rem;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:1rem;">${esc(meta)}</p>` : ''}
    ${d.sold ? '<p style="color:#ED155B;font-weight:500;">Solgt</p>' : ''}
    ${(item.data as any).tags?.length ? `<div style="margin-top:1.5rem;">${renderTagPills((item.data as any).tags)}</div>` : ''}
    <p style="margin-top:2rem;"><a href="${BASE}/galleri/" style="color:#ED155B;">&larr; Tilbage til galleriet</a></p>
  </div>
  ${footer(globals)}
</body>
</html>`;
}

function buildPostPage(post: Doc<Post>, globals: Globals): string {
  const d = post.data;
  const imgSrc = imgUrl(d.featuredImage);

  return `${head(d.title, globals, d.excerpt)}
<body>
  ${nav(globals, 'for-tiden')}
  ${imgSrc ? `<div class="page-top"><img src="${esc(imgSrc)}" alt="" style="width:100%;max-height:420px;object-fit:cover;" /></div>` : ''}
  <article class="section${imgSrc ? '' : ' page-top'}">
    <h1 class="section-heading">${esc(d.title)}</h1>
    ${d.date ? `<p style="color:var(--muted);font-size:0.875rem;margin-bottom:2rem;">${formatDate(d.date)}</p>` : ''}
    <div class="prose" style="max-width:800px;">${markdownToHtml(d.content)}</div>
    ${d.tags && d.tags.length > 0 ? `<div style="margin-top:2rem;">${renderTagPills(d.tags)}</div>` : ''}
    <p style="margin-top:2rem;"><a href="${BASE}/for-tiden/" style="color:#ED155B;">&larr; For tiden</a></p>
  </article>
  ${footer(globals)}
</body>
</html>`;
}

function buildForTiden(page: Doc<PageData>, posts: Doc<Post>[], globals: Globals): string {
  // Show posts tagged "for-tiden", or ALL posts if none have that tag yet
  const tagged = posts.filter(p => Array.isArray(p.data.tags) && p.data.tags.includes('for-tiden'));
  const source = tagged.length > 0 ? tagged : posts;
  const sorted = [...source].sort((a, b) => (b.data.date || '').localeCompare(a.data.date || ''));
  const introSection = page.data.sections?.find(s => s._block === 'text-section');

  const cards = sorted.map(p => {
    const img = p.data.featuredImage;
    const imgSrc = img ? (imgUrl(img)) : '';
    return `
    <a class="news-card" href="${BASE}/nyheder/${p.slug}/">
      ${imgSrc ? `<img src="${esc(imgSrc)}" alt="" loading="lazy" />` : ''}
      <div class="news-cat">${esc(p.data.category || 'Nyheder')}</div>
      <h3>${esc(p.data.title)}</h3>
      <div class="news-date">${formatDate(p.data.date)}</div>
    </a>`;
  }).join('\n');

  return `${head('For tiden', globals, page.data.metaDescription)}
<body>
  ${nav(globals, 'for-tiden')}
  <div class="section page-top">
    <h1 class="section-heading">For tiden</h1>
    <div class="section-divider"></div>
    ${introSection ? `<div class="prose" style="max-width:700px;margin-bottom:3rem;">${markdownToHtml(introSection.content || '')}</div>` : ''}
    <div class="news-grid">
      ${cards}
    </div>
  </div>
  ${footer(globals)}
</body>
</html>`;
}

function buildTagsIndex(posts: Doc<Post>[], exhibitions: Doc<Exhibition>[], gallery: Doc<GalleryItem>[], pages: Doc<PageData>[], globals: Globals): string {
  const tagMap = collectAllTags(posts, exhibitions, gallery, pages);
  const sortedTags = [...tagMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const totalDocs = posts.length + exhibitions.length + gallery.length + pages.length;

  const pills = sortedTags.map(([tag, count]) =>
    `<a class="tag-pill" href="${BASE}/tags/${encodeURIComponent(tag)}/">#${esc(tag)}<span class="tag-count">${count}</span></a>`
  ).join('\n');

  return `${head('Tags', globals, 'Udforsk emner og tags på tværs af alle sider.')}
<body>
  ${nav(globals)}
  <div class="section page-top">
    <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#ED155B;margin-bottom:0.5rem;">Alle tags</p>
    <h1 class="section-heading">Udforsk emner</h1>
    <div class="section-divider"></div>
    <p style="color:var(--muted);margin-bottom:2.5rem;">${sortedTags.length} tags p&aring; tv&aelig;rs af ${totalDocs} sider</p>
    <div class="tags-cloud">
      ${pills}
    </div>
  </div>
  ${footer(globals)}
</body>
</html>`;
}

function buildTagDetail(tag: string, posts: Doc<Post>[], exhibitions: Doc<Exhibition>[], gallery: Doc<GalleryItem>[], globals: Globals): string {
  // Collect tagged items from all collections with uniform shape
  const items: { title: string; image: string; label: string; href: string; date: string }[] = [];

  for (const p of posts) {
    if (Array.isArray(p.data.tags) && p.data.tags.includes(tag)) {
      const img = p.data.featuredImage || '';
      items.push({ title: p.data.title, image: imgUrl(img), label: p.data.category || 'Nyheder', href: `${BASE}/nyheder/${p.slug}/`, date: p.data.date || '' });
    }
  }
  for (const e of exhibitions) {
    if (Array.isArray((e.data as any).tags) && (e.data as any).tags.includes(tag)) {
      const img = e.data.featuredImage || '';
      items.push({ title: e.data.title, image: imgUrl(img), label: 'Udstilling', href: `${BASE}/udstillinger/${e.slug}/`, date: e.data.startDate || '' });
    }
  }
  for (const g of gallery) {
    if (Array.isArray((g.data as any).tags) && (g.data as any).tags.includes(tag)) {
      const img = g.data.image || '';
      items.push({ title: g.data.title, image: img ? `${BASE}/${img}` : '', label: g.data.category || 'Galleri', href: `${BASE}/galleri/${g.slug}/`, date: '' });
    }
  }

  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const cards = items.map(item => `
    <a class="news-card" href="${item.href}">
      ${item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy" />` : ''}
      <div class="news-cat">${esc(item.label)}</div>
      <h3>${esc(item.title)}</h3>
      ${item.date ? `<div class="news-date">${formatDate(item.date)}</div>` : ''}
    </a>`).join('\n');

  return `${head('#' + tag, globals)}
<body>
  ${nav(globals)}
  <div class="section page-top">
    <p style="font-size:0.75rem;letter-spacing:0.1em;text-transform:uppercase;color:#ED155B;margin-bottom:0.5rem;"><a href="${BASE}/tags/" style="color:#ED155B;">&larr; Alle tags</a></p>
    <h1 class="section-heading">#${esc(tag)}</h1>
    <div class="section-divider"></div>
    <p style="color:var(--muted);margin-bottom:2.5rem;">${items.length} ${items.length === 1 ? 'resultat' : 'resultater'}</p>
    <div class="news-grid">
      ${cards}
    </div>
  </div>
  ${footer(globals)}
</body>
</html>`;
}

function buildSiteIndex(pages: Doc<PageData>[], posts: Doc<Post>[], exhibitions: Doc<Exhibition>[], gallery: Doc<GalleryItem>[], globals: Globals): string {
  const section = (title: string, items: { title: string; href: string; meta?: string }[]) => {
    if (items.length === 0) return '';
    const list = items.map(i =>
      `<li><a href="${i.href}">${esc(i.title)}</a>${i.meta ? ` <span style="color:var(--muted);font-size:0.8rem;">${esc(i.meta)}</span>` : ''}</li>`
    ).join('\n');
    return `<h2 style="font-family:var(--serif);font-size:1.5rem;font-weight:300;margin-top:2.5rem;margin-bottom:0.75rem;">${esc(title)} <span style="color:var(--muted);font-size:0.9rem;">(${items.length})</span></h2>\n<ul style="list-style:none;padding:0;">${list}</ul>`;
  };

  const pageItems = pages.map(p => ({ title: p.data.title, href: `${BASE}/${p.slug === 'forside' ? '' : p.slug + '/'}` }));
  const postItems = [...posts].sort((a, b) => (b.data.date || '').localeCompare(a.data.date || '')).map(p => ({ title: p.data.title, href: `${BASE}/nyheder/${p.slug}/`, meta: p.data.date ? formatDate(p.data.date) : '' }));
  const exItems = [...exhibitions].sort((a, b) => (b.data.year || 0) - (a.data.year || 0)).map(e => ({ title: e.data.title, href: `${BASE}/udstillinger/${e.slug}/`, meta: e.data.year ? String(e.data.year) : '' }));
  const galItems = gallery.slice(0, 100).map(g => ({ title: g.data.title, href: `${BASE}/galleri/${g.slug}/`, meta: [g.data.medium, g.data.dimensions].filter(Boolean).join(' · ') }));

  return `${head('Oversigt', globals, 'Komplet oversigt over alle sider på maurseth.dk')}
<body>
  ${nav(globals)}
  <div class="section page-top">
    <h1 class="section-heading">Oversigt</h1>
    <div class="section-divider"></div>
    <p style="color:var(--muted);margin-bottom:1rem;">${pageItems.length + postItems.length + exItems.length + gallery.length} sider i alt</p>
    <div style="max-width:800px;">
      ${section('Sider', pageItems)}
      ${section('Nyheder', postItems)}
      ${section('Udstillinger', exItems)}
      ${section('Galleri' + (gallery.length > 100 ? ' (første 100)' : ''), galItems)}
    </div>
    <p style="margin-top:2rem;"><a href="${BASE}/tags/" style="color:#ED155B;">Se alle tags &rarr;</a></p>
  </div>
  ${footer(globals)}
</body>
</html>`;
}

function buildPostsIndex(posts: Doc<Post>[], globals: Globals): string {
  const sorted = [...posts].sort((a, b) => (b.data.date || '').localeCompare(a.data.date || ''));
  const cards = sorted.map(p => {
    const imgSrc = imgUrl(p.data.featuredImage);
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
  <div class="section page-top">
    <h1 class="section-heading">Nyheder</h1>
    <div class="section-divider"></div>
    ${cards}
  </div>
  ${footer(globals)}
</body>
</html>`;
}

function buildGalleryIndex(gallery: Doc<GalleryItem>[], globals: Globals, defaultCat = 'all', introHtml = ''): string {
  const BATCH = 24;
  const sorted = [...gallery].sort((a, b) => (a.data.sortOrder || 0) - (b.data.sortOrder || 0));

  // Collect unique years across ALL items
  const years = [...new Set(sorted.map(g => g.data.year).filter(y => y > 0))].sort((a, b) => b - a);

  // All items as JSON for JS filtering
  const cardData = sorted.map(g => ({
    slug: g.slug,
    title: g.data.title,
    image: imgUrl(g.data.image),
    medium: g.data.medium || '',
    dimensions: g.data.dimensions || '',
    year: g.data.year || 0,
    category: g.data.category || 'vaerker',
  }));

  // First batch HTML (SEO fallback) — filtered by default category
  const initialFiltered = defaultCat === 'all' ? sorted : sorted.filter(g => g.data.category === defaultCat);
  const initialCards = initialFiltered.slice(0, BATCH).map(g => {
    const imgSrc = imgUrl(g.data.image);
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

  return `${head('Galleri', globals)}
<body>
  ${nav(globals, 'galleri')}
  <div class="section page-top">
    <h1 class="section-heading">Galleri</h1>
    <div class="section-divider"></div>
    ${introHtml}
    <div class="gallery-filters">
      <button class="gallery-tab${defaultCat === 'all' ? ' active' : ''}" onclick="selectCat('all',this)">Alle</button>
      <button class="gallery-tab${defaultCat === 'vaerker' ? ' active' : ''}" onclick="selectCat('vaerker',this)">Værker</button>
      <button class="gallery-tab${defaultCat === 'grafik' ? ' active' : ''}" onclick="selectCat('grafik',this)">Grafik</button>
      <button class="gallery-tab${defaultCat === 'collager' ? ' active' : ''}" onclick="selectCat('collager',this)">Collager</button>
      <div class="year-dropdown" id="yearDropdown">
        <button class="year-dropdown-toggle" id="yearToggle" onclick="toggleYearDropdown()">Alle år</button>
        <div class="year-dropdown-menu"><div class="year-dropdown-menu-inner">
          <button class="active" onclick="selectYear('all',this)">Alle år</button>
          ${years.map(y => `<button onclick="selectYear('${y}',this)">${y}</button>`).join('\n          ')}
        </div></div>
      </div>
    </div>
    <div id="galleryCount" style="font-size:0.8rem;color:var(--muted);margin-bottom:1rem;">${initialFiltered.length} v&aelig;rker</div>
    <div class="gallery-grid" id="galleryGrid">
      ${initialCards}
    </div>
    ${initialFiltered.length > BATCH ? `<button class="load-more-btn" id="loadMoreBtn" onclick="loadMore()">Vis flere (${initialFiltered.length - BATCH} tilbage)</button>` : ''}
  </div>
  ${footer(globals)}
  <script>
  (function(){
    var BASE = ${JSON.stringify(BASE)};
    var allItems = ${JSON.stringify(cardData)};
    var shown = ${BATCH};
    var BATCH = ${BATCH};
    var currentYear = 'all';
    var currentCat = '${defaultCat}';
    var grid = document.getElementById('galleryGrid');
    var btn = document.getElementById('loadMoreBtn');
    var countEl = document.getElementById('galleryCount');

    function makeCard(item) {
      var meta = [item.medium, item.dimensions].filter(Boolean).join(' \\u00B7 ');
      return '<a class="gallery-item" href="' + BASE + '/galleri/' + item.slug + '/">'
        + (item.image ? '<img src="' + item.image + '" alt="' + item.title.replace(/"/g,'&quot;') + '" loading="lazy" />' : '')
        + '<div class="gallery-overlay"><h3>' + item.title.replace(/</g,'&lt;') + '</h3>'
        + (meta ? '<span class="meta">' + meta.replace(/</g,'&lt;') + '</span>' : '')
        + '</div></a>';
    }

    function getFiltered() {
      return allItems.filter(function(i) {
        var catOk = currentCat === 'all' || i.category === currentCat;
        var yearOk = currentYear === 'all' || i.year === parseInt(currentYear);
        return catOk && yearOk;
      });
    }

    function render(items, count) {
      var html = '';
      for (var i = 0; i < Math.min(count, items.length); i++) html += makeCard(items[i]);
      grid.innerHTML = html;
      countEl.textContent = items.length + ' værker';
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
      shown += BATCH;
      render(getFiltered(), shown);
    };

    function applyFilters() {
      shown = BATCH;
      render(getFiltered(), shown);
    }

    window.selectCat = function(cat, el) {
      currentCat = cat;
      document.querySelectorAll('.gallery-tab').forEach(function(b) { b.classList.remove('active'); });
      el.classList.add('active');
      applyFilters();
    };

    window.selectYear = function(year, el) {
      currentYear = year;
      var toggle = document.getElementById('yearToggle');
      toggle.textContent = year === 'all' ? 'Alle år' : year;
      toggle.className = 'year-dropdown-toggle' + (year !== 'all' ? ' active' : '');
      document.getElementById('yearDropdown').classList.remove('open');
      document.getElementById('yearDropdown').querySelectorAll('.year-dropdown-menu-inner button').forEach(function(b) { b.classList.remove('active'); });
      el.classList.add('active');
      applyFilters();
    };

    window.toggleYearDropdown = function() {
      document.getElementById('yearDropdown').classList.toggle('open');
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

  // Copy static assets (logo, favicon — not in uploads, safe from deletion)
  const ASSETS_SRC = join(ROOT, 'public', 'assets');
  if (existsSync(ASSETS_SRC)) {
    cpSync(ASSETS_SRC, join(DIST, 'assets'), { recursive: true });
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
    'for-tiden': 'for-tiden',
    'kontakt': 'kontakt',
    'atelier': 'kontakt',
    'nyheder': 'nyheder',
  };

  // Home page (custom builder)
  writeFile(join(DIST, 'index.html'), buildHome(globals, gallery, exhibitions, posts));

  for (const page of pages) {
    const route = pageRoutes[page.slug];
    if (!route) continue;
    if (page.slug === 'forside') continue; // Built above with custom buildHome
    if (page.slug === 'nyheder') continue; // Built separately with post listing
    if (page.slug === 'for-tiden') continue; // Built separately with posts grid
    if (page.slug === 'galleri' || page.slug === 'collager') continue; // Built separately with gallery grid

    const outPath = join(DIST, route.slice(1), 'index.html');
    writeFile(outPath, buildPage(page, globals, gallery, exhibitions, activeMap[page.slug]));
  }

  // Gallery: render intro from CMS page content
  const galleriPage = pages.find(p => p.slug === 'galleri');
  const galleriIntroBlock = galleriPage?.data.sections?.find((s: Section) => s._block === 'text-section');
  const galleriIntro = galleriIntroBlock?.content
    ? `<div class="prose" style="max-width:700px;margin-bottom:2.5rem;">${markdownToHtml(galleriIntroBlock.content)}</div>`
    : '';

  // /galleri/ redirects to /galleri/vaerker/
  writeFile(join(DIST, 'galleri', 'index.html'), `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${BASE}/galleri/vaerker/"></head></html>`);
  writeFile(join(DIST, 'galleri', 'vaerker', 'index.html'), buildGalleryIndex(gallery, globals, 'vaerker', galleriIntro));
  writeFile(join(DIST, 'galleri', 'grafik', 'index.html'), buildGalleryIndex(gallery, globals, 'grafik', galleriIntro));
  writeFile(join(DIST, 'galleri', 'collager', 'index.html'), buildGalleryIndex(gallery, globals, 'collager', galleriIntro));

  // Gallery detail pages (skip empty slugs)
  for (const item of gallery) {
    if (!item.slug) { console.warn(`  ⚠ Skipping gallery item with empty slug: ${item.data.title}`); continue; }
    writeFile(join(DIST, 'galleri', item.slug, 'index.html'), buildGalleryDetail(item, globals));
  }
  console.log(`  ${gallery.length} gallery detail pages`);

  // "For Tiden" page (intro + all posts as cards)
  const forTidenPage = pages.find(p => p.slug === 'for-tiden');
  if (forTidenPage) {
    writeFile(join(DIST, 'for-tiden', 'index.html'), buildForTiden(forTidenPage, posts, globals));
  }

  // News index
  writeFile(join(DIST, 'nyheder', 'index.html'), buildPostsIndex(posts, globals));

  // Individual post pages
  for (const post of posts) {
    writeFile(join(DIST, 'nyheder', post.slug, 'index.html'), buildPostPage(post, globals));
  }
  console.log(`  ${posts.length} post pages`);

  // Site index
  writeFile(join(DIST, 'siteoversigt', 'index.html'), buildSiteIndex(pages, posts, exhibitions, gallery, globals));

  // Tags index page
  writeFile(join(DIST, 'tags', 'index.html'), buildTagsIndex(posts, exhibitions, gallery, pages, globals));

  // Tag detail pages
  const allTags = collectAllTags(posts, exhibitions, gallery, pages);
  for (const [tag] of allTags) {
    writeFile(join(DIST, 'tags', encodeURIComponent(tag), 'index.html'), buildTagDetail(tag, posts, exhibitions, gallery, globals));
  }
  console.log(`  ${allTags.size} tag pages`);

  // Exhibition index
  // Exhibition index with intro from CMS page content
  const exPage = pages.find(p => p.slug === 'udstillinger');
  const exIntroBlock = exPage?.data.sections?.find((s: Section) => s._block === 'text-section');
  const exIntro = exIntroBlock?.content
    ? `<div class="prose" style="max-width:700px;margin-bottom:2.5rem;">${markdownToHtml(exIntroBlock.content)}</div>`
    : '';
  writeFile(join(DIST, 'udstillinger', 'index.html'), buildExhibitionsIndex(exhibitions, globals, exIntro));

  // Exhibition detail pages
  for (const ex of exhibitions) {
    writeFile(join(DIST, 'udstillinger', ex.slug, 'index.html'), buildExhibitionDetail(ex, globals, exhibitions));
  }
  console.log(`  ${exhibitions.length} exhibition detail pages`);

  const totalPages = pages.length + gallery.length + posts.length + exhibitions.length + allTags.size + 5;
  console.log(`\n✅ Done! ${totalPages} pages → ${DIST.replace(ROOT + '/', '')}/`);
}

build();
