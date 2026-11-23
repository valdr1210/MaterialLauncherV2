const fs = require('fs');
const path = require('path');
const assert = require('assert');

function main() {
  console.log('=== RUNNING STATIC AUDIT: HTML, JS & I18N ===\n');

  const htmlContent = fs.readFileSync(path.join(__dirname, '../src/index.html'), 'utf8');
  const jsContent = fs.readFileSync(path.join(__dirname, '../src/js/app.js'), 'utf8');

  // 1. Check all getElementById in app.js against index.html
  const idRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
  const queriedIds = new Set();
  let m;
  while ((m = idRegex.exec(jsContent)) !== null) {
    queriedIds.add(m[1]);
  }

  console.log(`Found ${queriedIds.size} unique IDs queried by document.getElementById in app.js.`);

  // Extract all id="..." from index.html
  const htmlIdRegex = /id=["']([^"']+)["']/g;
  const htmlIds = new Set();
  while ((m = htmlIdRegex.exec(htmlContent)) !== null) {
    htmlIds.add(m[1]);
  }

  console.log(`Found ${htmlIds.size} unique IDs declared in index.html.`);

  const missingIds = [];
  for (const id of queriedIds) {
    if (!htmlIds.has(id)) {
      missingIds.push(id);
    }
  }

  if (missingIds.length > 0) {
    console.warn(`[WARN/DEFECT] ${missingIds.length} IDs queried in app.js are MISSING from index.html:`);
    missingIds.forEach(id => console.warn(`  - ${id}`));
  } else {
    console.log('[PASS] All getElementById targets exist in index.html!');
  }

  // 2. Check data-i18n keys against ru_RU.json and en_US.json
  const ruJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/locales/ru_RU.json'), 'utf8'));
  const enJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/locales/en_US.json'), 'utf8'));

  const i18nRegex = /data-i18n(?:-title|-placeholder)?=["']([^"']+)["']/g;
  const htmlI18nKeys = new Set();
  while ((m = i18nRegex.exec(htmlContent)) !== null) {
    htmlI18nKeys.add(m[1]);
  }

  console.log(`\nFound ${htmlI18nKeys.size} data-i18n keys in index.html.`);

  const missingInRu = [];
  const missingInEn = [];
  for (const key of htmlI18nKeys) {
    if (ruJson[key] === undefined) missingInRu.push(key);
    if (enJson[key] === undefined) missingInEn.push(key);
  }

  if (missingInRu.length > 0) {
    console.warn(`[WARN/DEFECT] ${missingInRu.length} keys missing in ru_RU.json:`, missingInRu);
  } else {
    console.log('[PASS] All index.html i18n keys exist in ru_RU.json');
  }

  if (missingInEn.length > 0) {
    console.warn(`[WARN/DEFECT] ${missingInEn.length} keys missing in en_US.json:`, missingInEn);
  } else {
    console.log('[PASS] All index.html i18n keys exist in en_US.json');
  }

  // 3. Check for I18N.t(...) keys in app.js
  const jsI18nRegex = /I18N\.t\(['"]([^'"]+)['"]/g;
  const jsI18nKeys = new Set();
  while ((m = jsI18nRegex.exec(jsContent)) !== null) {
    jsI18nKeys.add(m[1]);
  }

  console.log(`\nFound ${jsI18nKeys.size} I18N.t() keys called in app.js.`);
  const jsMissingInRu = [];
  const jsMissingInEn = [];
  for (const key of jsI18nKeys) {
    if (ruJson[key] === undefined) jsMissingInRu.push(key);
    if (enJson[key] === undefined) jsMissingInEn.push(key);
  }

  if (jsMissingInRu.length > 0) {
    console.warn(`[WARN/DEFECT] ${jsMissingInRu.length} JS i18n keys missing in ru_RU.json:`, jsMissingInRu);
  }
  if (jsMissingInEn.length > 0) {
    console.warn(`[WARN/DEFECT] ${jsMissingInEn.length} JS i18n keys missing in en_US.json:`, jsMissingInEn);
  }

  // 4. Check Content-Security-Policy
  console.log('\nChecking Content-Security-Policy in index.html...');
  const cspMatch = htmlContent.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=["']([^"']+)["']/i);
  if (cspMatch) {
    const csp = cspMatch[1];
    console.log('[PASS] CSP header present:', csp);
    // Check if mclo.gs, modrinth, mojand APIs are allowed in connect-src
    const connectSrc = (csp.match(/connect-src\s+([^;]+)/) || [])[1] || '';
    console.log('  connect-src:', connectSrc);
    const neededConnectDomains = ['https://api.modrinth.com', 'https://api.mclo.gs', 'https://api.minecraftservices.com', 'https://login.live.com', 'https://authserver.ely.by'];
    for (const d of neededConnectDomains) {
      if (!connectSrc.includes(d)) {
        console.warn(`  [INFO] connect-src does not explicitly list ${d} (Renderer may fetch via electronAPI IPC or directly)`);
      }
    }
  } else {
    console.warn('[WARN] No Content-Security-Policy meta tag found');
  }
}

main();
