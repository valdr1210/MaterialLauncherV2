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
        testResults.push({ name, passed: false, error: err.message, stack: err.stack });
      });
    } else {
      console.log(`[PASS] ${name}`);
      testResults.push({ name, passed: true });
    }
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    testResults.push({ name, passed: false, error: err.message, stack: err.stack });
  }
}

async function main() {
  console.log('=== RUNNING LAUNCHER CORE UNIT TESTS ===\n');

  // Test 1: findInstalledJavas
  await runTest('findInstalledJavas() returns array with valid structure', () => {
    const list = launcherCore.findInstalledJavas();
    assert(Array.isArray(list), 'Must return an array');
    console.log(`  Found ${list.length} Java candidates`);
    for (const j of list) {
      assert(j.path, 'Java candidate must have path');
      assert(j.major, 'Java candidate must have major version number');
      assert(typeof j.major === 'number', 'major must be a number');
      assert(j.version, 'Java candidate must have version string');
    }
  });

  // Test 2: resolveJavaForVersion
  await runTest('resolveJavaForVersion() resolves Java for version tiers', () => {
    const j26 = launcherCore.resolveJavaForVersion('26.1.2');
    const j21 = launcherCore.resolveJavaForVersion('1.21.4');
    const j17 = launcherCore.resolveJavaForVersion('1.20.1');
    const jOld = launcherCore.resolveJavaForVersion('1.16.5');

    assert(typeof j26 === 'string' && j26.length > 0, '26.1.2 must return a java path or javaw');
    assert(typeof j21 === 'string' && j21.length > 0, '1.21.4 must return a java path or javaw');
    assert(typeof j17 === 'string' && j17.length > 0, '1.20.1 must return a java path or javaw');
    assert(typeof jOld === 'string' && jOld.length > 0, '1.16.5 must return a java path or javaw');

    // Manual path override test
    const dummyPath = path.join(os.tmpdir(), 'dummy_javaw.exe');
    fs.writeFileSync(dummyPath, '');
    const manualResolved = launcherCore.resolveJavaForVersion('1.21.4', false, dummyPath);
    assert.strictEqual(manualResolved, dummyPath, 'Manual path must be returned when isAuto is false');
    try { fs.unlinkSync(dummyPath); } catch (e) {}
  });

  // Test 3: getVersionManifest
  await runTest('getVersionManifest() returns versions list and latest release', async () => {
    const manifest = await launcherCore.getVersionManifest();
    assert(manifest && typeof manifest === 'object', 'Manifest must be an object');
    assert(manifest.latest, 'Manifest must have latest');
    assert(manifest.latest.release, 'Manifest must specify latest release');
    assert(Array.isArray(manifest.versions) && manifest.versions.length > 0, 'Manifest must contain versions array');
    assert(manifest.versions.some(v => v.id), 'Version items must have id property');
  });

  // Test 4: analyzeCrashLog - diagnosis patterns
  await runTest('analyzeCrashLog() diagnoses OutOfMemoryError', () => {
    const res = launcherCore.analyzeCrashLog('java.lang.OutOfMemoryError: Java heap space\n\tat net.minecraft.client.main.Main.main');
    assert.strictEqual(res.type, 'OutOfMemory');
    assert(res.title.includes('OutOfMemoryError'));
    assert.strictEqual(res.severity, 'error');
  });

  await runTest('analyzeCrashLog() diagnoses UnsupportedClassVersionError (Java Mismatch)', () => {
    const res = launcherCore.analyzeCrashLog('Exception in thread "main" java.lang.UnsupportedClassVersionError: net/minecraft/client/main/Main has been compiled by a more recent version of the Java Runtime (class file version 65.0), this compiler only recognizes class file versions up to 61.0');
    assert.strictEqual(res.type, 'JavaMismatch');
    assert(res.title.includes('UnsupportedClassVersionError'));
  });

  await runTest('analyzeCrashLog() diagnoses DuplicateModsException', () => {
    const res = launcherCore.analyzeCrashLog('net.fabricmc.loader.impl.FormattedException: DuplicateModsException: Found duplicate mods: sodium');
    assert.strictEqual(res.type, 'DuplicateMods');
  });

  await runTest('analyzeCrashLog() diagnoses MixinApplyError and identifies mod hint', () => {
    const res = launcherCore.analyzeCrashLog('org.spongepowered.asm.mixin.transformer.throwables.MixinApplyError: Mixin apply failed mod.mixins.json:RenderMixin');
    assert.strictEqual(res.type, 'MixinError');
    assert(res.description.includes('RenderMixin') || res.description.includes('mod.mixins.json'), 'Description should hint at failing mixin: ' + res.description);
  });

  await runTest('analyzeCrashLog() diagnoses generic Exit code: 1', () => {
    const res = launcherCore.analyzeCrashLog('Process crashed with exit code 1');
    assert.strictEqual(res.type, 'GenericCrash');
  });

  await runTest('analyzeCrashLog() returns Unknown for normal logs', () => {
    const res = launcherCore.analyzeCrashLog('[12:00:00] [main/INFO]: Normal game output');
    assert.strictEqual(res.type, 'Unknown');
  });

  // Test 5: toggleModState & Mod management
  await runTest('toggleModState() soft-disables and re-enables mod file', async () => {
    const testInstId = 'test-inst-' + Date.now();
    const instDir = launcherCore.getInstanceDir(testInstId);
    const modsDir = launcherCore.getInstanceModsDir(testInstId);

    // Setup dummy mod file
    const modJarName = 'test-mod-1.0.jar';
    const modJarPath = path.join(modsDir, modJarName);
    fs.writeFileSync(modJarPath, 'dummy jar content');

    // Add instance to config
    const cfg = launcherCore.loadConfig();
    if (!Array.isArray(cfg.instances)) cfg.instances = [];
    cfg.instances.push({
      id: testInstId,
      name: 'Test Instance',
      gameVersion: '1.20.1',
      loader: 'fabric',
      mods: [{ id: 'test-mod', fileName: modJarName, disabled: false }]
    });
    launcherCore.saveConfig(cfg);

    // Disable mod
    const resDisable = await launcherCore.toggleModState(testInstId, 'test-mod', false);
    assert.strictEqual(resDisable.disabled, true);
    assert(fs.existsSync(path.join(modsDir, modJarName + '.disabled')), '.jar.disabled file must exist');
    assert(!fs.existsSync(modJarPath), 'original .jar must not exist');

    // Re-enable mod
    const resEnable = await launcherCore.toggleModState(testInstId, 'test-mod', true);
    assert.strictEqual(resEnable.disabled, false);
    assert(fs.existsSync(modJarPath), 'original .jar must be restored');
    assert(!fs.existsSync(path.join(modsDir, modJarName + '.disabled')), '.jar.disabled must be removed');

    // Cleanup instance folder
    await launcherCore.deleteInstanceFolder(testInstId);
    // Cleanup from config
    const updatedCfg = launcherCore.loadConfig();
    updatedCfg.instances = updatedCfg.instances.filter(i => i.id !== testInstId);
    launcherCore.saveConfig(updatedCfg);
  });

  // Test 6: deleteModFile
  await runTest('deleteModFile() deletes both .jar and .jar.disabled', async () => {
    const testInstId = 'test-inst-del-' + Date.now();
    const modsDir = launcherCore.getInstanceModsDir(testInstId);
    const f1 = path.join(modsDir, 'mod-a.jar');
    const f2 = path.join(modsDir, 'mod-b.jar.disabled');
    fs.writeFileSync(f1, 'a');
    fs.writeFileSync(f2, 'b');

    await launcherCore.deleteModFile(testInstId, 'mod-a', 'mod-a.jar');
    assert(!fs.existsSync(f1), 'mod-a.jar must be unlinked');

    await launcherCore.deleteModFile(testInstId, 'mod-b', 'mod-b.jar');
    assert(!fs.existsSync(f2), 'mod-b.jar.disabled must be unlinked');

    await launcherCore.deleteInstanceFolder(testInstId);
  });

  // Test 7: deleteInstanceFolder
  await runTest('deleteInstanceFolder() deletes instance directory safely', async () => {
    const testInstId = 'test-inst-rm-' + Date.now();
    const instDir = launcherCore.getInstanceDir(testInstId);
    fs.writeFileSync(path.join(instDir, 'test.txt'), 'hello');
    assert(fs.existsSync(instDir), 'Directory should exist before delete');

    await launcherCore.deleteInstanceFolder(testInstId);
    assert(!fs.existsSync(instDir), 'Directory should not exist after delete');
  });

  // Test 8: Token Encryption integration with loadConfig and saveConfig (with backup/restore)
  await runTest('Token encryption in loadConfig and saveConfig', () => {
    const liveConfigPath = path.join(launcherCore.LAUNCHER_DATA_DIR, 'config.json');
    const backupContent = fs.existsSync(liveConfigPath) ? fs.readFileSync(liveConfigPath, 'utf8') : null;

    try {
      let encryptCalls = 0;
      let decryptCalls = 0;

      launcherCore.setCryptoHelpers({
        encryptToken: (t) => {
          if (!t || t.startsWith('enc:')) return t;
          encryptCalls++;
          return 'enc:' + Buffer.from(t).toString('base64');
        },
        decryptToken: (t) => {
          if (!t || !t.startsWith('enc:')) return t;
          decryptCalls++;
          return Buffer.from(t.slice(4), 'base64').toString('utf8');
        }
      });

      const testCfg = {
        accounts: [
          {
            type: 'mojang',
            name: 'TestEncUser',
            uuid: 'uuid-123',
            access_token: 'secret_plain_access_token',
            refresh_token: 'secret_plain_refresh_token',
            active: false
          }
        ],
        selectedVersion: '1.20.1'
      };

      // Save config - should encrypt tokens
      launcherCore.saveConfig(testCfg);
      assert(encryptCalls >= 2, 'encryptToken should have been called on tokens');

      // Read raw file on disk to verify plaintext was NOT stored
      const rawContent = fs.readFileSync(liveConfigPath, 'utf8');
      assert(!rawContent.includes('secret_plain_access_token'), 'config.json ON DISK must NOT contain plaintext access_token');
      assert(!rawContent.includes('secret_plain_refresh_token'), 'config.json ON DISK must NOT contain plaintext refresh_token');
      assert(rawContent.includes('enc:'), 'config.json ON DISK must contain enc: tokens');

      // Load config - should decrypt tokens back in memory
      const loadedCfg = launcherCore.loadConfig();
      const foundAcc = loadedCfg.accounts.find(a => a.name === 'TestEncUser');
      assert(foundAcc, 'Account must be loaded');
      assert.strictEqual(foundAcc.access_token, 'secret_plain_access_token', 'access_token in memory must be decrypted');
      assert.strictEqual(foundAcc.refresh_token, 'secret_plain_refresh_token', 'refresh_token in memory must be decrypted');
    } finally {
      launcherCore.setCryptoHelpers({
        encryptToken: (t) => t,
        decryptToken: (t) => t
      });
      // Restore original config
      if (backupContent) {
        fs.writeFileSync(liveConfigPath, backupContent, 'utf8');
      }
    }
  });

  // Test 14: getMinecraftDir custom path support
  await runTest('getMinecraftDir() respects custom path and falls back to default', () => {
    const defaultDir = launcherCore.getDefaultMinecraftDir();
    assert(defaultDir, 'Default directory must exist');
    assert.strictEqual(launcherCore.getMinecraftDir({}), defaultDir, 'Empty config must return default directory');
    assert.strictEqual(launcherCore.getMinecraftDir({ minecraftPath: '' }), defaultDir, 'Empty string must return default directory');
    assert.strictEqual(launcherCore.getMinecraftDir({ minecraftPath: '   ' }), defaultDir, 'Whitespace string must return default directory');

    const tempCustom = path.join(os.tmpdir(), 'mat_mc_custom_test_' + Date.now());
    const customResult = launcherCore.getMinecraftDir({ minecraftPath: tempCustom });
    assert.strictEqual(customResult, path.resolve(tempCustom), 'Must resolve custom path');
    assert(fs.existsSync(tempCustom), 'Must create directory if missing');
    try {
      fs.rmdirSync(tempCustom);
    } catch (e) {}
  });

  // Test 15: inspectMinecraftDir
  await runTest('inspectMinecraftDir() detects existence and file count', () => {
    const nonExistent = path.join(os.tmpdir(), 'non_existent_mc_' + Date.now());
    const res1 = launcherCore.inspectMinecraftDir(nonExistent);
    assert.strictEqual(res1.exists, false, 'Non-existent must report exists=false');

    const emptyDir = path.join(os.tmpdir(), 'empty_mc_test_' + Date.now());
    fs.mkdirSync(emptyDir, { recursive: true });
    const res2 = launcherCore.inspectMinecraftDir(emptyDir);
    assert.strictEqual(res2.exists, true, 'Empty dir must exist');
    assert.strictEqual(res2.hasFiles, false, 'Empty dir must have hasFiles=false');
    assert.strictEqual(res2.count, 0, 'Empty dir count must be 0');

    fs.writeFileSync(path.join(emptyDir, 'options.txt'), 'version:1', 'utf8');
    const res3 = launcherCore.inspectMinecraftDir(emptyDir);
    assert.strictEqual(res3.exists, true);
    assert.strictEqual(res3.hasFiles, true);
    assert.strictEqual(res3.count, 1);

    try {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    } catch (e) {}
  });

  // Test 16: migrateMinecraftDir move, keep and delete actions
  await runTest('migrateMinecraftDir() handles move, keep, and delete modes', async () => {
    const oldDir = path.join(os.tmpdir(), 'old_mc_' + Date.now());
    const newDir = path.join(os.tmpdir(), 'new_mc_' + Date.now());

    fs.mkdirSync(path.join(oldDir, 'mods'), { recursive: true });
    fs.writeFileSync(path.join(oldDir, 'options.txt'), 'fov:70', 'utf8');
    fs.writeFileSync(path.join(oldDir, 'mods', 'example.jar'), 'fake-jar-data', 'utf8');

    // Test 'move'
    const moveRes = await launcherCore.migrateMinecraftDir(oldDir, newDir, 'move');
    assert(moveRes.success, 'Move must succeed');
    assert(fs.existsSync(newDir), 'New directory must exist');
    assert(fs.existsSync(path.join(newDir, 'options.txt')), 'options.txt must be copied');
    assert(fs.existsSync(path.join(newDir, 'mods', 'example.jar')), 'mods/example.jar must be copied');
    assert.strictEqual(fs.readFileSync(path.join(newDir, 'options.txt'), 'utf8'), 'fov:70');

    // Test 'keep'
    const keepNew = path.join(os.tmpdir(), 'keep_mc_' + Date.now());
    const keepRes = await launcherCore.migrateMinecraftDir(newDir, keepNew, 'keep');
    assert(keepRes.success, 'Keep must succeed');
    assert(fs.existsSync(keepNew), 'keepNew must exist');
    assert(fs.existsSync(newDir), 'newDir must still exist');

    // Test 'delete'
    const delRes = await launcherCore.migrateMinecraftDir(newDir, keepNew, 'delete');
    assert(delRes.success, 'Delete must succeed');

    try {
      fs.rmSync(oldDir, { recursive: true, force: true });
      fs.rmSync(newDir, { recursive: true, force: true });
      fs.rmSync(keepNew, { recursive: true, force: true });
    } catch (e) {}
  });

  await runTest('Test 17: getLoaderVersions returns empty array for vanilla/invalid and valid structure for mod loaders', async () => {
    const vanillaRes = await launcherCore.getLoaderVersions('vanilla', '1.21.1');
    assert(Array.isArray(vanillaRes) && vanillaRes.length === 0, 'Vanilla must return empty array');

    const emptyRes = await launcherCore.getLoaderVersions('', '');
    assert(Array.isArray(emptyRes) && emptyRes.length === 0, 'Empty loader/gameVersion must return empty array');

    const fabricRes = await launcherCore.getLoaderVersions('fabric', '1.21.1');
    assert(Array.isArray(fabricRes), 'Fabric result must be an array');
    if (fabricRes.length > 0) {
      assert(typeof fabricRes[0].version === 'string' && fabricRes[0].version.length > 0, 'Fabric version item must have version string');
    }
  });

  await runTest('Test 18: exportInstance and importInstance round-trip', async () => {
    const tmpZip = path.join(os.tmpdir(), `ml_test_export_${Date.now()}.zip`);
    const tmpId = `inst-test-${Date.now()}`;
    const cfgBackup = launcherCore.loadConfig();
    const origInstances = Array.isArray(cfgBackup.instances) ? [...cfgBackup.instances] : [];
    const origSelected = cfgBackup.selectedInstanceId;
    let importedId = null;

    try {
      const instDir = launcherCore.getInstanceDir(tmpId);
      const modsDir = path.join(instDir, 'mods');
      fs.mkdirSync(modsDir, { recursive: true });
      fs.writeFileSync(path.join(modsDir, 'sample-mod.jar'), 'dummy-jar-bytes');

      cfgBackup.instances = [
        ...origInstances,
        {
          id: tmpId,
          name: 'Test Export Pack',
          gameVersion: '1.20.1',
          loader: 'forge',
          loaderVersion: '47.4.10',
          modProvider: 'modrinth',
          mods: [{ id: 'sample-mod', title: 'Sample Mod' }]
        }
      ];
      launcherCore.saveConfig(cfgBackup);

      const expRes = await launcherCore.exportInstance(tmpId, tmpZip);
      assert(expRes.success && fs.existsSync(tmpZip), 'Exported zip must exist');

      const impRes = await launcherCore.importInstance(tmpZip);
      assert(impRes.success && impRes.instanceId, 'Import must succeed');
      importedId = impRes.instanceId;

      const afterCfg = launcherCore.loadConfig();
      const importedInst = (afterCfg.instances || []).find(i => i.id === importedId);
      assert(importedInst && importedInst.name === 'Test Export Pack', 'Imported instance metadata must match');
      assert(importedInst.loaderVersion === '47.4.10', 'Imported loaderVersion must match');

      const importedModPath = path.join(launcherCore.getInstanceDir(importedId), 'mods', 'sample-mod.jar');
      assert(fs.existsSync(importedModPath), 'Imported mod file must exist on disk');
    } finally {
      const restoreCfg = launcherCore.loadConfig();
      restoreCfg.instances = origInstances;
      restoreCfg.selectedInstanceId = origSelected;
      launcherCore.saveConfig(restoreCfg);
      if (fs.existsSync(tmpZip)) fs.rmSync(tmpZip, { force: true });
      await launcherCore.deleteInstanceFolder(tmpId);
      if (importedId) await launcherCore.deleteInstanceFolder(importedId);
    }
  });

  console.log('\n=== SUMMARY ===');
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  console.log(`Passed: ${passed}/${testResults.length}`);
  if (failed > 0) {
    console.error(`Failed: ${failed}/${testResults.length}`);
    process.exit(1);
  } else {
    console.log('ALL LAUNCHER CORE TESTS PASSED!');
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
