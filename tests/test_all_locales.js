const fs = require('fs');
const path = require('path');

function main() {
  console.log('=== AUDITING ALL LOCALE FILES ===\n');

  const localesDir = path.join(__dirname, '../src/locales');
  const localeFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

  const ruData = JSON.parse(fs.readFileSync(path.join(localesDir, 'ru_RU.json'), 'utf8'));
  const ruKeys = Object.keys(ruData);
  console.log(`Base reference ru_RU.json has ${ruKeys.length} keys.`);

  for (const file of localeFiles) {
    if (file === 'ru_RU.json') continue;
    const locData = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
    const missingKeys = ruKeys.filter(k => locData[k] === undefined);
    if (missingKeys.length > 0) {
      console.warn(`[WARN] ${file} is missing ${missingKeys.length} keys from ru_RU: ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? '...' : ''}`);
    } else {
      console.log(`[PASS] ${file} has all ${ruKeys.length} keys`);
    }
  }
}

main();
