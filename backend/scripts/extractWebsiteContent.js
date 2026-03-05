#!/usr/bin/env node
/**
 * Extracts text content from public website pages (excludes /admin).
 * Run against localhost:3000 or production. Requires the site to be running or use production URL.
 *
 * Usage: SITE_BASE_URL=https://uoft-tri.club node backend/scripts/extractWebsiteContent.js
 *        node backend/scripts/extractWebsiteContent.js  (defaults to http://localhost:3000)
 */

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  console.error('Puppeteer not installed. Run: npm install puppeteer');
  process.exit(1);
}
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SITE_BASE_URL || 'http://localhost:3000';

// Public pages to index - exclude /admin, /login, /logout, /settings, /profile (user-specific)
const PUBLIC_ROUTES = [
  '/',
  '/join-us',
  '/faq',
  '/coaches-exec',
  '/resources',
  '/team-gear',
  '/privacy',
  '/support',
  '/schedule',
];

async function extractPageContent(page, url) {
  try {
    const response = await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    });
    if (!response || response.status() !== 200) {
      console.warn(`  ⚠ Skipped ${url} (status ${response?.status()})`);
      return null;
    }

    // Wait for React to render - main content area
    await page.waitForSelector('main, .page-container, .join-us-container, .faq-page, .home, [class*="container"]', {
      timeout: 5000,
    }).catch(() => {});

    // Give extra time for any async content (schedule, etc.)
    await new Promise((r) => setTimeout(r, 2000));

    const content = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      const clone = main.cloneNode(true);

      // Remove nav, footer, scripts
      clone.querySelectorAll('nav, header, footer, script, style, noscript, .navbar, .footer, .mobile-nav').forEach((el) => el.remove());
      return clone.innerText || clone.textContent || '';
    });

    const cleaned = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
    return cleaned;
  } catch (err) {
    console.warn(`  ⚠ Error extracting ${url}:`, err.message);
    return null;
  }
}

async function main() {
  console.log(`📄 Extracting content from ${BASE_URL}`);
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (compatible; UofTTri-RAG-Extractor/1.0)');
  await page.setViewport({ width: 1280, height: 800 });

  const results = [];
  for (const route of PUBLIC_ROUTES) {
    const url = `${BASE_URL}${route}`;
    process.stdout.write(`  ${route} ... `);
    const text = await extractPageContent(page, url);
    if (text && text.length > 50) {
      results.push({ url, path: route || '/', content: text });
      console.log('✓');
    } else {
      console.log(text ? '⚠ (short)' : '✗');
    }
  }

  await browser.close();

  const outPath = path.join(__dirname, '..', 'data', 'website-content.json');
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n✅ Saved ${results.length} pages to ${outPath}`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
