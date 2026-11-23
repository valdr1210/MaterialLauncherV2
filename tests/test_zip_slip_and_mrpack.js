const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const AdmZip = require('adm-zip');
const launcherCore = require('../launcherCore');

const testResults = [];

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    testResults.push({ name, passed: true });
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    testResults.push({ name, passed: false, error: err.message, stack: err.stack });
  }
}

async function main() {
  console.log('=== RUNNING ZIP SLIP & MRPACK AUDIT TESTS ===\n');

  const tmpDir = path.join(os.tmpdir(), 'mrpack_test_' + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });

  // Test 1: Zip Slip in overrides
  await runTest('importModpackMrpack rejects Zip Slip in overrides/..', async () => {
    const maliciousZipPath = path.join(tmpDir, 'malicious_overrides.mrpack');
    const zip = new AdmZip();

    const indexJson = {
      formatVersion: 1,
      game: 'minecraft',
      versionId: '1.0.0',
      name: 'Malicious Overrides Pack',
      dependencies: { minecraft: '1.20.1', 'fabric-loader': '0.15.0' },
      files: []
    };
    zip.addFile('modrinth.index.json', Buffer.from(JSON.stringify(indexJson)));
    // Add path traversal entry
    zip.addFile('overrides/../../escaped.txt', Buffer.from('HACKED'));
    zip.writeZip(maliciousZipPath);

    let threw = false;
    try {
      await launcherCore.importModpackMrpack(maliciousZipPath);
    } catch (err) {
      threw = true;
      assert(err.message.includes('Zip Slip'), `Error should mention Zip Slip, got: ${err.message}`);
    }
    assert(threw, 'Should throw on Zip Slip in overrides');
  });

  // Test 2: Zip Slip in client-overrides
  await runTest('importModpackMrpack rejects Zip Slip in client-overrides/..', async () => {
    const maliciousZipPath = path.join(tmpDir, 'malicious_client_overrides.mrpack');
    const zip = new AdmZip();

    const indexJson = {
      formatVersion: 1,
      game: 'minecraft',
      versionId: '1.0.0',
      name: 'Malicious Client Overrides Pack',
      dependencies: { minecraft: '1.20.1' },
      files: []
    };
    zip.addFile('modrinth.index.json', Buffer.from(JSON.stringify(indexJson)));
    zip.addFile('client-overrides/../../../windows/system32/evil.dll', Buffer.from('HACKED'));
    zip.writeZip(maliciousZipPath);

    let threw = false;
    try {
      await launcherCore.importModpackMrpack(maliciousZipPath);
    } catch (err) {
      threw = true;
      assert(err.message.includes('Zip Slip'), `Error should mention Zip Slip, got: ${err.message}`);
    }
    assert(threw, 'Should throw on Zip Slip in client-overrides');
  });

  // Test 3: Zip Slip in files[].path in modrinth.index.json
  await runTest('importModpackMrpack rejects Zip Slip in modrinth.index.json files[].path', async () => {
    const maliciousZipPath = path.join(tmpDir, 'malicious_manifest_files.mrpack');
    const zip = new AdmZip();

    const indexJson = {
      formatVersion: 1,
      game: 'minecraft',
      versionId: '1.0.0',
      name: 'Malicious Files Path Pack',
      dependencies: { minecraft: '1.20.1' },
      files: [
        {
          path: '../../outside_game_dir/evil.jar',
          hashes: { sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709' },
          env: { client: 'required' },
          downloads: ['https://example.com/evil.jar'],
          fileSize: 100
        }
      ]
    };
    zip.addFile('modrinth.index.json', Buffer.from(JSON.stringify(indexJson)));
    zip.writeZip(maliciousZipPath);

    let threw = false;
    try {
      await launcherCore.importModpackMrpack(maliciousZipPath);
    } catch (err) {
      threw = true;
      assert(err.message.includes('Zip Slip'), `Error should mention Zip Slip, got: ${err.message}`);
    }
    assert(threw, 'Should throw on Zip Slip in manifest files[].path');
  });

  // Test 4: Valid .mrpack import
  await runTest('importModpackMrpack successfully unpacks legitimate .mrpack', async () => {
    const validZipPath = path.join(tmpDir, 'valid_pack.mrpack');
    const zip = new AdmZip();

    const indexJson = {
      formatVersion: 1,
      game: 'minecraft',
      versionId: '1.0.0',
      name: 'Valid Test Pack',
      dependencies: { minecraft: '1.20.1', 'fabric-loader': '0.15.11' },
      files: []
    };
    zip.addFile('modrinth.index.json', Buffer.from(JSON.stringify(indexJson)));
    zip.addFile('overrides/options.txt', Buffer.from('gamma:1.0\nguiScale:2\n'));
    zip.addFile('client-overrides/servers.dat', Buffer.from('servers data'));
    zip.writeZip(validZipPath);

    const res = await launcherCore.importModpackMrpack(validZipPath);
    assert(res.success, 'Import should succeed');
    assert(res.instanceId, 'Should return instanceId');
    assert.strictEqual(res.instanceName, 'Valid Test Pack');

    // Verify files were extracted to instance directory
    const instDir = launcherCore.getInstanceDir(res.instanceId);
    assert(fs.existsSync(path.join(instDir, 'options.txt')), 'overrides/options.txt should be extracted');
    assert(fs.existsSync(path.join(instDir, 'servers.dat')), 'client-overrides/servers.dat should be extracted');

    // Clean up created instance
    await launcherCore.deleteInstanceFolder(res.instanceId);
    const cfg = launcherCore.loadConfig();
    cfg.instances = cfg.instances.filter(i => i.id !== res.instanceId);
    launcherCore.saveConfig(cfg);
  });

  // Cleanup tmp dir
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n=== SUMMARY ===');
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  console.log(`Passed: ${passed}/${testResults.length}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('ALL ZIP SLIP TESTS PASSED!');
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
