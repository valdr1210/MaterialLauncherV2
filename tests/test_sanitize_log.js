const assert = require('assert');
const launcherCore = require('../launcherCore');

function main() {
  console.log('=== TESTING LOG SANITIZATION ===\n');

  // If sanitizeLog is not exported, we can check uploadToMclogs or inspect launcherCore
  if (typeof launcherCore.sanitizeLog !== 'function') {
    console.error('[FAIL/DEFECT] launcherCore.sanitizeLog is not exported!');
  }

  // Let's test the regex directly or sanitizeLog if available
  const sampleWindowsForwardSlash = 'Loading file from C:/Users/JohnDoe/AppData/Roaming/.minecraft/logs/latest.log';
  const sampleMacPath = 'Loading file from /Users/JohnDoe/Library/Application Support/minecraft/logs/latest.log';
  const sampleToken = 'Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretpayload1234567890';
  const sampleIp = 'Connecting to 192.168.1.45:25565';

  if (launcherCore.sanitizeLog) {
    const s1 = launcherCore.sanitizeLog(sampleWindowsForwardSlash);
    const s2 = launcherCore.sanitizeLog(sampleMacPath);
    const s3 = launcherCore.sanitizeLog(sampleToken);
    const s4 = launcherCore.sanitizeLog(sampleIp);

    assert(!s1.includes('JohnDoe'), 'Windows forward slash user must be redacted: ' + s1);
    assert(!s2.includes('JohnDoe'), 'macOS /Users/ user must be redacted: ' + s2);
    assert(!s3.includes('secretpayload'), 'Token must be redacted: ' + s3);
    assert(!s4.includes('192.168.1.45'), 'IP must be redacted: ' + s4);
    console.log('[PASS] All log sanitization checks passed!');
  } else {
    process.exit(1);
  }
}

main();
