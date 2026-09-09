import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

async function loadHelper() {
  return import('../scripts/ld-localize-helper.js');
}

test('Registers localize and format helpers when none exist', async () => {
  const previous = installFoundryMock();
  try {
    const { setupLocalizationHelper } = await loadHelper();
    assert.equal(typeof Handlebars.helpers.get('localize'), 'undefined');
    assert.equal(typeof Handlebars.helpers.get('format'), 'undefined');

    setupLocalizationHelper();

    assert.equal(typeof Handlebars.helpers.get('localize'), 'function');
    assert.equal(typeof Handlebars.helpers.get('format'), 'function');
  } finally { restoreFoundryMock(previous); }
});

test('localize delegates to game.i18n.localize and stringifies keys', async () => {
  const previous = installFoundryMock();
  try {
    const { setupLocalizationHelper } = await loadHelper();
    game.i18n.localize = (key) => `L10N:${key}`;
    setupLocalizationHelper();

    const helper = Handlebars.helpers.get('localize');
    assert.equal(helper('LD_AXYUM.Foo'), 'L10N:LD_AXYUM.Foo');
    assert.equal(helper(123), 'L10N:123');
  } finally { restoreFoundryMock(previous); }
});

test('localize falls back to the raw key when game or i18n is missing', async () => {
  const previous = installFoundryMock();
  try {
    const { setupLocalizationHelper } = await loadHelper();
    setupLocalizationHelper();
    const helper = Handlebars.helpers.get('localize');

    game.i18n = undefined;
    assert.equal(helper('LD_AXYUM.Missing'), 'LD_AXYUM.Missing');

    globalThis.game = undefined;
    assert.equal(helper('LD_AXYUM.StillMissing'), 'LD_AXYUM.StillMissing');
  } finally { restoreFoundryMock(previous); }
});

test('localize survives a throwing i18n implementation and still returns the key', async () => {
  const previous = installFoundryMock();
  try {
    const { setupLocalizationHelper } = await loadHelper();
    game.i18n.localize = () => { throw new Error('i18n exploded'); };
    setupLocalizationHelper();

    assert.equal(Handlebars.helpers.get('localize')('LD_AXYUM.Boom'), 'LD_AXYUM.Boom');
  } finally { restoreFoundryMock(previous); }
});

test('format passes hash parameters through to game.i18n.format', async () => {
  const previous = installFoundryMock();
  try {
    const { setupLocalizationHelper } = await loadHelper();
    const seen = [];
    game.i18n.format = (key, params) => { seen.push([key, params]); return `F:${key}`; };
    setupLocalizationHelper();
    const helper = Handlebars.helpers.get('format');

    assert.equal(helper('LD_AXYUM.Greet', { hash: { name: 'Odinn' } }), 'F:LD_AXYUM.Greet');
    assert.deepEqual(seen[0], ['LD_AXYUM.Greet', { name: 'Odinn' }]);

    assert.equal(helper('LD_AXYUM.Plain'), 'F:LD_AXYUM.Plain');
    assert.deepEqual(seen[1], ['LD_AXYUM.Plain', {}]);

    assert.equal(helper('LD_AXYUM.EmptyHash', {}), 'F:LD_AXYUM.EmptyHash');
    assert.deepEqual(seen[2], ['LD_AXYUM.EmptyHash', {}]);
  } finally { restoreFoundryMock(previous); }
});

test('format falls back to the raw key without i18n.format or when it throws', async () => {
  const previous = installFoundryMock();
  try {
    const { setupLocalizationHelper } = await loadHelper();
    setupLocalizationHelper();
    const helper = Handlebars.helpers.get('format');

    game.i18n.format = undefined;
    assert.equal(helper('LD_AXYUM.NoFormat', { hash: { a: 1 } }), 'LD_AXYUM.NoFormat');

    game.i18n.format = () => { throw new Error('format exploded'); };
    assert.equal(helper('LD_AXYUM.Throw'), 'LD_AXYUM.Throw');
  } finally { restoreFoundryMock(previous); }
});

test('Never replaces helpers that already exist: the Foundry core-UI guard', async () => {
  const previous = installFoundryMock();
  try {
    const { setupLocalizationHelper } = await loadHelper();
    const foundryLocalize = () => 'FOUNDRY-LOCALIZE';
    const foundryFormat = () => 'FOUNDRY-FORMAT';
    Handlebars.registerHelper('localize', foundryLocalize);
    Handlebars.registerHelper('format', foundryFormat);

    setupLocalizationHelper();

    assert.equal(Handlebars.helpers.get('localize'), foundryLocalize);
    assert.equal(Handlebars.helpers.get('format'), foundryFormat);
    assert.equal(Handlebars.helpers.get('localize')('ANY.KEY'), 'FOUNDRY-LOCALIZE');
    assert.equal(Handlebars.helpers.get('format')('ANY.KEY'), 'FOUNDRY-FORMAT');
  } finally { restoreFoundryMock(previous); }
});
