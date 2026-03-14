const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const packageJsonPath = path.join(root, 'package.json');
const publicVersionPath = path.join(root, 'public', 'version.json');
const versionManagerPath = path.join(root, 'src', 'utils', 'versionManager.js');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const publicVersion = JSON.parse(fs.readFileSync(publicVersionPath, 'utf8'));
const versionManager = fs.readFileSync(versionManagerPath, 'utf8');

const currentVersion = packageJson.version;
const errors = [];

if (publicVersion.version !== currentVersion) {
  errors.push(`public/version.json version (${publicVersion.version}) != package.json (${currentVersion})`);
}

if (!versionManager.includes(`'${currentVersion}': [`)) {
  errors.push(`src/utils/versionManager.js missing VERSION_HIGHLIGHTS entry for ${currentVersion}`);
}

if (errors.length > 0) {
  console.error('Version check failed:');
  errors.forEach((e) => console.error(`- ${e}`));
  process.exit(1);
}

console.log(`Version check ok for ${currentVersion}`);
