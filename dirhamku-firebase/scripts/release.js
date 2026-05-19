const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const packageJsonPath = path.join(__dirname, '../package.json');
const versionJsonPath = path.join(__dirname, '../public/version.json');
const appJsPath = path.join(__dirname, '../public/app.js');
const swJsPath = path.join(__dirname, '../public/sw.js');
const indexHtmlPath = path.join(__dirname, '../public/index.html');

const pkg = require(packageJsonPath);
const currentVersion = pkg.version;

console.log(`Current version is: ${currentVersion}`);
rl.question('Enter new version (e.g. 5.1.0): ', (newVersion) => {
  if (!newVersion || newVersion === currentVersion) {
    console.log('Version not changed. Aborting.');
    rl.close();
    return;
  }

  rl.question('Enter changelog description (optional): ', (changelog) => {
    
    // 1. Update package.json
    pkg.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
    console.log('✅ Updated package.json');

    // 2. Update public/version.json
    let versionData = {};
    if (fs.existsSync(versionJsonPath)) {
      versionData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
    }
    versionData.version = newVersion;
    if (changelog) {
      if (!versionData.changelog) versionData.changelog = {};
      versionData.changelog.id = changelog;
    }
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionData, null, 2));
    console.log('✅ Updated public/version.json');

    // 3. Update public/app.js (APP_VERSION)
    // We look for: const APP_VERSION = 'x.x.x';
    if (fs.existsSync(appJsPath)) {
      let appJs = fs.readFileSync(appJsPath, 'utf8');
      appJs = appJs.replace(/const APP_VERSION = '.*?';/, `const APP_VERSION = '${newVersion}';`);
      fs.writeFileSync(appJsPath, appJs);
      console.log('✅ Updated public/app.js (APP_VERSION)');
    }

    // 4. Update public/sw.js (CACHE_NAME)
    // We look for: const CACHE_NAME = 'dirhamku-cache-vX.X.X';
    if (fs.existsSync(swJsPath)) {
      let swJs = fs.readFileSync(swJsPath, 'utf8');
      swJs = swJs.replace(/const CACHE_NAME = 'dirhamku-cache-v.*?';/, `const CACHE_NAME = 'dirhamku-cache-v${newVersion}';`);
      fs.writeFileSync(swJsPath, swJs);
      console.log('✅ Updated public/sw.js (CACHE_NAME)');
    }

    // 5. Update public/index.html (app.js?v=... and styles.css?v=...)
    if (fs.existsSync(indexHtmlPath)) {
      let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
      indexHtml = indexHtml.replace(/app\.js\?v=[0-9.]+/g, `app.js?v=${newVersion}`);
      indexHtml = indexHtml.replace(/styles\.css\?v=[0-9.]+/g, `styles.css?v=${newVersion}`);
      
      // If styles.css doesn't have ?v= yet, we might want to add it.
      // But it's easier to just match the script and link tags and append the version if needed.
      // Let's do a more robust replacement:
      indexHtml = indexHtml.replace(/href="\/styles\.css(\?v=[0-9.]+)?"/g, `href="/styles.css?v=${newVersion}"`);
      indexHtml = indexHtml.replace(/src="app\.js(\?v=[0-9.]+)?"/g, `src="app.js?v=${newVersion}"`);

      fs.writeFileSync(indexHtmlPath, indexHtml);
      console.log('✅ Updated public/index.html (cache-busting params)');
    }

    console.log(`\n🎉 Successfully bumped version to v${newVersion}!`);
    console.log(`You can now deploy using: npm run deploy\n`);
    
    rl.close();
  });
});
