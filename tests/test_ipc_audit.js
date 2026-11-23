const fs = require('fs');
const path = require('path');

function main() {
  console.log('=== RUNNING STATIC IPC CHANNEL AUDIT ===\n');

  const preloadContent = fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8');
  const mainContent = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');

  // Extract all ipcRenderer.invoke('...') and send('...') from preload.js
  const invokeRegex = /ipcRenderer\.invoke\(['"]([^'"]+)['"]/g;
  const sendRegex = /ipcRenderer\.send\(['"]([^'"]+)['"]/g;
  const onRendererRegex = /ipcRenderer\.on\(['"]([^'"]+)['"]/g;

  const preloadInvokes = new Set();
  const preloadSends = new Set();
  const preloadOns = new Set();

  let m;
  while ((m = invokeRegex.exec(preloadContent)) !== null) preloadInvokes.add(m[1]);
  while ((m = sendRegex.exec(preloadContent)) !== null) preloadSends.add(m[1]);
  while ((m = onRendererRegex.exec(preloadContent)) !== null) preloadOns.add(m[1]);

  console.log(`preload.js defines: ${preloadInvokes.size} invokes, ${preloadSends.size} sends, ${preloadOns.size} listeners`);

  // Extract all ipcMain.handle('...') and on('...') from main.js
  const handleRegex = /ipcMain\.handle\(['"]([^'"]+)['"]/g;
  const onMainRegex = /ipcMain\.on\(['"]([^'"]+)['"]/g;
  const sendWebContentsRegex = /win\.webContents\.send\(['"]([^'"]+)['"]/g;

  const mainHandles = new Set();
  const mainOns = new Set();
  const mainSends = new Set();

  while ((m = handleRegex.exec(mainContent)) !== null) mainHandles.add(m[1]);
  while ((m = onMainRegex.exec(mainContent)) !== null) mainOns.add(m[1]);
  while ((m = sendWebContentsRegex.exec(mainContent)) !== null) mainSends.add(m[1]);

  console.log(`main.js defines: ${mainHandles.size} handles, ${mainOns.size} listeners, ${mainSends.size} webContents sends`);

  // Check unhandled invokes
  const unhandledInvokes = [];
  for (const inv of preloadInvokes) {
    if (!mainHandles.has(inv)) unhandledInvokes.push(inv);
  }

  // Check unhandled sends
  const unhandledSends = [];
  for (const s of preloadSends) {
    if (!mainOns.has(s)) unhandledSends.push(s);
  }

  // Check unhandled renderer event listeners
  const unhandledEvents = [];
  for (const ev of preloadOns) {
    if (!mainSends.has(ev)) unhandledEvents.push(ev);
  }

  if (unhandledInvokes.length > 0) {
    console.error('[FAIL/DEFECT] Unhandled ipcRenderer.invoke channels in main.js:', unhandledInvokes);
  } else {
    console.log('[PASS] All ipcRenderer.invoke channels are handled in main.js');
  }

  if (unhandledSends.length > 0) {
    console.error('[FAIL/DEFECT] Unhandled ipcRenderer.send channels in main.js:', unhandledSends);
  } else {
    console.log('[PASS] All ipcRenderer.send channels are handled in main.js');
  }

  if (unhandledEvents.length > 0) {
    console.warn('[WARN] Renderer listens to events not directly found via win.webContents.send in main.js:', unhandledEvents);
  } else {
    console.log('[PASS] All preload event listeners have corresponding webContents.send in main.js');
  }
}

main();
