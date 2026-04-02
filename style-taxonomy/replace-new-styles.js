/**
 * replace-new-styles.js — Targeted fixes for bad images in the 7 new styles
 */
const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const OUT_DIR = path.join(__dirname, 'images');

const PREFERRED_SOURCES = ['pinterest','instagram','vogue','gq.com','fashionbeans','mrporter','lookbook','hypebeast','complex','grailed','farfetch'];
const BLOCKED_SOURCES   = ['ebay','amazon','walmart','aliexpress','dhgate','wish.com','temu','facebook','reddit','youtube','tiktok'];
const BLOCKED_EXTS      = ['.gif','.svg','.webm','.mp4'];

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
  if (!m) throw new Error('No VQD');
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
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', err => { file.close(); try{fs.unlinkSync(dest)}catch(_){} reject(err); })
      .on('timeout', () => { reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const REPLACEMENTS = [
  // Y2K: 1,2,3 all wrong gender — need men in Y2K outfits
  { styleId: 'y2k-revival', slot: 1, queries: ['y2k men fashion 2000s low rise baggy jeans outfit male lookbook'] },
  { styleId: 'y2k-revival', slot: 2, queries: ['2000s men fashion y2k tracksuit velour oversized logo tee male photo'] },
  { styleId: 'y2k-revival', slot: 3, queries: ['y2k mens style revival 2000s aesthetic trucker hat cargo jeans male street'] },

  // Soccer casual: 3 (pink wrong vibe), 5 (denim jumpsuit)
  { styleId: 'soccer-casual', slot: 3, queries: ['terrace wear men adidas originals fred perry polo casual football fan outfit'] },
  { styleId: 'soccer-casual', slot: 5, queries: ['stone island men casual street style navy olive outfit lookbook real person'] },

  // Skatecore: 2 (headless), 3 (product shot white bg)
  { styleId: 'skatecore', slot: 2, queries: ['skate fashion men full body lookbook baggy denim thrasher hoodie street photo'] },
  { styleId: 'skatecore', slot: 3, queries: ['skatecore men outfit vans palace polar skate editorial full person photo'] },

  // Italian sprezzatura: 4 (crop too tight, no full outfit)
  { styleId: 'italian-sprezzatura', slot: 4, queries: ['pitti uomo men linen suit sprezzatura editorial full body shot lookbook'] },

  // Avant-garde: 2 (woman), 5 (back view duplicate of 1)
  { styleId: 'avant-garde', slot: 2, queries: ['rick owens men editorial avant garde full outfit dark fashion male model'] },
  { styleId: 'avant-garde', slot: 5, queries: ['yohji yamamoto men fashion black avant garde editorial full body photo'] },

  // Mod-sixties: 4 (wrong style), 5 (text overlay)
  { styleId: 'mod-sixties', slot: 4, queries: ['mod style men 1960s slim suit chelsea boots fred perry lookbook street'] },
  { styleId: 'mod-sixties', slot: 5, queries: ['mod revival menswear british parka vespa sixties outfit photo real person'] },
];

async function replaceOne(rep) {
  const styleDir = path.join(OUT_DIR, rep.styleId);
  const dest = path.join(styleDir, `${rep.slot}.jpg`);
  if (fs.existsSync(dest)) { fs.unlinkSync(dest); console.log(`  removed old ${rep.slot}.jpg`); }

  let candidates = [];
  for (const query of rep.queries) {
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

  for (const c of candidates.slice(0, 25)) {
    try {
      await downloadImage(c.image, dest);
      const stat = fs.statSync(dest);
      if (stat.size < 8000) { fs.unlinkSync(dest); continue; }
      console.log(`  ✓ ${Math.round(stat.size/1024)}KB score=${c.score} ${c.image.slice(0,70)}`);
      return true;
    } catch (e) {
      console.log(`  err: ${e.message.slice(0,60)}`);
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    }
    await sleep(300);
  }
  console.log(`  ✗ FAILED`);
  return false;
}

(async () => {
  for (const rep of REPLACEMENTS) {
    console.log(`\n══ ${rep.styleId}/${rep.slot} ══`);
    await replaceOne(rep);
    await sleep(1200);
  }

  // Update manifest
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-manifest.json'), 'utf8'));
  const styleIds = [...new Set(REPLACEMENTS.map(r => r.styleId))];
  for (const id of styleIds) {
    const dir = path.join(OUT_DIR, id);
    manifest[id] = fs.readdirSync(dir)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(f => `images/${id}/${f}`);
  }
  fs.writeFileSync(path.join(__dirname, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nDone. Manifest updated.');
})().catch(err => { console.error(err); process.exit(1); });
