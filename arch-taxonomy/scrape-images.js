/**
 * scrape-images.js — Architectural Styles Taxonomy image scraper
 * Uses DuckDuckGo Image Search to find and download the best architectural
 * photography for each style, stored in images/{style-id}/
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const OUT_DIR = path.join(__dirname, 'images');
const IMAGES_PER_STYLE = 5;

const PREFERRED_SOURCES = [
  'archdaily', 'dezeen', 'architectural', 'architizer', 'designboom',
  'archpaper', 'wikimedia', 'commons.wiki', 'galinsky', 'greatbuildings',
  'museodelarte', 'architecture.com', 'archinect', 'docomomo',
];
const BLOCKED_SOURCES   = ['ebay','amazon','walmart','aliexpress','dhgate','wish.com','temu','facebook','reddit','youtube','tiktok','pinterest'];
const BLOCKED_EXTS      = ['.gif','.svg','.webm','.mp4'];

function scoreImage(img) {
  let score = 0;

  // Landscape or square preferred for architecture (buildings are wide)
  const ratio = img.height / img.width;
  if (ratio >= 0.5 && ratio <= 1.4) score += 20;  // landscape to slight portrait
  if (ratio < 0.4 || ratio > 2.2)   score -= 20;   // too panoramic or too tall

  // Resolution
  const px = img.width * img.height;
  if (px > 600000) score += 15;
  if (px > 300000) score += 10;
  if (px < 40000)  score -= 30;

  const src = (img.source || img.url || '').toLowerCase();
  if (PREFERRED_SOURCES.some(s => src.includes(s))) score += 30;
  if (BLOCKED_SOURCES.some(s => src.includes(s)))   score -= 40;

  if (img.url.match(/\.(jpg|jpeg)$/i)) score += 5;
  if (img.url.match(/\.(png)$/i))      score += 3;
  if (BLOCKED_EXTS.some(e => img.url.toLowerCase().endsWith(e))) score -= 100;

  // Slight bonus for commons/wikimedia (high-quality, freely licensed architecture photos)
  if (src.includes('wikimedia') || src.includes('commons.wiki')) score += 15;

  return score;
}

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
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

async function searchDDG(query) {
  const r = await httpGet(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`);
  const m = r.body.match(/vqd=([\d-]+)/);
  if (!m) throw new Error('No VQD token');
  const r2 = await httpGet(
    `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&p=1&s=0&u=bing&f=,,,&l=us-en&vqd=${m[1]}`,
    { Referer: 'https://duckduckgo.com/' }
  );
  if (r2.status !== 200) throw new Error(`DDG status ${r2.status}`);
  return JSON.parse(r2.body).results || [];
}

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
      if ([301,302,307,308].includes(res.statusCode)) {
        file.close(); fs.unlinkSync(dest);
        downloadImage(res.headers.location, dest).then(resolve).catch(reject); return;
      }
      if (res.statusCode !== 200) {
        file.close(); try{fs.unlinkSync(dest)}catch(e){}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const ct = res.headers['content-type'] || '';
      if (!ct.startsWith('image/') && !ct.startsWith('application/octet')) {
        file.close(); try{fs.unlinkSync(dest)}catch(e){}
        return reject(new Error(`Not image: ${ct}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    req.on('error', err => { file.close(); try{fs.unlinkSync(dest)}catch(_){} reject(err); });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

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
  candidates = candidates.filter(c => {
    if (seen.has(c.image)) return false;
    seen.add(c.image); return true;
  }).sort((a, b) => b.score - a.score);

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

const STYLES = [
  { id: 'greek-classical',   queries: ['parthenon athens exterior ancient greek temple architecture', 'ancient greek doric columns temple ruins exterior photo'] },
  { id: 'romanesque',        queries: ['romanesque cathedral architecture thick walls round arches exterior', 'romanesque abbey church stone architecture europe photo'] },
  { id: 'gothic',            queries: ['gothic cathedral exterior flying buttresses stone france', 'notre dame paris gothic cathedral architecture exterior photo'] },
  { id: 'renaissance',       queries: ['renaissance palace florence italy architecture symmetry facade', 'italian renaissance building classical columns courtyard archdaily'] },
  { id: 'baroque',           queries: ['baroque church architecture ornate facade rome italy exterior', 'palace versailles baroque architecture grand facade exterior photo'] },
  { id: 'neoclassical',      queries: ['neoclassical building white columns portico government architecture', 'neoclassical temple front architecture exterior columns photo'] },
  { id: 'art-nouveau',       queries: ['art nouveau building facade organic curves ornament exterior', 'gaudi barcelona sagrada familia art nouveau architecture photo'] },
  { id: 'art-deco',          queries: ['art deco skyscraper chrysler building new york exterior photo', 'art deco building facade geometric ornament exterior architecture'] },
  { id: 'bauhaus',           queries: ['bauhaus dessau building architecture exterior gropius photo', 'bauhaus style building flat roof glass ribbon windows white exterior'] },
  { id: 'international-style', queries: ['seagram building new york mies van der rohe international style', 'international style glass curtain wall office tower modernist architecture'] },
  { id: 'brutalism',         queries: ['brutalist concrete building exterior architecture bold massive photo', 'brutalism raw concrete government building architecture photo'] },
  { id: 'organic-prairie',   queries: ['frank lloyd wright prairie style house architecture exterior low horizontal', 'organic architecture integration landscape falling water fallingwater'] },
  { id: 'mid-century-modern', queries: ['mid century modern house flat roof large windows california exterior', 'eichler home case study house mid century architecture exterior photo'] },
  { id: 'high-tech',         queries: ['centre pompidou paris high tech architecture renzo piano rogers exterior', 'high tech architecture exposed structure steel glass building exterior'] },
  { id: 'postmodernism',     queries: ['postmodern architecture building colourful ornament facade exterior photo', 'michael graves postmodern building classical references architecture'] },
  { id: 'deconstructivism',  queries: ['guggenheim bilbao gehry titanium deconstructivist architecture exterior', 'zaha hadid building deconstructivist angular architecture exterior photo'] },
  { id: 'parametric',        queries: ['parametric architecture zaha hadid organic curves building exterior', 'computational architecture complex curved facade building contemporary'] },
  { id: 'minimalism-arch',   queries: ['tadao ando concrete minimalist architecture exterior light photo', 'minimalist architecture building clean white simple exterior photo'] },
  { id: 'japanese-traditional', queries: ['japanese temple shrine architecture wooden pagoda exterior photo', 'traditional japanese architecture timber joinery eaves exterior'] },
  { id: 'islamic-moorish',   queries: ['alhambra granada islamic architecture courtyard interior arches photo', 'moorish architecture spain intricate tile geometric pattern interior'] },
];

(async () => {
  ensureDir(OUT_DIR);
  const manifest = {};

  for (const style of STYLES) {
    console.log(`\n══ ${style.id} ══`);
    manifest[style.id] = await scrapeStyle(style);
    await sleep(1200);
  }

  fs.writeFileSync(path.join(__dirname, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\n\nDone. Manifest written.');

  const total = Object.values(manifest).reduce((n, arr) => n + arr.length, 0);
  console.log(`Total images: ${total}/${STYLES.length * IMAGES_PER_STYLE}`);
  for (const [id, imgs] of Object.entries(manifest)) {
    console.log(`  ${id}: ${imgs.length}`);
  }
})().catch(err => { console.error(err); process.exit(1); });
