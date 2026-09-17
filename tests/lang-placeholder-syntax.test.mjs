import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

/**
 * Foundry's i18n interpolation replaces single-brace {placeholders} from the
 * localize helper's hash args. Handlebars-style {{double}} braces do NOT match:
 * the format regex grabs "{{key}" as the placeholder name, fails the lookup,
 * and splices in the literal string "undefined" (e.g. a section heading
 * rendering as "Level undefined} Spells"). No lang string may contain "{{".
 */

function collectStrings(node, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((v) => collectStrings(v, out));
  else if (node && typeof node === 'object') Object.values(node).forEach((v) => collectStrings(v, out));
  return out;
}

test('lang strings never contain Handlebars-style {{double}} braces', () => {
  for (const file of ['lang/en.json']) {
    const data = JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
    const strings = collectStrings(data);
    assert.ok(strings.length > 10, `${file} parsed sanely`);
    for (const s of strings) {
      assert.ok(!s.includes('{{'), `${file}: localized string uses {{double}} braces which Foundry mangles into literal "undefined": ${JSON.stringify(s)}`);
    }
  }
});

test('every localize helper hash key used by templates has a {placeholder} in its lang string', async () => {
  const data = JSON.parse(readFileSync(new URL('../lang/en.json', import.meta.url), 'utf8'));
  const get = (key) => key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), data);

  const sources = ['ui/axyum-app.hbs'];
  const pageNames = ['welcome', 'role', 'class', 'multiclass', 'race', 'background', 'abilities', 'skills', 'proficiencies', 'equipment', 'spells', 'details', 'biography', 'summary', 'feat-selection'];
  for (const p of pageNames) sources.push(`ui/pages/${p}.hbs`);

  for (const file of sources) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    // {{localize "A.B.C" name=value ...}} — hash args mean the string must carry {name}-style placeholders
    const re = /\{\{\s*localize\s+"([^"]+)"((?:\s+[a-zA-Z_][a-zA-Z0-9_]*=\S+)+)\s*\}\}/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const key = m[1];
      const str = get(key);
      assert.ok(typeof str === 'string', `${file}: localize key "${key}" is missing from lang/en.json`);
      const hashArgs = m[2].trim().split(/\s+/).map((pair) => pair.split('=')[0]);
      for (const arg of hashArgs) {
        assert.ok(str.includes(`{${arg}}`), `${file}: "${key}" passes "${arg}" but its lang string has no {${arg}} placeholder: ${JSON.stringify(str)}`);
      }
    }
  }
});
