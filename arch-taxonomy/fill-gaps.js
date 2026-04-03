/**
 * fill-gaps.js — Fill missing slots in styles that didn't reach 5 images
 */
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const OUT_DIR = path.join(__dirname, 'images');

const PREFERRED_SOURCES = [
  'archdaily','dezeen','architectural','architizer','designboom','archpaper',
  'wikimedia','commons.wiki','galinsky','architecture.com','archinect',
  'architecturaldigest','arch2o','e-architect','archello',
];
const BLOCKED_SOURCES = [
  'dreamstime','alamy','shutterstock','vecteezy','gettyimages','istockphoto',
  'depositphotos','123rf','stockadobe','adobe.stock','bigstockphoto',
  'stablediffusion','archsynth','freepik','ebay','amazon','walmart',
  'facebook','reddit','youtube','tiktok','pinterest',
];
const BLOCKED_EXTS = ['.gif','.svg','.webm','.mp4'];

function scoreImage(img) {
  let score = 0;
  const ratio = img.height / img.width;
  if (ratio >= 0.5 && ratio <= 1.5) score += 20;
  if (ratio < 0.35 || ratio > 2.2)  score -= 20;
  const px = img.width * img.height;
  if (px > 600000) score += 15;
  if (px > 300000) score += 10;
  if (px < 40000)  score -= 30;
  const src = (img.source || img.url || '').toLowerCase();
  if (PREFERRED_SOURCES.some(s => src.includes(s))) score += 35;
  if (BLOCKED_SOURCES.some(s => src.includes(s)))   score -= 60;
  if (img.url.match(/\.(jpg|jpeg)$/i)) score += 5;
  if (img.url.match(/\.(png)$/i))      score += 3;
  if (BLOCKED_EXTS.some(e => img.url.toLowerCase().endsWith(e))) score -= 100;
  if (src.includes('wikimedia') || src.includes('commons.wiki')) score += 20;
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
      let body = ''; res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

async function searchDDG(query) {
  const r = await httpGet(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`);
  const m = r.body.match(/vqd=([\d-]+)/);
  if (!m) throw new Error('No VQD token');
  const r2 = await httpGet(`https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&p=1&s=0&u=bing&f=,,,&l=us-en&vqd=${m[1]}`, { Referer: 'https://duckduckgo.com/' });
  if (r2.status !== 200) throw new Error(`DDG status ${r2.status}`);
  return JSON.parse(r2.body).results || [];
}

function downloadImage(imgUrl, dest) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(imgUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const file = fs.createWriteStream(dest);
    lib.get(imgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36', 'Referer': 'https://duckduckgo.com/' },
      timeout: 20000,
    }, res => {
      if ([301,302,307,308].includes(res.statusCode)) { file.close(); fs.unlinkSync(dest); downloadImage(res.headers.location, dest).then(resolve).catch(reject); return; }
      if (res.statusCode !== 200) { file.close(); try{fs.unlinkSync(dest)}catch(e){}; return reject(new Error(`HTTP ${res.statusCode}`)); }
      const ct = res.headers['content-type'] || '';
      if (!ct.startsWith('image/') && !ct.startsWith('application/octet')) { file.close(); try{fs.unlinkSync(dest)}catch(e){}; return reject(new Error(`Not image: ${ct}`)); }
      res.pipe(file); file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { file.close(); try{fs.unlinkSync(dest)}catch(_){} reject(err); })
      .on('timeout', () => { reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const GAPS = [
  { id: 'baroque',            need: 1, queries: ['baroque manor house residential england exterior garden photo', 'baroque country house palace residential exterior photo'] },
  { id: 'neoclassical',       need: 1, queries: ['neoclassical townhouse georgian terrace residential exterior photo', 'neoclassical country house residential portico exterior photo'] },
  { id: 'international-style',need: 1, queries: ['mies van der rohe residential house exterior international style photo', 'richard neutra international style residential house exterior photo'] },
  { id: 'high-tech',          need: 1, queries: ['high tech architecture small residential house exterior photo', 'richard rogers high tech small building exterior photo'] },
  { id: 'parametric',         need: 2, queries: ['parametric architecture residential house exterior curves photo', 'zaha hadid small building pavilion parametric exterior photo', 'parametric architecture urban small building facade exterior photo'] },
  { id: 'gothic-revival',     need: 1, queries: ['gothic revival victorian cottage house residential exterior photo', 'carpenter gothic house american residential exterior photo'] },
  { id: 'french-renaissance', need: 1, queries: ['small french renaissance manor chateau exterior photo', 'french renaissance architecture small country house exterior photo'] },
  { id: 'chicago-school',     need: 1, queries: ['chicago school small commercial rowhouse brick storefront exterior photo', 'sullivan ornament chicago school building exterior detail photo'] },
  { id: 'german-expressionism',need: 1, queries: ['german expressionist residential house brick 1920s exterior photo', 'expressionist architecture small building angular exterior germany photo'] },
];

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-manifest.json'), 'utf8'));

  for (const gap of GAPS) {
    const styleDir = path.join(OUT_DIR, gap.id);
    const existing = fs.readdirSync(styleDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    let nextIdx = existing.length + 1;
    let filled = 0;

    console.log(`\n══ ${gap.id} (have ${existing.length}, need ${gap.need} more) ══`);

    // Build set of already-downloaded URLs to avoid re-downloading
    let candidates = [];
    for (const query of gap.queries) {
      console.log(`  searching: "${query}"`);
      try {
        const results = await searchDDG(query);
        const scored = results
          .filter(img => img.image && !BLOCKED_EXTS.some(e => img.image.toLowerCase().endsWith(e)))
          .map(img => ({ ...img, score: scoreImage({ url: img.image, width: img.width, height: img.height, source: img.url }) }))
          .filter(img => img.score > 0)
          .sort((a, b) => b.score - a.score);
        console.log(`    ${results.length} results → ${scored.length} viable`);
        candidates.push(...scored);
      } catch (e) { console.log(`    error: ${e.message}`); }
      await sleep(800);
    }

    const seen = new Set();
    candidates = candidates.filter(c => { if (seen.has(c.image)) return false; seen.add(c.image); return true; })
      .sort((a, b) => b.score - a.score);

    for (const c of candidates.slice(0, 30)) {
      if (filled >= gap.need) break;
      const ext = (c.image.match(/\.(jpe?g|png|webp)/i) || ['.jpg'])[0].toLowerCase().replace('jpeg','jpg');
      const dest = path.join(styleDir, `${nextIdx}${ext}`);
      try {
        await downloadImage(c.image, dest);
        const stat = fs.statSync(dest);
        if (stat.size < 8000) { fs.unlinkSync(dest); continue; }
        console.log(`  ✓ [${nextIdx}] ${Math.round(stat.size/1024)}KB score=${c.score} ${c.image.slice(0,70)}`);
        nextIdx++; filled++;
      } catch (e) {
        console.log(`  err: ${e.message.slice(0,60)}`);
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
      }
      await sleep(300);
    }

    // Update manifest for this style
    manifest[gap.id] = fs.readdirSync(styleDir)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(f => `images/${gap.id}/${f}`);
    console.log(`  → now ${manifest[gap.id].length}/5`);
    await sleep(1200);
  }

  fs.writeFileSync(path.join(__dirname, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nDone. Manifest updated.');
})().catch(err => { console.error(err); process.exit(1); });
