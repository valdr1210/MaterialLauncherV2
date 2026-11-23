const fs = require('fs');
const path = require('path');

function main() {
  console.log('=== RUNNING ELECTRON API METHOD USAGE AUDIT ===\n');

  const preloadContent = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
  const appJsContent = fs.readFileSync(path.join(__dirname, '../src/js/app.js'), 'utf8');

  // Extract all methods exposed on electronAPI in preload.js
  const exposedMethods = new Set();
  const exposeRegex = /^\s*([a-zA-Z0-9_]+)\s*:\s*(?:\([^)]*\)|function)/gm;
  let m;
  while ((m = exposeRegex.exec(preloadContent)) !== null) {
    exposedMethods.add(m[1]);
  }

  console.log(`preload.js exposes ${exposedMethods.size} methods on window.electronAPI:`);
  console.log(Array.from(exposedMethods).join(', '));

  // Extract all window.electronAPI.method calls in app.js
  const apiCallRegex = /window\.electronAPI(?:\.|\?\.)([a-zA-Z0-9_]+)/g;
  const usedMethods = new Set();
  while ((m = apiCallRegex.exec(appJsContent)) !== null) {
    usedMethods.add(m[1]);
  }

  console.log(`\napp.js calls ${usedMethods.size} methods on window.electronAPI:`);
  console.log(Array.from(usedMethods).join(', '));

  const missingInPreload = [];
  for (const method of usedMethods) {
    if (!exposedMethods.has(method)) {
      missingInPreload.push(method);
    }
  }

  if (missingInPreload.length > 0) {
    console.error('[FAIL/DEFECT] app.js calls methods that are NOT exposed in preload.js:', missingInPreload);
  } else {
    console.log('[PASS] All electronAPI methods called in app.js are exposed in preload.js!');
  }
}

main();
