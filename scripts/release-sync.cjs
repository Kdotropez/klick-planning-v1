const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const packageJsonPath = path.join(root, 'package.json');

const kind = (process.argv[2] || 'patch').toLowerCase();
const allowed = new Set(['patch', 'minor', 'major']);

if (!allowed.has(kind)) {
  console.error(`Invalid release type "${kind}". Use: patch | minor | major`);
  process.exit(1);
}

const bumpSemver = (version, type) => {
  const [rawMajor, rawMinor, rawPatch] = String(version || '0.0.0').split('.');
  const major = Number.parseInt(rawMajor, 10) || 0;
  const minor = Number.parseInt(rawMinor, 10) || 0;
  const patch = Number.parseInt(rawPatch, 10) || 0;

  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

try {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const previous = pkg.version;
  const next = bumpSemver(previous, kind);
  pkg.version = next;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  console.log(`Version bumped: ${previous} -> ${next} (${kind})`);

  execSync('npm run version:sync', { cwd: root, stdio: 'inherit' });
  execSync('npm run version:check', { cwd: root, stdio: 'inherit' });

  console.log('release:sync completed successfully.');
  console.log('Next step: complete release notes, then commit and push.');
} catch (error) {
  console.error(`release:sync failed: ${error.message}`);
  process.exit(1);
}
