const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const JAVA_SRC = 'android-src';
const PACKAGE_PATH = ['com', 'octoclass', 'mobile'];

/**
 * Ordem dos mods no prebuild: withMainApplication altera o conteúdo do MainApplication
 * no pipeline (antes de escrever); withDangerousMod corre depois e pode encontrar
 * o ficheiro já em disco. Mantemos ambos: withMainApplication para o template em memória,
 * findAndPatchMainApplication como fallback caso o ficheiro já exista no platformProjectRoot.
 * Ver: https://docs.expo.dev/config-plugins/mods
 */
function copyJavaSources(projectRoot, platformProjectRoot) {
  const srcDir = path.join(projectRoot, JAVA_SRC, ...PACKAGE_PATH);
  const destDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'java', ...PACKAGE_PATH);
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const files = ['DeviceAdminReceiver.java', 'KioskModule.java', 'KioskModulePackage.java', 'MdmSyncService.java'];
  for (const file of files) {
    const src = path.join(srcDir, file);
    const dest = path.join(destDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }
}

function patchMainApplicationFile(filePath, contents) {
  if (contents.includes('add(com.octoclass.mobile.KioskModulePackage())')) return contents;
  const isKotlin = filePath.endsWith('.kt');
  if (isKotlin) {
    let out = contents;
    if (out.includes('.packages.apply {')) {
      out = out.replace(
        /(PackageList\(this\)\.packages\.apply\s*\{\s*\n)/,
        '$1              add(com.octoclass.mobile.KioskModulePackage())\n'
      );
    } else {
      out = out.replace(
        /PackageList\(this\)\.packages(?!\.apply)/,
        'PackageList(this).packages.apply { add(com.octoclass.mobile.KioskModulePackage()) }'
      );
    }
    if (out !== contents && !out.includes('import com.octoclass.mobile.KioskModulePackage')) {
      out = out.replace(
        /(import\s+com\.facebook\.react\.PackageList\s*\n)/,
        '$1import com.octoclass.mobile.KioskModulePackage\n'
      );
    }
    return out;
  }
  let out = contents.replace(
    /return\s+new\s+PackageList\s*\(\s*this\s*\)\s*\.getPackages\s*\(\s*\)\s*;/,
    'List<ReactPackage> packages = new PackageList(this).getPackages();\n      packages.add(new com.octoclass.mobile.KioskModulePackage());\n      return packages;'
  );
  if (out !== contents && !out.includes('import com.octoclass.mobile.KioskModulePackage')) {
    out = out.replace(
      /(import\s+java\.util\.List;\s*\n)/,
      '$1import com.octoclass.mobile.KioskModulePackage;\n'
    );
  }
  return out;
}

function findAndPatchMainApplication(platformProjectRoot) {
  const javaDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'java');
  if (!fs.existsSync(javaDir)) return;
  const dirs = fs.readdirSync(javaDir, { withFileTypes: true }).filter(d => d.isDirectory());
  for (const dir of dirs) {
    const searchInDir = (dirPath) => {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dirPath, e.name);
        if (e.isDirectory()) searchInDir(full);
        else if (e.name === 'MainApplication.java' || e.name === 'MainApplication.kt') {
          let c = fs.readFileSync(full, 'utf8');
          const patched = patchMainApplicationFile(full, c);
          if (patched !== c) {
            fs.writeFileSync(full, patched);
          }
        }
      }
    };
    searchInDir(path.join(javaDir, dir.name));
  }
}

