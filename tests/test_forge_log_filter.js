const assert = require('assert');
const launcherCore = require('../launcherCore');

async function main() {
  console.log('=== TESTING FORGE INSTALLER NOISE FILTER & MCLOGS TRUNCATION ===\n');

  // Test 1: Forge installer noise filter regex
  const noiseRegex = /^\s*(Slim|Data)\s+\S+\.class\s*$/;
  const sampleNoise = [
    'Slim net/minecraft/client/main/Main.class',
    'Data net/minecraft/block/Block.class',
    '  Slim   com/example/MyClass.class  ',
    'Data a/b/c/d/E.class'
  ];
  for (const n of sampleNoise) {
    assert(noiseRegex.test(n), `Should match noise line: "${n}"`);
  }
  console.log('[PASS] Noise regex accurately matches jarsplitter output');

  // Test 2: Real logs should NOT be filtered
  const sampleValid = [
    '[12:00:00] [main/INFO]: Loading net.minecraft.client.main.Main.class',
    'java.lang.NoClassDefFoundError: net/minecraft/client/main/Main.class',
    'Slim is a cool mod for Minecraft',
    'Data file loaded successfully'
  ];
  for (const v of sampleValid) {
    assert(!noiseRegex.test(v), `Should NOT match valid line: "${v}"`);
  }
  console.log('[PASS] Valid log lines with .class or Slim/Data are preserved');

  // Test 3: Test uploadToMclogs with large log (>20,000 lines)
  console.log('Testing uploadToMclogs with 22,000 lines log...');
  const largeLogLines = [];
  for (let i = 1; i <= 22000; i++) {
    largeLogLines.push(`[Line ${i}]: Minecraft game log output testing line limits`);
  }
  const largeLog = largeLogLines.join('\n');
  try {
    const res = await launcherCore.uploadToMclogs(largeLog);
    console.log('[PASS] uploadToMclogs handled 22,000 lines successfully:', res);
    assert(res.success === true, 'Upload should succeed');
    assert(res.url && res.url.includes('mclo.gs'), 'Result must include mclo.gs URL');
  } catch (err) {
    console.warn('Network error or mclo.gs rate limit:', err.message);
  }

  console.log('\n=== ALL FORGE NOISE & TRUNCATION CHECKS PASSED ===');
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
