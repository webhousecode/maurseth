/**
 * WordPress → @webhouse/cms migration script for maurseth.dk
 *
 * Fetches ALL content from the WP REST API (no auth needed):
 * - 11 pages, 34 posts, ~60 exhibitions, ~913 media files
 * - Downloads all media to media/
 * - Converts to CMS JSON format in content/
 *
 * Run: npx tsx scripts/migrate.ts
 */

import { writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const ROOT = dirname(import.meta.dirname ?? new URL('.', import.meta.url).pathname);
const CONTENT = join(ROOT, 'content');
const MEDIA = join(ROOT, 'media');
const WP = 'https://www.maurseth.dk/wp-json/wp/v2';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  ✓ ${filePath.replace(ROOT + '/', '')}`);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ä/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function generateId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = '';
  for (let i = 0; i < 21; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/** Strip HTML tags, decode entities */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
    .trim();
}

/** Convert WP HTML content to markdown-ish text for richtext fields */
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html;

  // Remove WP-specific wrappers
  md = md.replace(/<!--.*?-->/gs, '');
  md = md.replace(/<div[^>]*class="[^"]*wp-block[^"]*"[^>]*>/gi, '');
  md = md.replace(/<\/div>/gi, '');

  // Headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');

  // Bold/italic
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Images — rewrite WP URLs to local media paths
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Lists
  md = md.replace(/<ul[^>]*>/gi, '');
  md = md.replace(/<\/ul>/gi, '\n');
  md = md.replace(/<ol[^>]*>/gi, '');
  md = md.replace(/<\/ol>/gi, '\n');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

  // Paragraphs and line breaks
  md = md.replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Figures
  md = md.replace(/<figure[^>]*>/gi, '');
  md = md.replace(/<\/figure>/gi, '');
  md = md.replace(/<figcaption[^>]*>(.*?)<\/figcaption>/gi, '*$1*\n');

  // Strip remaining HTML
  md = md.replace(/<[^>]+>/g, '');

  // Decode entities
  md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ');

  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}

/** Rewrite WP media URLs to local paths */
function rewriteMediaUrls(text: string, mediaMap: Map<string, string>): string {
  let result = text;
  for (const [wpUrl, localPath] of mediaMap) {
    result = result.replaceAll(wpUrl, localPath);
  }
  // Also catch URLs with different sizes (-300x200, -1024x768, etc.)
  result = result.replace(
    /https?:\/\/(?:www\.)?maurseth\.dk\/wp-content\/uploads\/[^\s"')]+/g,
    (url) => {
      // Try to find in map
      if (mediaMap.has(url)) return mediaMap.get(url)!;
      // Strip size suffix and try again
      const base = url.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
      if (mediaMap.has(base)) return mediaMap.get(base)!;
      // Also try legacy domain
      return url;
    }
  );
  result = result.replace(
    /https?:\/\/maurseth\.vader2\.webhouse\.net\/wp-content\/uploads\/[^\s"')]+/g,
    (url) => {
      if (mediaMap.has(url)) return mediaMap.get(url)!;
      const base = url.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
      if (mediaMap.has(base)) return mediaMap.get(base)!;
      return url;
    }
  );
  return result;
}

// ---------------------------------------------------------------------------
// WP API fetchers
// ---------------------------------------------------------------------------

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'webhouse-cms-migration/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function fetchAllPaginated(endpoint: string, perPage = 100): Promise<any[]> {
  const items: any[] = [];
  let page = 1;
  while (true) {
    const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=${perPage}&page=${page}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'webhouse-cms-migration/1.0' },
    });
    if (!res.ok) {
      if (res.status === 400) break; // Past last page
      throw new Error(`HTTP ${res.status}: ${url}`);
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    items.push(...data);
    const totalPages = parseInt(res.headers.get('X-WP-TotalPages') ?? '1');
    console.log(`  Page ${page}/${totalPages} (${items.length} items)`);
    if (page >= totalPages) break;
    page++;
  }
  return items;
}

async function downloadFile(url: string, dest: string): Promise<boolean> {
  if (existsSync(dest)) return true; // Already downloaded
  try {
    ensureDir(dirname(dest));
    const res = await fetch(url, {
      headers: { 'User-Agent': 'webhouse-cms-migration/1.0' },
      redirect: 'follow',
    });
    if (!res.ok || !res.body) return false;
    const ws = createWriteStream(dest);
    await pipeline(Readable.fromWeb(res.body as any), ws);
    return true;
  } catch (err) {
    console.warn(`  ⚠ Failed to download: ${url}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Migration steps
// ---------------------------------------------------------------------------

async function migrateMedia(): Promise<Map<string, string>> {
  console.log('\n📸 Fetching media...');
  const mediaItems = await fetchAllPaginated(`${WP}/media`);
  console.log(`  Found ${mediaItems.length} media items`);

  ensureDir(MEDIA);
  const urlMap = new Map<string, string>();

  // Download in batches of 10
  const batchSize = 10;
  for (let i = 0; i < mediaItems.length; i += batchSize) {
    const batch = mediaItems.slice(i, i + batchSize);
    await Promise.all(batch.map(async (item: any) => {
      const sourceUrl: string = item.source_url;
      const ext = extname(sourceUrl).split('?')[0] || '.jpg';
      const filename = `${item.id}-${slugify(item.slug || item.title?.rendered || String(item.id))}${ext}`;
      const dest = join(MEDIA, filename);
      const localPath = `media/${filename}`;

      const ok = await downloadFile(sourceUrl, dest);
      if (ok) {
        urlMap.set(sourceUrl, localPath);
        // Also map common WP URL variants
        if (sourceUrl.includes('www.maurseth.dk')) {
          urlMap.set(sourceUrl.replace('www.maurseth.dk', 'maurseth.dk'), localPath);
        }
      }
    }));
    process.stdout.write(`  Downloaded ${Math.min(i + batchSize, mediaItems.length)}/${mediaItems.length}\r`);
  }
  console.log(`\n  ✓ Downloaded ${urlMap.size} media files`);
  return urlMap;
}

async function migrateTaxonomies(): Promise<{ yearMap: Map<number, string>; typeMap: Map<number, string> }> {
  console.log('\n🏷️  Fetching taxonomies...');
  const yearMap = new Map<number, string>();
  const typeMap = new Map<number, string>();

  try {
    const years = await fetchJson(`${WP}/arstid?per_page=100`);
    for (const y of years) yearMap.set(y.id, y.name);
    console.log(`  ✓ ${yearMap.size} year terms`);
  } catch { console.log('  ⚠ No year taxonomy'); }

  try {
    const types = await fetchJson(`${WP}/type_indlog?per_page=100`);
    for (const t of types) typeMap.set(t.id, t.name);
    console.log(`  ✓ ${typeMap.size} type terms`);
  } catch { console.log('  ⚠ No type taxonomy'); }

  return { yearMap, typeMap };
}

async function migratePages(mediaMap: Map<string, string>) {
  console.log('\n📄 Fetching pages...');
  const pages = await fetchJson(`${WP}/pages?per_page=100`);
  console.log(`  Found ${pages.length} pages`);

  const slugMap: Record<string, string> = {
    'forside': 'forside',
    'billedkunstner-grethe-mariann-maurseths-profil': 'profil',
    'cv': 'cv',
    'galleri': 'galleri',
    'collager': 'collager',
    'aktuelle-og-kommende-udstillinger': 'udstillinger',
    'for-tiden': 'for-tiden',
    'kontakt': 'kontakt',
    'mit-atelier': 'atelier',
    'nyheder': 'nyheder',
  };

  for (const page of pages) {
    const wpSlug = page.slug;
    const slug = slugMap[wpSlug] || slugify(page.title?.rendered || wpSlug);
    const title = stripHtml(page.title?.rendered || '');
    const rawContent = page.content?.rendered || '';
    const content = rewriteMediaUrls(htmlToMarkdown(rawContent), mediaMap);

    // Determine featured image
    let featuredImage = '';
    if (page.featured_media && page._embedded?.['wp:featuredmedia']?.[0]) {
      const media = page._embedded['wp:featuredmedia'][0];
      featuredImage = mediaMap.get(media.source_url) || media.source_url;
    }

    // Build sections based on page type
    const sections: any[] = [];

    if (slug === 'forside') {
      sections.push({
        _block: 'hero',
        image: featuredImage,
        title: 'Grethe Mariann Maurseth',
        subtitle: 'Billedkunstner',
      });
      if (content) {
        sections.push({ _block: 'text-section', heading: '', content });
      }
      sections.push({
        _block: 'artwork-grid',
        heading: 'Udvalgte værker',
        category: 'all',
        maxItems: 6,
      });
    } else if (slug === 'profil') {
      sections.push({
        _block: 'profile',
        heading: title,
        bio: content,
        portraitImage: featuredImage,
      });
    } else if (slug === 'cv') {
      sections.push({ _block: 'cv-section', heading: 'CV', content });
    } else if (slug === 'galleri') {
      sections.push({ _block: 'artwork-grid', heading: 'Værker', category: 'vaerker', maxItems: 0 });
      sections.push({ _block: 'artwork-grid', heading: 'Grafik', category: 'grafik', maxItems: 0 });
    } else if (slug === 'collager') {
      sections.push({ _block: 'artwork-grid', heading: 'Collager', category: 'collager', maxItems: 0 });
    } else if (slug === 'udstillinger') {
      sections.push({ _block: 'exhibition-list', heading: 'Udstillinger', showYears: '' });
    } else if (slug === 'kontakt') {
      sections.push({
        _block: 'contact-info',
        heading: 'Kontakt',
        address: 'Dannebrogsgade 41b, baghuset\n9000 Aalborg',
        email: 'grethe@maurseth.dk',
        phone: '+45 22 95 22 27',
      });
      if (content) sections.push({ _block: 'text-section', heading: '', content });
    } else if (slug === 'atelier') {
      if (featuredImage) {
        sections.push({ _block: 'hero', image: featuredImage, title: 'Mit Atelier', subtitle: '' });
      }
      sections.push({ _block: 'text-section', heading: title, content });
    } else {
      // Generic page
      if (content) sections.push({ _block: 'text-section', heading: title, content });
    }

    const doc = {
      slug,
      status: 'published',
      data: {
        title,
        metaDescription: stripHtml(page.excerpt?.rendered || '').slice(0, 160),
        sections,
      },
      id: generateId(),
      _fieldMeta: {},
    };

    writeJson(join(CONTENT, 'pages', `${slug}.json`), doc);
  }
}

async function migratePosts(mediaMap: Map<string, string>, typeMap: Map<number, string>) {
  console.log('\n📝 Fetching posts...');
  const posts = await fetchAllPaginated(`${WP}/posts?_embed`);
  console.log(`  Found ${posts.length} posts`);

  for (const post of posts) {
    const slug = slugify(post.slug || post.title?.rendered || '');
    const title = stripHtml(post.title?.rendered || '');
    const rawContent = post.content?.rendered || '';
    const content = rewriteMediaUrls(htmlToMarkdown(rawContent), mediaMap);
    const excerpt = stripHtml(post.excerpt?.rendered || '').slice(0, 300);

    // Resolve category from taxonomy
    const typeTerms: number[] = post.type_indlog || [];
    let category = 'nyheder';
    for (const tid of typeTerms) {
      const name = typeMap.get(tid);
      if (name) {
        const lc = name.toLowerCase();
        if (lc.includes('udstilling')) category = 'udstilling';
        else if (lc.includes('arrangement')) category = 'arrangement';
        else if (lc.includes('workshop')) category = 'workshop';
        else if (lc.includes('kursus')) category = 'kursus';
      }
    }

    // Featured image
    let featuredImage = '';
    if (post._embedded?.['wp:featuredmedia']?.[0]) {
      const media = post._embedded['wp:featuredmedia'][0];
      featuredImage = mediaMap.get(media.source_url) || media.source_url;
    }

    const doc = {
      slug,
      status: 'published',
      data: {
        title,
        date: post.date?.split('T')[0] || '',
        excerpt,
        content,
        featuredImage,
        category,
        tags: [] as string[],
      },
      id: generateId(),
      _fieldMeta: {},
    };

    writeJson(join(CONTENT, 'posts', `${slug}.json`), doc);
  }
}

async function migrateExhibitions(mediaMap: Map<string, string>, yearMap: Map<number, string>) {
  console.log('\n🖼️  Fetching exhibitions...');
  const exhibitions = await fetchAllPaginated(`${WP}/udstilling?_embed`);
  console.log(`  Found ${exhibitions.length} exhibitions`);

  for (const ex of exhibitions) {
    const slug = slugify(ex.slug || ex.title?.rendered || '');
    const title = stripHtml(ex.title?.rendered || '');
    const rawContent = ex.content?.rendered || '';
    const description = rewriteMediaUrls(htmlToMarkdown(rawContent), mediaMap);

    // Resolve year from taxonomy
    const yearTerms: number[] = ex.arstid || [];
    let year = 0;
    for (const yid of yearTerms) {
      const yName = yearMap.get(yid);
      if (yName) {
        const parsed = parseInt(yName);
        if (!isNaN(parsed)) year = parsed;
      }
    }
    if (!year && ex.date) year = new Date(ex.date).getFullYear();

    // Featured image
    let featuredImage = '';
    if (ex._embedded?.['wp:featuredmedia']?.[0]) {
      const media = ex._embedded['wp:featuredmedia'][0];
      featuredImage = mediaMap.get(media.source_url) || media.source_url;
    }

    const doc = {
      slug,
      status: 'published',
      data: {
        title,
        year,
        venue: '',
        location: '',
        description,
        featuredImage,
        startDate: ex.date?.split('T')[0] || '',
        endDate: '',
        category: 'udstilling',
      },
      id: generateId(),
      _fieldMeta: {},
    };

    writeJson(join(CONTENT, 'exhibitions', `${slug}.json`), doc);
  }
}

async function migrateGallery(mediaItems: any[], mediaMap: Map<string, string>) {
  console.log('\n🎨 Creating gallery items from media...');

  // Filter media that look like artwork (by title patterns)
  const artworkPatterns = /akryl|olie|grafik|collage|litografi|radering|tryk|papir|lærred|mixed media|tempera|akvarel|blandteknik|\d+\s*x\s*\d+/i;
  let order = 0;

  for (const item of mediaItems) {
    const title = stripHtml(item.title?.rendered || '');
    const alt = item.alt_text || '';
    const desc = stripHtml(item.description?.rendered || '');
    const caption = stripHtml(item.caption?.rendered || '');
    const combined = `${title} ${alt} ${desc} ${caption}`;

    // Only include items that look like artwork
    if (!artworkPatterns.test(combined) && !title) continue;

    const localPath = mediaMap.get(item.source_url);
    if (!localPath) continue;

    // Parse dimensions from title (e.g., "100 x 100", "65 x 135")
    const dimMatch = combined.match(/(\d+)\s*x\s*(\d+)/i);
    const dimensions = dimMatch ? `${dimMatch[1]} x ${dimMatch[2]}` : '';

    // Parse medium from title
    let medium = '';
    if (/akryl/i.test(combined)) medium = 'Akryl';
    else if (/olie/i.test(combined)) medium = 'Olie';
    else if (/litografi/i.test(combined)) medium = 'Litografi';
    else if (/radering/i.test(combined)) medium = 'Radering';
    else if (/collage/i.test(combined)) medium = 'Collage';
    else if (/grafik/i.test(combined)) medium = 'Grafik';
    else if (/mixed media|blandteknik/i.test(combined)) medium = 'Mixed media';
    else if (/tempera/i.test(combined)) medium = 'Tempera';
    else if (/akvarel/i.test(combined)) medium = 'Akvarel';
    else if (/tryk/i.test(combined)) medium = 'Tryk';

    // Determine category
    let category = 'vaerker';
    if (/collage/i.test(combined)) category = 'collager';
    else if (/grafik|litografi|radering|tryk/i.test(combined)) category = 'grafik';

    // Clean title (remove dimensions and medium from title)
    let cleanTitle = title
      .replace(/\d+\s*x\s*\d+/gi, '')
      .replace(/akryl|olie|grafik|litografi|radering|collage|mixed media|tempera|akvarel|tryk|pa |på |papir|lærred/gi, '')
      .replace(/[,\s]+$/g, '')
      .trim();
    if (!cleanTitle) cleanTitle = title;

    const slug = slugify(cleanTitle || `artwork-${item.id}`);

    const doc = {
      slug,
      status: 'published',
      data: {
        title: cleanTitle || title,
        medium,
        dimensions,
        year: item.date ? new Date(item.date).getFullYear() : 0,
        image: localPath,
        sold: false,
        category,
        sortOrder: order++,
      },
      id: generateId(),
      _fieldMeta: {},
    };

    writeJson(join(CONTENT, 'gallery', `${slug}.json`), doc);
  }
}

async function createGlobals(mediaMap: Map<string, string>) {
  console.log('\n⚙️  Creating globals...');

  const doc = {
    slug: 'site',
    status: 'published',
    data: {
      siteName: 'Maurseth',
      artistName: 'Grethe Mariann Maurseth',
      artistTitle: 'Billedkunstner',
      email: 'grethe@maurseth.dk',
      phone: '+45 22 95 22 27',
      studioAddress: 'Dannebrogsgade 41b, baghuset\n9000 Aalborg',
      postAddress: 'Hasserisvej 148\n9000 Aalborg',
      instagramUrl: 'https://www.instagram.com/grethe_maurseth/',
      facebookUrl: 'https://www.facebook.com/GretheMariannMaurseth',
      heroImage: '',
      logoImage: '',
      footerText: '© Grethe Mariann Maurseth. Alle rettigheder forbeholdes.',
      metaDescription: 'Grethe Mariann Maurseth — billedkunstner i Aalborg. Akrylmalerier, grafik og collager.',
    },
    id: generateId(),
    _fieldMeta: {},
  };

  writeJson(join(CONTENT, 'globals', 'site.json'), doc);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🚀 Starting WordPress → @webhouse/cms migration for maurseth.dk\n');

  // Step 1: Taxonomies
  const { yearMap, typeMap } = await migrateTaxonomies();

  // Step 2: Media (download all)
  const mediaMap = await migrateMedia();

  // Step 3: Fetch all media items again for gallery extraction
  console.log('\n🎨 Re-fetching media metadata for gallery...');
  const allMedia = await fetchAllPaginated(`${WP}/media`);

  // Step 4: Pages
  await migratePages(mediaMap);

  // Step 5: Posts
  await migratePosts(mediaMap, typeMap);

  // Step 6: Exhibitions
  await migrateExhibitions(mediaMap, yearMap);

  // Step 7: Gallery items from media
  await migrateGallery(allMedia, mediaMap);

  // Step 8: Globals
  await createGlobals(mediaMap);

  console.log('\n✅ Migration complete!');
  console.log(`   Media: ${mediaMap.size} files in media/`);
  console.log('   Run "npx tsx build.ts" to generate the static site.');
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
