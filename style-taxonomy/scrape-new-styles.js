/**
 * scrape-new-styles.js — Scrape images for the 7 new taxonomy entries
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const OUT_DIR = path.join(__dirname, 'images');
const IMAGES_PER_STYLE = 5;

const PREFERRED_SOURCES = ['pinterest', 'instagram', 'vogue', 'gq.com', 'fashionbeans', 'mrporter', 'hm.com', 'zara.com', 'nordstrom', 'lookbook', 'hypebeast', 'complex', 'grailed', 'farfetch'];
const BLOCKED_SOURCES   = ['ebay', 'amazon', 'walmart', 'aliexpress', 'dhgate', 'wish.com', 'temu', 'facebook', 'reddit', 'youtube', 'tiktok'];
const BLOCKED_EXTS      = ['.gif', '.svg', '.webm', '.mp4'];

function scoreImage(img) {
  let score = 0;
  const ratio = img.height / img.width;
  if (ratio > 1.0) score += 20;
  if (ratio > 1.2) score += 10;
  if (ratio > 2.0) score -= 15;
  const px = img.width * img.height;
  if (px > 600000) score += 15;
  if (px > 300000) score += 10;
  if (px < 40000)  score -= 30;
  const src = (img.source || '').toLowerCase();
  if (PREFERRED_SOURCES.some(s => src.includes(s))) score += 25;
  if (BLOCKED_SOURCES.some(s => src.includes(s)))  score -= 40;
  if (img.url.match(/\.(jpg|jpeg)$/i)) score += 5;
  if (img.url.match(/\.(png)$/i))      score += 3;
  if (BLOCKED_EXTS.some(e => img.url.toLowerCase().endsWith(e))) score -= 100;
  return score;
}

function httpGet(reqUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(reqUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    lib.get(reqUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9', ...headers },
      timeout: 15000,
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

async function searchDDG(query) {
  const r = await httpGet(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`);
  const m = r.body.match(/vqd=([\d-]+)/);
  if (!m) throw new Error('No VQD token');
  const apiUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&p=1&s=0&u=bing&f=,,,&l=us-en&vqd=${m[1]}`;
  const r2 = await httpGet(apiUrl, { Referer: 'https://duckduckgo.com/' });
  if (r2.status !== 200) throw new Error(`DDG status ${r2.status}`);
  return JSON.parse(r2.body).results || [];
}

function downloadImage(imgUrl, dest) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(imgUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const file = fs.createWriteStream(dest);
    const req = lib.get(imgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36', 'Referer': 'https://duckduckgo.com/' },
      timeout: 20000,
    }, res => {
      if ([301,302,307,308].includes(res.statusCode)) {
        file.close(); fs.unlinkSync(dest);
        downloadImage(res.headers.location, dest).then(resolve).catch(reject); return;
      }
      if (res.statusCode !== 200) { file.close(); try{fs.unlinkSync(dest)}catch(e){}; return reject(new Error(`HTTP ${res.statusCode}`)); }
      const ct = res.headers['content-type'] || '';
      if (!ct.startsWith('image/') && !ct.startsWith('application/octet')) { file.close(); try{fs.unlinkSync(dest)}catch(e){}; return reject(new Error(`Not image: ${ct}`)); }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('error', err => { file.close(); try{fs.unlinkSync(dest)}catch(_){} reject(err); });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

const NEW_STYLES = [
  {
    id: 'skatecore',
    queries: [
      'skatecore men fashion baggy jeans vans thrasher lookbook',
      'skate style men street photo hoodie wide leg denim worn',
    ],
  },
  {
    id: 'soccer-casual',
    queries: [
      'stone island men terrace casual fashion lookbook outfit',
      'soccer casual men cp company british terrace style photo',
    ],
  },
  {
    id: 'italian-sprezzatura',
    queries: [
      'italian sprezzatura men fashion neapolitan suit linen lookbook',
      'sprezzatura men style deconstructed blazer pocket square editorial',
    ],
  },
  {
    id: 'avant-garde',
    queries: [
      'rick owens men fashion avant garde editorial dark outfit',
      'avant garde menswear black draped asymmetric editorial lookbook',
    ],
  },
  {
    id: 'mod-sixties',
    queries: [
      'mod style men 1960s slim suit chelsea boots lookbook',
      'mod revival men fashion fred perry parka outfit street style',
    ],
  },
  {
    id: 'y2k-revival',
    queries: [
      'y2k men fashion revival 2000s outfit low rise jeans lookbook',
      'y2k mens style 2000s nostalgia tracksuit trucker hat photo',
    ],
  },
  {
    id: 'athleisure',
    queries: [
      'athleisure men fashion sport luxe tracksuit clean trainers lookbook',
      'sport luxe men outfit premium joggers editorial fashion photo',
    ],
  },
];

async function scrapeStyle(style) {
  const styleDir = path.join(OUT_DIR, style.id);
  ensureDir(styleDir);

  let candidates = [];
  for (const query of style.queries) {
    console.log(`  searching: "${query}"`);
    try {
      const results = await searchDDG(query);
      const scored = results
        .filter(img => img.image && !BLOCKED_EXTS.some(e => img.image.toLowerCase().endsWith(e)))
        .map(img => ({ ...img, score: scoreImage({ url: img.image, width: img.width, height: img.height, source: img.url }) }))
        .filter(img => img.score > 0)
        .sort((a, b) => b.score - a.score);
      console.log(`    ${results.length} results → ${scored.length} viable (top: ${scored[0]?.score ?? 'n/a'})`);
      candidates.push(...scored);
    } catch (e) {
      console.log(`    error: ${e.message}`);
    }
    await sleep(800);
  }

  const seen = new Set();
  candidates = candidates.filter(c => { if (seen.has(c.image)) return false; seen.add(c.image); return true; })
    .sort((a, b) => b.score - a.score);

  console.log(`  ${candidates.length} unique candidates, downloading top ${IMAGES_PER_STYLE}…`);
  const saved = [];
  for (const candidate of candidates) {
    if (saved.length >= IMAGES_PER_STYLE) break;
    const ext = (candidate.image.match(/\.(jpe?g|png|webp)/i) || ['.jpg'])[0].toLowerCase().replace('jpeg','jpg');
    const idx = saved.length + 1;
    const dest = path.join(styleDir, `${idx}${ext}`);
    try {
      await downloadImage(candidate.image, dest);
      const stat = fs.statSync(dest);
      if (stat.size < 8000) { fs.unlinkSync(dest); continue; }
      saved.push(`images/${style.id}/${idx}${ext}`);
      console.log(`    [${idx}] ✓ ${Math.round(stat.size/1024)}KB score=${candidate.score} ${candidate.image.slice(0,70)}`);
    } catch (e) {
      console.log(`    [${idx}] err: ${e.message.slice(0,60)}`);
    }
    await sleep(300);
  }
  console.log(`  → ${saved.length}/${IMAGES_PER_STYLE} saved`);
  return saved;
}

(async () => {
  ensureDir(OUT_DIR);
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-manifest.json'), 'utf8'));

  for (const style of NEW_STYLES) {
    console.log(`\n══ ${style.id} ══`);
    manifest[style.id] = await scrapeStyle(style);
    await sleep(1200);
  }

  fs.writeFileSync(path.join(__dirname, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nDone. Manifest updated.');
})().catch(err => { console.error(err); process.exit(1); });
