const fs = require('fs');
const path = require('path');

function main() {
  console.log('=== RUNNING STATIC CSS & M3 TOKENS AUDIT ===\n');

  const tokensCss = fs.readFileSync(path.join(__dirname, '../src/styles/tokens.css'), 'utf8');
  const mainCss = fs.readFileSync(path.join(__dirname, '../src/styles/main.css'), 'utf8');

  // Check brace balance
  let openBraces = 0;
  for (let i = 0; i < mainCss.length; i++) {
    if (mainCss[i] === '{') openBraces++;
    else if (mainCss[i] === '}') openBraces--;
  }
  console.log(`main.css brace balance count: ${openBraces} (must be 0)`);
  if (openBraces !== 0) {
    console.error('[FAIL/DEFECT] main.css has mismatched curly braces!');
  } else {
    console.log('[PASS] main.css curly braces are balanced.');
  }

  // Extract all defined CSS custom properties
  const definedVars = new Set();
  const defRegex = /(--[a-zA-Z0-9\-_]+)\s*:/g;
  let m;
  while ((m = defRegex.exec(tokensCss)) !== null) {
    definedVars.add(m[1]);
  }
  while ((m = defRegex.exec(mainCss)) !== null) {
    definedVars.add(m[1]);
  }
  console.log(`Total defined CSS custom properties: ${definedVars.size}`);

  // Extract all var(--...) used in main.css
  const varRegex = /var\(\s*(--[a-zA-Z0-9\-_]+)(?:\s*,\s*([^)]+))?\)/g;
  const usedVars = new Map();
  while ((m = varRegex.exec(mainCss)) !== null) {
    const varName = m[1];
    const fallback = m[2];
    if (!usedVars.has(varName)) {
      usedVars.set(varName, fallback || null);
    }
  }

  console.log(`Total unique CSS variables used in main.css: ${usedVars.size}`);

  // Check for used variables that are neither defined nor have a fallback
  const undefinedVars = [];
  for (const [varName, fallback] of usedVars.entries()) {
    // Dynamic or inline properties set by JS (e.g. --swatch-color, --scroll-top) can be ignored
    if (varName === '--swatch-color' || varName === '--scroll-top' || varName.startsWith('--color-')) continue;
    if (!definedVars.has(varName)) {
      undefinedVars.push({ varName, fallback });
    }
  }

  if (undefinedVars.length > 0) {
    console.warn(`[WARN/DEFECT] Found ${undefinedVars.length} undefined CSS variables in main.css:`);
    undefinedVars.forEach(v => console.warn(`  - ${v.varName} (fallback: ${v.fallback || 'NONE'})`));
  } else {
    console.log('[PASS] All CSS custom properties referenced in main.css are defined!');
  }

  // Check M3 core color token definitions
  const requiredM3Tokens = [
    '--md-sys-color-primary',
    '--md-sys-color-on-primary',
    '--md-sys-color-primary-container',
    '--md-sys-color-on-primary-container',
    '--md-sys-color-surface',
    '--md-sys-color-on-surface',
    '--md-sys-color-surface-variant',
    '--md-sys-color-on-surface-variant',
    '--md-sys-color-outline',
    '--md-sys-color-outline-variant',
    '--md-sys-color-error',
    '--md-sys-color-on-error',
    '--md-sys-color-surface-container',
    '--md-sys-color-surface-container-high',
    '--md-sys-color-surface-container-highest'
  ];

  const missingM3Tokens = requiredM3Tokens.filter(t => !definedVars.has(t));
  if (missingM3Tokens.length > 0) {
    console.error('[FAIL/DEFECT] Missing core Material 3 tokens:', missingM3Tokens);
  } else {
    console.log('[PASS] All core Material 3 tokens are properly defined in design system.');
  }
}

main();
