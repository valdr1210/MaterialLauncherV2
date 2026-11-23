const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const launcherCore = require('../launcherCore');

const testResults = [];

function runTest(name, fn) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        console.log(`[PASS] ${name}`);
        testResults.push({ name, passed: true });
      }).catch(err => {
        console.error(`[FAIL] ${name}:`, err.message);
        testResults.push({ name, passed: false, error: err.message });
      });
    } else {
      console.log(`[PASS] ${name}`);
      testResults.push({ name, passed: true });
    }
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    testResults.push({ name, passed: false, error: err.message });
  }
}

async function main() {
  console.log('=== RUNNING ROUND 1 STRESS & PATH TRAVERSAL TESTS ===\n');

  // Test 1: Path Traversal prevention in getInstanceDir
  await runTest('getInstanceDir rejects or sanitizes Path Traversal instanceId', () => {
    const instancesBase = path.resolve(path.join(launcherCore.MINECRAFT_DIR, 'instances'));
    const maliciousId = '../../traversal_test_' + Date.now();
    let dir;
    let threw = false;
    try {
      dir = launcherCore.getInstanceDir(maliciousId);
    } catch (e) {
      threw = true;
    }
    if (!threw) {
      const resolved = path.resolve(dir);
      assert(resolved.startsWith(instancesBase + path.sep), `Resolved path "${resolved}" escaped instances directory "${instancesBase}"!`);
    }
  });

  // Test 2: Path Traversal prevention in deleteModFile
  await runTest('deleteModFile rejects or sanitizes Path Traversal fileName', async () => {
    const testInstId = 'test-del-trap-' + Date.now();
    const modsDir = path.resolve(launcherCore.getInstanceModsDir(testInstId));
    
    // Create a dummy file outside mods dir
    const canaryFile = path.join(os.tmpdir(), 'canary_' + Date.now() + '.txt');
    fs.writeFileSync(canaryFile, 'CANARY_DO_NOT_DELETE');

    // Attempt to delete canary via relative traversal
    const relativePath = path.relative(modsDir, canaryFile);
    await launcherCore.deleteModFile(testInstId, 'dummy', relativePath);

    const canaryStillExists = fs.existsSync(canaryFile);
    try { fs.unlinkSync(canaryFile); } catch (e) {}
    await launcherCore.deleteInstanceFolder(testInstId);

    assert(canaryStillExists, 'deleteModFile should NOT delete files outside mods directory!');
  });

  // Test 3: Corrupted config.json recovery
  await runTest('loadConfig recovers gracefully when config.json is corrupted JSON', () => {
    const cfgPath = path.join(launcherCore.LAUNCHER_DATA_DIR, 'config.json');
    const backup = fs.existsSync(cfgPath) ? fs.readFileSync(cfgPath, 'utf8') : null;

    try {
      fs.writeFileSync(cfgPath, '{ INVALID_JSON :::: corrupt');
      const cfg = launcherCore.loadConfig();
      assert(cfg && typeof cfg === 'object', 'Must return valid fallback config object');
      assert(Array.isArray(cfg.accounts), 'Fallback must contain accounts');
    } finally {
      if (backup) fs.writeFileSync(cfgPath, backup, 'utf8');
    }
  });

  // Test 4: resolveJavaForVersion with empty/null/weird inputs
  await runTest('resolveJavaForVersion handles null/empty/snapshot version strings gracefully', () => {
    const rNull = launcherCore.resolveJavaForVersion(null);
    const rEmpty = launcherCore.resolveJavaForVersion('');
    const rSnap = launcherCore.resolveJavaForVersion('25w03a');
    const rOld = launcherCore.resolveJavaForVersion('1.7.10');

    assert(typeof rNull === 'string' && rNull.length > 0, 'null must return string');
    assert(typeof rEmpty === 'string' && rEmpty.length > 0, 'empty must return string');
    assert(typeof rSnap === 'string' && rSnap.length > 0, 'snapshot must return string');
    assert(typeof rOld === 'string' && rOld.length > 0, '1.7.10 must return string');
  });

  // Test 5: analyzeCrashLog with null/empty inputs
  await runTest('analyzeCrashLog handles null/undefined/empty string without throwing', () => {
    const r1 = launcherCore.analyzeCrashLog(null);
    const r2 = launcherCore.analyzeCrashLog(undefined);
    const r3 = launcherCore.analyzeCrashLog('');
    const r4 = launcherCore.analyzeCrashLog([]);

    assert(r1.type === 'Unknown', 'null must return Unknown');
    assert(r2.type === 'Unknown', 'undefined must return Unknown');
    assert(r3.type === 'Unknown', 'empty string must return Unknown');
    assert(r4.type === 'Unknown', 'empty array must return Unknown');
  });

  console.log('\n=== SUMMARY ===');
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  console.log(`Passed: ${passed}/${testResults.length}`);
  if (failed > 0) {
    console.error(`Failed: ${failed}/${testResults.length}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
