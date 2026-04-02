/**
 * scrape-images.js — Men's Style Taxonomy image scraper
 * Uses DuckDuckGo Image Search (no auth required) to find and download
 * the best fashion images for each style, stored in images/{style-id}/
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const OUT_DIR = path.join(__dirname, 'images');
const IMAGES_PER_STYLE = 5;

// ── Quality scoring weights ───────────────────────────────────────────────────
// We score each candidate image and take the top N.
// Higher score = better fit for a fashion reference site.

const PREFERRED_SOURCES = ['pinterest', 'instagram', 'vogue', 'gq.com', 'fashionbeans', 'mrporter', 'hm.com', 'zara.com', 'nordstrom', 'lookbook', 'hypebeast', 'complex', 'grailed', 'farfetch'];
const BLOCKED_SOURCES   = ['ebay', 'amazon', 'walmart', 'aliexpress', 'dhgate', 'wish.com', 'temu', 'facebook', 'reddit', 'youtube', 'tiktok'];
const BLOCKED_EXTS      = ['.gif', '.svg', '.webm', '.mp4'];

function scoreImage(img, query) {
  let score = 0;

  // Portrait orientation preferred for fashion
  const ratio = img.height / img.width;
  if (ratio > 1.0) score += 20;       // portrait
  if (ratio > 1.2) score += 10;       // clearly portrait
  if (ratio > 2.0) score -= 15;       // too tall / banner

  // Resolution
  const px = img.width * img.height;
  if (px > 600000) score += 15;       // high res
  if (px > 300000) score += 10;       // decent res
  if (px < 40000)  score -= 30;       // thumbnail-only

  // Source quality
  const src = (img.source || img.url || '').toLowerCase();
  if (PREFERRED_SOURCES.some(s => src.includes(s))) score += 25;
  if (BLOCKED_SOURCES.some(s => src.includes(s)))  score -= 40;

  // Format
  if (img.url.match(/\.(jpg|jpeg)$/i)) score += 5;
  if (img.url.match(/\.(png)$/i))      score += 3;
  if (BLOCKED_EXTS.some(e => img.url.toLowerCase().endsWith(e))) score -= 100;

  // Etsy, stock sites: OK but not as good as editorial
  if (src.includes('etsy') || src.includes('shutterstock') || src.includes('getty') || src.includes('alamy')) score += 5;

  return score;
}

// ── DuckDuckGo search ─────────────────────────────────────────────────────────
function httpGet(reqUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(reqUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    lib.get(reqUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        ...headers,
      },
      timeout: 15000,
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

async function getDDGVqd(query) {
  const r = await httpGet(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`);
  const m = r.body.match(/vqd=([\d-]+)/);
  return m ? m[1] : null;
}

async function searchDDG(query, page = 0) {
  const vqd = await getDDGVqd(query);
  if (!vqd) throw new Error('Could not get DDG VQD token');

  const start = page * 100;
  const apiUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&p=1&s=${start}&u=bing&f=,,,&l=us-en&vqd=${vqd}`;
  const r = await httpGet(apiUrl, { Referer: 'https://duckduckgo.com/' });
  if (r.status !== 200) throw new Error(`DDG API status ${r.status}`);
  const data = JSON.parse(r.body);
  return data.results || [];
}

// ── Download an image ─────────────────────────────────────────────────────────
function downloadImage(imgUrl, dest) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(imgUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const file = fs.createWriteStream(dest);
    const req = lib.get(imgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
        'Referer': 'https://duckduckgo.com/',
      },
      timeout: 20000,
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        file.close(); fs.unlinkSync(dest);
        downloadImage(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close(); fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const ct = res.headers['content-type'] || '';
      if (!ct.startsWith('image/') && !ct.startsWith('application/octet')) {
        file.close(); fs.unlinkSync(dest);
        return reject(new Error(`Not image: ${ct}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('error', err => { file.close(); try { fs.unlinkSync(dest); } catch(_){} reject(err); });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

// ── Process one style ─────────────────────────────────────────────────────────
async function scrapeStyle(style) {
  const styleDir = path.join(OUT_DIR, style.id);
  ensureDir(styleDir);

  const existing = fs.readdirSync(styleDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  if (existing.length >= IMAGES_PER_STYLE) {
    console.log(`  [${style.id}] already complete (${existing.length} images)`);
    return existing.map(f => `images/${style.id}/${f}`);
  }

  let candidates = [];

  for (const query of style.queries) {
    console.log(`  searching: "${query}"`);
    try {
      const results = await searchDDG(query);
      // Score and filter
      const scored = results
        .filter(img => img.image && !BLOCKED_EXTS.some(e => img.image.toLowerCase().endsWith(e)))
        .map(img => ({ ...img, score: scoreImage({ url: img.image, width: img.width, height: img.height, source: img.url }, query) }))
        .filter(img => img.score > 0)
        .sort((a, b) => b.score - a.score);

      console.log(`    ${results.length} results → ${scored.length} viable (top score: ${scored[0]?.score ?? 'n/a'})`);
      candidates.push(...scored);
    } catch (e) {
      console.log(`    search error: ${e.message}`);
    }
    await sleep(800);
  }

  // Deduplicate by URL
  const seen = new Set();
  candidates = candidates.filter(c => {
    if (seen.has(c.image)) return false;
    seen.add(c.image);
    return true;
  }).sort((a, b) => b.score - a.score);

  console.log(`  ${candidates.length} unique candidates, downloading top ${IMAGES_PER_STYLE}…`);

  const saved = [];
  for (const candidate of candidates) {
    if (saved.length >= IMAGES_PER_STYLE) break;

    const ext = (candidate.image.match(/\.(jpe?g|png|webp)/i) || ['.jpg'])[0].toLowerCase().replace('jpeg', 'jpg');
    const idx = saved.length + 1;
    const dest = path.join(styleDir, `${idx}${ext}`);

    try {
      await downloadImage(candidate.image, dest);
      const stat = fs.statSync(dest);
      if (stat.size < 8000) { // < 8KB is probably a broken/placeholder image
        fs.unlinkSync(dest);
        console.log(`    [${idx}] skip — too small (${stat.size}B): ${candidate.image.slice(0, 70)}`);
        continue;
      }
      saved.push(`images/${style.id}/${idx}${ext}`);
      console.log(`    [${idx}] ✓ ${Math.round(stat.size/1024)}KB score=${candidate.score} ${candidate.image.slice(0, 70)}`);
    } catch (e) {
      console.log(`    [${idx}] err: ${e.message.slice(0, 60)} — ${candidate.image.slice(0, 60)}`);
    }
    await sleep(300);
  }

  console.log(`  → ${saved.length}/${IMAGES_PER_STYLE} images saved`);
  return saved;
}

// ── All styles ────────────────────────────────────────────────────────────────
const STYLES = [
  { id: 'black-tie',    queries: ['black tie tuxedo men fashion outfit', 'men formal tuxedo bow tie dinner jacket'] },
  { id: 'power-suit',   queries: ['power suit men tailored formal office fashion', 'mens sharp business suit professional'] },
  { id: 'ivy-league',   queries: ['ivy league preppy men fashion blazer chinos', 'preppy mens style oxford shirt loafers lookbook'] },
  { id: 'old-money',    queries: ['old money quiet luxury mens fashion neutral', 'quiet luxury men minimalist cashmere beige'] },
  { id: 'dark-academia',queries: ['dark academia men fashion tweed blazer autumn', 'academic aesthetic men cardigan brogues lookbook'] },
  { id: 'smart-casual', queries: ['smart casual men outfit blazer jeans', 'mens smart casual style polished everyday fashion'] },
  { id: 'normcore',     queries: ['normcore men fashion plain white tee straight jeans', 'minimalist basic men outfit neutral no logo'] },
  { id: 'americana',    queries: ['americana heritage workwear men raw denim boots', 'americana style men selvedge denim flannel chore coat'] },
  { id: 'streetwear',   queries: ['streetwear men hoodie cargo pants sneakers urban', 'hypebeast street style men oversized fit fashion'] },
  { id: 'hip-hop',      queries: ['hip hop fashion men baggy urban gold jewelry', '90s hiphop style men timberland boots lookbook'] },
  { id: 'punk-rock',    queries: ['punk rock men leather jacket studs band tee', 'rock style men leather jacket combat boots chains aesthetic'] },
  { id: 'gothic',       queries: ['gothic men fashion all black velvet platform boots', 'goth men dark aesthetic layered black fashion'] },
  { id: 'gorpcore',     queries: ['gorpcore men outdoor technical jacket trail runners fashion', 'outdoor technical gear men fashion arcteryx patagonia'] },
  { id: 'techwear',     queries: ['techwear men black technical jacket cargo pants', 'futuristic dark fashion men tactical urban aesthetic'] },
  { id: 'military',     queries: ['military style men jacket cargo olive khaki fashion', 'utilitarian men fashion field jacket army surplus look'] },
  { id: 'tropical',     queries: ['tropical resort wear men hawaiian shirt linen', 'men resort beach fashion bright tropical print summer'] },
  { id: 'nautical',     queries: ['nautical men style breton stripe shirt navy outfit', 'coastal preppy men sailing fashion navy boat shoes'] },
  { id: 'bohemian',     queries: ['bohemian style men linen shirt loose earth tones', 'boho free spirit men fashion layered natural fabric'] },
  { id: 'grunge',       queries: ['grunge men fashion flannel shirt ripped jeans dr martens', '90s grunge style men distressed denim band tee lookbook'] },
  { id: 'cottagecore',  queries: ['cottagecore men fashion tweed waistcoat linen countryside', 'rural mens style corduroy gingham natural earthy outfit'] },
];

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  ensureDir(OUT_DIR);
  const manifest = {};

  for (const style of STYLES) {
    console.log(`\n══ ${style.id} ══`);
    manifest[style.id] = await scrapeStyle(style);
    await sleep(1000);
  }

  fs.writeFileSync(path.join(__dirname, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\n\nDone. Manifest written.');

  const total = Object.values(manifest).reduce((n, arr) => n + arr.length, 0);
  console.log(`Total images: ${total}/${STYLES.length * IMAGES_PER_STYLE}`);
  for (const [id, imgs] of Object.entries(manifest)) {
    console.log(`  ${id}: ${imgs.length}`);
  }
})().catch(err => { console.error(err); process.exit(1); });
