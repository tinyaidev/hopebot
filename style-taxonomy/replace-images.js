/**
 * replace-images.js — Targeted replacement of bad/wrong images
 * Downloads fresh images for specific slots identified during review.
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const OUT_DIR = path.join(__dirname, 'images');

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
  const src = (img.source || img.url || '').toLowerCase();
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

async function searchDDG(query) {
  const vqd = await getDDGVqd(query);
  if (!vqd) throw new Error('Could not get DDG VQD token');
  const apiUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&o=json&p=1&s=0&u=bing&f=,,,&l=us-en&vqd=${vqd}`;
  const r = await httpGet(apiUrl, { Referer: 'https://duckduckgo.com/' });
  if (r.status !== 200) throw new Error(`DDG API status ${r.status}`);
  const data = JSON.parse(r.body);
  return data.results || [];
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

// Each entry: { styleId, slot (1-based), queries[] }
// Queries are targeted to get a real person wearing the style, not product shots
const REPLACEMENTS = [
  // power-suit/4 — green wedding suit, want sharp tailored business suit
  { styleId: 'power-suit', slot: 4, queries: ['mens power suit dark navy tailored office lookbook street style'] },

  // old-money/3 — women's diagram, want quiet luxury men
  { styleId: 'old-money', slot: 3, queries: ['quiet luxury men cashmere neutral tones outfit', 'old money men camel coat neutral fashion lookbook'] },

  // dark-academia/4 — jacket on hanger, want person
  { styleId: 'dark-academia', slot: 4, queries: ['dark academia men outfit wool blazer turtleneck autumn lookbook'] },

  // normcore/2,4,5
  { styleId: 'normcore', slot: 2, queries: ['normcore men street style plain basics white tee straight jeans lookbook'] },
  { styleId: 'normcore', slot: 4, queries: ['normcore men simple outfit neutral minimal street style real person'] },
  { styleId: 'normcore', slot: 5, queries: ['men minimalist basics outfit normcore street photo lookbook casual'] },

  // gothic/1,3
  { styleId: 'gothic', slot: 1, queries: ['goth men full outfit all black velvet layered fashion lookbook person'] },
  { styleId: 'gothic', slot: 3, queries: ['gothic men fashion black platform boots full outfit editorial'] },

  // punk-rock/2,3,4,5 — all need to be real people
  { styleId: 'punk-rock', slot: 2, queries: ['punk rock men real outfit leather jacket studs street style photo'] },
  { styleId: 'punk-rock', slot: 3, queries: ['punk fashion men band tee ripped jeans combat boots lookbook'] },
  { styleId: 'punk-rock', slot: 4, queries: ['rock style men leather jacket chains pins aesthetic person photo'] },
  { styleId: 'punk-rock', slot: 5, queries: ['punk men fashion street style full body shot editorial photo'] },

  // hip-hop/5 — woman
  { styleId: 'hip-hop', slot: 5, queries: ['hip hop men fashion baggy outfit gold jewelry street style photo'] },

  // techwear/2 — product shot
  { styleId: 'techwear', slot: 2, queries: ['techwear men full outfit black tactical urban fashion lookbook person'] },

  // nautical/2,5 — duplicates of same breton stripe shoot
  { styleId: 'nautical', slot: 2, queries: ['nautical men style navy blazer gold buttons white chinos boat shoes lookbook'] },
  { styleId: 'nautical', slot: 5, queries: ['coastal preppy men breton stripe chinos deck shoes sailing outfit editorial'] },

  // bohemian/2,3,4
  { styleId: 'bohemian', slot: 2, queries: ['bohemian men fashion linen layered earth tones festival outfit person'] },
  { styleId: 'bohemian', slot: 3, queries: ['boho men style flowy shirt wide pants natural fabric lookbook editorial'] },
  { styleId: 'bohemian', slot: 4, queries: ['bohemian men outfit free spirit layered accessories full body photo'] },

  // grunge/4,5
  { styleId: 'grunge', slot: 4, queries: ['grunge men fashion 90s flannel ripped jeans doc martens male person lookbook'] },
  { styleId: 'grunge', slot: 5, queries: ['grunge men distressed denim band tee plaid shirt male street style photo'] },
];

async function fetchBestCandidate(queries, existingUrls) {
  let candidates = [];
  for (const query of queries) {
    console.log(`    searching: "${query}"`);
    try {
      const results = await searchDDG(query);
      const scored = results
        .filter(img => img.image && !BLOCKED_EXTS.some(e => img.image.toLowerCase().endsWith(e)))
        .map(img => ({ ...img, score: scoreImage({ url: img.image, width: img.width, height: img.height, source: img.url }) }))
        .filter(img => img.score > 0 && !existingUrls.has(img.image))
        .sort((a, b) => b.score - a.score);
      console.log(`      ${results.length} results → ${scored.length} viable`);
      candidates.push(...scored);
    } catch (e) {
      console.log(`      search error: ${e.message}`);
    }
    await sleep(800);
  }
  // Deduplicate
  const seen = new Set();
  return candidates.filter(c => {
    if (seen.has(c.image)) return false;
    seen.add(c.image);
    return true;
  }).sort((a, b) => b.score - a.score);
}

(async () => {
  // Collect URLs of images we already have (to avoid re-downloading same ones)
  // We don't track these so just skip this check
  const existingUrls = new Set();

  for (const rep of REPLACEMENTS) {
    const styleDir = path.join(OUT_DIR, rep.styleId);
    const ext = '.jpg';
    const dest = path.join(styleDir, `${rep.slot}${ext}`);

    console.log(`\n══ ${rep.styleId}/${rep.slot} ══`);

    // Remove bad existing file
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
      console.log(`  removed old ${rep.slot}.jpg`);
    }

    const candidates = await fetchBestCandidate(rep.queries, existingUrls);
    console.log(`  ${candidates.length} candidates, trying top ones…`);

    let saved = false;
    for (const candidate of candidates.slice(0, 20)) {
      try {
        await downloadImage(candidate.image, dest);
        const stat = fs.statSync(dest);
        if (stat.size < 8000) {
          fs.unlinkSync(dest);
          continue;
        }
        console.log(`  ✓ ${Math.round(stat.size/1024)}KB score=${candidate.score} ${candidate.image.slice(0, 70)}`);
        saved = true;
        break;
      } catch (e) {
        console.log(`  err: ${e.message.slice(0, 60)}`);
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
      }
      await sleep(300);
    }

    if (!saved) {
      console.log(`  ✗ FAILED to replace ${rep.styleId}/${rep.slot}`);
    }

    await sleep(1000);
  }

  console.log('\n\nDone replacing images.');
})().catch(err => { console.error(err); process.exit(1); });
