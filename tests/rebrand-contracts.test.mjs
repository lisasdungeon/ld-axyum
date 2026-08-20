import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = path.join(directory, entry.name);
  if (entry.name === '.git' || entry.name === 'node_modules') return [];
  return entry.isDirectory() ? walk(fullPath) : [fullPath];
});
const files = walk(root);
const sourceFiles = files.filter((file) => /\.(css|hbs|js|mjs|json|md|html)$/.test(file) && !file.includes(`${path.sep}tests${path.sep}`));

test('manifest is fully branded for LD Axyum', () => {
  const manifest = JSON.parse(read('module.json'));
  assert.equal(manifest.id, 'ld-axyum');
  assert.equal(manifest.title, 'LD Axyum');
  assert.equal(manifest.version, '1.0.2');
  assert.equal(manifest.authors[0].name, "Lisa's Dungeon");
  assert.equal(manifest.authors[0].discord, 'MystryssLysa');
  assert.match(manifest.download, /\/releases\/latest\/download\/module\.zip$/);
});

test('legacy branding is absent', () => {
  const legacyKey = ['R', 'N', 'K'].join('');
  const forbidden = new RegExp(`\\b(?:${legacyKey}|${legacyKey.toLowerCase()}-axyum|${legacyKey}-Enterprise)\\b`, 'i');
  for (const file of sourceFiles.filter((entry) => !entry.endsWith(`${path.sep}axyum.mjs`))) {
    const relativePath = path.relative(root, file);
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), forbidden, relativePath);
  }
});

test('logo implementation and references are absent', () => {
  for (const relativePath of ['core/logo-component.js', 'core/logo-styles.js', 'core/logo-variants.js']) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, relativePath);
  }
  for (const relativePath of ['axyum.mjs', 'ui/axyum-app.hbs', 'styles/wizard.css']) {
    assert.doesNotMatch(read(relativePath), /logo|Logo|LOGO/, relativePath);
  }
});

test('cool slate theme contains no toxic green accents', () => {
  const styles = sourceFiles.filter((file) => file.endsWith('.css')).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(styles, /#00ff41|#39ff14|rgba\(0,\s*255,\s*(20|65)/i);
  assert.match(styles, /#7dd3fc|rgba\(125,\s*211,\s*252/);
  assert.match(styles, /#0b1120|#1e293b|#334155/);
});

test('loaded CSS blocks remain balanced', () => {
  for (const file of files.filter((entry) => entry.endsWith('.css'))) {
    const source = fs.readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(['"])(?:\\.|(?!\1)[^\\])*\1/g, '');
    assert.equal((source.match(/\{/g) || []).length, (source.match(/\}/g) || []).length, path.relative(root, file));
  }
});

test('all module files meet the 500-line cap', () => {
  for (const file of files) {
    const lineCount = fs.readFileSync(file, 'utf8').split(/\r?\n/).length - 1;
    assert.ok(lineCount <= 500, `${path.relative(root, file)} has ${lineCount} lines`);
  }
});

test('module stylesheet and helper paths exist', () => {
  const manifest = JSON.parse(read('module.json'));
  for (const relativePath of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map((language) => language.path)]) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, relativePath);
  }
});
