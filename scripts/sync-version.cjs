const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const packageJsonPath = path.join(root, 'package.json');
const publicVersionPath = path.join(root, 'public', 'version.json');
const versionManagerPath = path.join(root, 'src', 'utils', 'versionManager.js');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, value) => fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`, 'utf8');

const today = () => new Date().toISOString().split('T')[0];

const ensurePublicVersion = (currentVersion) => {
  const data = readJson(publicVersionPath);
  data.version = currentVersion;
  data.lastUpdate = today();
  if (!Array.isArray(data.changelog)) data.changelog = [];

  const exists = data.changelog.some((entry) => entry && entry.version === currentVersion);
  if (!exists) {
    data.changelog.unshift({
      version: currentVersion,
      date: today(),
      changes: [
        'Mise a jour version.',
        'Changelog a completer.'
      ]
    });
  }

  writeJson(publicVersionPath, data);
  console.log(`Synced public/version.json -> ${currentVersion}`);
};

const ensureVersionHighlights = (currentVersion) => {
  const source = fs.readFileSync(versionManagerPath, 'utf8');
  const versionKey = `'${currentVersion}'`;
  if (source.includes(`${versionKey}: [`)) {
    console.log(`versionManager already contains ${currentVersion}`);
    return;
  }

  const anchor = 'const VERSION_HIGHLIGHTS = {';
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex === -1) {
    throw new Error('VERSION_HIGHLIGHTS declaration not found in versionManager.js');
  }

  const objectStart = source.indexOf('{', anchorIndex);
  const objectEnd = source.indexOf('\n};', objectStart);
  if (objectStart === -1 || objectEnd === -1) {
    throw new Error('Unable to locate VERSION_HIGHLIGHTS object boundaries');
  }

  const before = source.slice(0, objectEnd);
  const after = source.slice(objectEnd);

  const insertion = `,\n  ${versionKey}: [\n    'Mise a jour version ${currentVersion}.',\n    'Historique a completer.'\n  ]`;
  const updated = `${before}${insertion}${after}`;

  fs.writeFileSync(versionManagerPath, updated, 'utf8');
  console.log(`Added ${currentVersion} entry to versionManager`);
};

try {
  const packageJson = readJson(packageJsonPath);
  const currentVersion = packageJson.version;
  if (!currentVersion) throw new Error('package.json has no version');

  ensurePublicVersion(currentVersion);
  ensureVersionHighlights(currentVersion);
  console.log('Version sync completed.');
} catch (error) {
  console.error(`Version sync failed: ${error.message}`);
  process.exit(1);
}