const withKioskMode = (config) => {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const app = config.modResults.manifest.application?.[0];
    if (app && !app.$) app.$ = {};
    if (app?.$) app.$['android:usesCleartextTraffic'] = true;
    if (!manifest['uses-permission']) manifest['uses-permission'] = [];
    const perms = manifest['uses-permission'];
    const hasModifyAudio = perms.some(p => p.$?.['android:name'] === 'android.permission.MODIFY_AUDIO_SETTINGS');
    if (!hasModifyAudio) perms.push({ $: { 'android:name': 'android.permission.MODIFY_AUDIO_SETTINGS' } });
    const hasWriteSettings = perms.some(p => p.$?.['android:name'] === 'android.permission.WRITE_SETTINGS');
    if (!hasWriteSettings) perms.push({ $: { 'android:name': 'android.permission.WRITE_SETTINGS' } });
    const hasInternet = perms.some(p => p.$?.['android:name'] === 'android.permission.INTERNET');
    if (!hasInternet) perms.push({ $: { 'android:name': 'android.permission.INTERNET' } });
    const hasCamera = perms.some(p => p.$?.['android:name'] === 'android.permission.CAMERA');
    if (!hasCamera) perms.push({ $: { 'android:name': 'android.permission.CAMERA' } });
    const hasManagePackageState = perms.some(p => p.$?.['android:name'] === 'android.permission.MANAGE_DEVICE_POLICY_PACKAGE_STATE');
    if (!hasManagePackageState) perms.push({ $: { 'android:name': 'android.permission.MANAGE_DEVICE_POLICY_PACKAGE_STATE' } });
    const hasForegroundService = perms.some(p => p.$?.['android:name'] === 'android.permission.FOREGROUND_SERVICE');
    if (!hasForegroundService) perms.push({ $: { 'android:name': 'android.permission.FOREGROUND_SERVICE' } });
    const hasForegroundServiceDataSync = perms.some(p => p.$?.['android:name'] === 'android.permission.FOREGROUND_SERVICE_DATA_SYNC');
    if (!hasForegroundServiceDataSync) perms.push({ $: { 'android:name': 'android.permission.FOREGROUND_SERVICE_DATA_SYNC' } });
    const hasPackageUsageStats = perms.some(p => p.$?.['android:name'] === 'android.permission.PACKAGE_USAGE_STATS');
    if (!hasPackageUsageStats) perms.push({ $: { 'android:name': 'android.permission.PACKAGE_USAGE_STATS' } });

    if (!config.modResults.manifest.application[0].receiver) {
      config.modResults.manifest.application[0].receiver = [];
    }

    config.modResults.manifest.application[0].receiver.push({
      $: {
        'android:name': '.DeviceAdminReceiver',
        'android:label': 'Octoclass Device Admin',
        'android:permission': 'android.permission.BIND_DEVICE_ADMIN',
        'android:exported': 'true'
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.app.action.DEVICE_ADMIN_ENABLED' } }
          ]
        }
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.app.device_admin',
            'android:resource': '@xml/device_admin'
          }
        }
      ]
    });

    if (!config.modResults.manifest.application[0].service) {
      config.modResults.manifest.application[0].service = [];
    }
    config.modResults.manifest.application[0].service.push({
      $: {
        'android:name': '.MdmSyncService',
        'android:enabled': 'true',
        'android:exported': 'false',
        'android:foregroundServiceType': 'dataSync'
      }
    });

    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const { projectRoot, platformProjectRoot } = config.modRequest;
      const resPath = path.join(platformProjectRoot, 'app/src/main/res');
      const xmlPath = path.join(resPath, 'xml');

      if (!fs.existsSync(xmlPath)) {
        fs.mkdirSync(xmlPath, { recursive: true });
      }

      const sourcePath = path.join(projectRoot, 'assets/device_admin.xml');
      const destPath = path.join(xmlPath, 'device_admin.xml');

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
      }

      copyJavaSources(projectRoot, platformProjectRoot);
      findAndPatchMainApplication(platformProjectRoot);
      return config;
    },
  ]);

  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes('add(com.octoclass.mobile.KioskModulePackage())') || contents.includes('add(KioskModulePackage())')) return config;

    const kioskAddJava = 'List<ReactPackage> packages = new PackageList(this).getPackages();\n      packages.add(new com.octoclass.mobile.KioskModulePackage());\n      return packages;';
    const kioskAddKotlin = 'PackageList(this).packages.apply { add(com.octoclass.mobile.KioskModulePackage()) }';

    if (contents.includes('return new PackageList(this).getPackages();')) {
      contents = contents.replace(
        'return new PackageList(this).getPackages();',
        kioskAddJava
      );
      if (contents.includes('import java.util.List;')) {
        contents = contents.replace(
          'import java.util.List;',
          'import java.util.List;\nimport com.octoclass.mobile.KioskModulePackage;'
        );
      }
    } else if (contents.includes('PackageList(this).getPackages()')) {
      contents = contents.replace(
        /return\s+new\s+PackageList\(this\)\.getPackages\(\);/,
        kioskAddJava
      );
      contents = contents.replace(
        /import java\.util\.List;/,
        'import java.util.List;\nimport com.octoclass.mobile.KioskModulePackage;'
      );
    } else if (contents.includes('PackageList(this).packages') && !contents.includes('add(com.octoclass.mobile.KioskModulePackage())')) {
      if (contents.includes('.packages.apply {')) {
        contents = contents.replace(
          /(PackageList\(this\)\.packages\.apply\s*\{\s*\n)/,
          '$1              add(com.octoclass.mobile.KioskModulePackage())\n'
        );
      } else {
        contents = contents.replace(
          /PackageList\(this\)\.packages(?!\.apply)/,
          'PackageList(this).packages.apply { add(com.octoclass.mobile.KioskModulePackage()) }'
        );
      }
      if (!contents.includes('import com.octoclass.mobile.KioskModulePackage')) {
        contents = contents.replace(
          /(import\s+com\.facebook\.react\.PackageList\s*\n)/,
          '$1import com.octoclass.mobile.KioskModulePackage\n'
        );
      }
    }
    config.modResults.contents = contents;
    return config;
  });

  return config;
};

module.exports = withKioskMode;
