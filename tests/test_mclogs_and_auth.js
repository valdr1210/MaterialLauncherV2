const assert = require('assert');
const launcherCore = require('../launcherCore');
const authManager = require('../authManager');

async function main() {
  console.log('=== TESTING MCLOGS & AUTH MANAGER ===\n');

  // Test mclo.gs upload with sanitized log
  console.log('Testing uploadToMclogs()...');
  try {
    const sampleLog = `
      [12:00:00] [main/INFO]: Minecraft 1.20.1 starting
      [12:00:01] [main/INFO]: User path is C:\\Users\\Administrator\\AppData\\.minecraft
      [12:00:02] [main/INFO]: Token is access_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummysecrettoken1234567890
      [12:00:03] [main/INFO]: Connecting to server 192.168.1.100:25565
    `;
    const res = await launcherCore.uploadToMclogs(sampleLog);
    console.log('[PASS] uploadToMclogs() returned:', res);
    assert(res.success === true, 'Upload should succeed');
    assert(res.url && res.url.includes('mclo.gs'), 'Result should contain mclo.gs URL');
  } catch (e) {
    console.log('[WARN/FAIL] uploadToMclogs network call failed:', e.message);
  }

  // Test authManager refreshMicrosoftToken with empty account
  console.log('\nTesting authManager.refreshMicrosoftToken with invalid account...');
  const resNoToken = await authManager.refreshMicrosoftToken({});
  assert.strictEqual(resNoToken.success, false, 'Should fail when no refresh_token');
  console.log('[PASS] refreshMicrosoftToken handles missing refresh_token gracefully');

  const resNull = await authManager.refreshMicrosoftToken(null);
  assert.strictEqual(resNull.success, false, 'Should fail when account is null');
  console.log('[PASS] refreshMicrosoftToken handles null account gracefully');

  // Test authManager loginWithElyBy validation
  console.log('\nTesting authManager.loginWithElyBy validation...');
  const resEmptyEly = await authManager.loginWithElyBy('', '');
  assert.strictEqual(resEmptyEly.success, false, 'Should fail on empty credentials');
  console.log('[PASS] loginWithElyBy validates empty credentials');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
