import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';
import { Pf2eWizardNavigation } from '../systems/pf2e/wizard/pf2e-wizard-navigation.js';

function el(dataset = {}) {
  return { dataset: { action: 'test', ...dataset }, closest: function closest() { return this; } };
}

function captureNotifications() {
  const notes = [];
  globalThis.ui.notifications = {
    info: (m) => notes.push(['info', m]),
    warn: (m) => notes.push(['warn', m]),
    error: (m) => notes.push(['error', m])
  };
  return notes;
}

const CACHE = {
  ancestries: [{ id: 'elf', name: 'Elf', hp: 8, size: 'med', speed: 25, traits: [], boosts: ['dex'], flaws: [] }],
  heritages: [{ id: 'snow', name: 'Snow', ancestryId: 'Elf' }],
  backgrounds: [{ id: 'wan', name: 'Wanderer' }],
  classes: [{ id: 'wiz', name: 'Wizard', keyAbility: 'int', hpPerLevel: 10, spellcasting: { tradition: 'arcane' }, classDC: 'trained' }],
  feats: { ancestry: [], class: [], skill: [], general: [], bonus: [] },
  spells: [],
  equipment: [{ id: 'e1', name: 'Sword' }]
};

async function makeApp(overrides = {}) {
  const { Pf2eWizardApp } = await import('../systems/pf2e/wizard/pf2e-wizard-app.js');
  const app = new Pf2eWizardApp({ mode: 'create', ...overrides });
  app.compendium = { cache: CACHE, getOrLoadAll: async () => CACHE };
  app.render = async () => app;
  app.close = async () => { app.closed = true; };
  return app;
}

test('Pf2eWizardNavigation falls back to the base page label', () => {
  const nav = new Pf2eWizardNavigation(['welcome', 'custom-page']);
  assert.equal(nav.getPageLabel('welcome'), 'Welcome');
  assert.equal(nav.getPageLabel('custom-page'), 'custom-page');
  assert.equal(nav.getPageLabel('ghost-page'), 'ghost-page');
});

test('Pf2eWizardApp enters edit mode when constructed with an Actor', async () => {
  const previous = installFoundryMock();
  try {
    const actor = new globalThis.Actor();
    actor.name = 'Existing';
    const app = await makeApp({ actor });
    assert.equal(app.mode, 'edit');
    assert.equal(app.actor, actor);
  } finally { restoreFoundryMock(previous); }
});

test('Pf2eWizardApp wires form inputs and writes dotted names safely', async () => {
  const previous = installFoundryMock();
  const hadRaf = Object.prototype.hasOwnProperty.call(globalThis, 'requestAnimationFrame');
  const previousRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  try {
    const app = await makeApp();
    const listeners = [];
    const input = {
      type: 'text',
      name: 'details.age',
      value: '24',
      hasAttribute: (n) => n === 'data-action' ? false : false,
      addEventListener: (type, fn) => listeners.push([type, fn])
    };
    const skipped = {
      type: 'text',
      name: 'skip',
      value: 'x',
      hasAttribute: (n) => n === 'data-action',
      addEventListener: () => { throw new Error('should skip'); }
    };
    const numberInput = {
      type: 'number',
      name: 'level',
      value: '7',
      hasAttribute: () => false,
      addEventListener: (type, fn) => listeners.push([type, fn])
    };
    app.element = {
      querySelectorAll: () => [input, skipped, numberInput]
    };

    app._onRender({}, {});
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(listeners.some(([t]) => t === 'change'));
    assert.ok(listeners.some(([t]) => t === 'blur'));

    app._setupFormInputs();
    const bare = await makeApp();
    bare.element = null;
    bare._setupFormInputs();

    const renders = [];
    app.render = async () => { renders.push(1); return app; };
    app._onFormInputChange({ target: input });
    assert.equal(app.characterData.details.age, '24');
    app._onFormInputChange({ target: numberInput });
    assert.equal(app.characterData.level, 7);
    app._onFormInputChange({ target: { type: 'text', name: '', value: 'x' } });
    app._onFormInputChange({ target: { type: 'text', name: '__proto__.polluted', value: 'x' } });
    app._onFormInputChange({ target: { type: 'text', name: 'details.constructor', value: 'x' } });
    app._onFormInputChange({ target: { type: 'number', name: 'hitPoints.missing.nested', value: '3' } });
    assert.equal(app.characterData.hitPoints.missing.nested, 3);
    await new Promise((r) => setTimeout(r, 120));
    assert.ok(renders.length >= 1);
  } finally {
    if (hadRaf) globalThis.requestAnimationFrame = previousRaf;
    else delete globalThis.requestAnimationFrame;
    restoreFoundryMock(previous);
  }
});

test('Pf2eWizardApp loads page partials and prepares full context', async () => {
  const previous = installFoundryMock();
  try {
    const app = await makeApp();
    const registered = [];
    globalThis.Handlebars.registerPartial = (name, text) => registered.push([name, text]);
    const paths = [];
    globalThis.fetch = async (path) => {
      paths.push(path);
      const p = String(path);
      // Hit throw, !ok, and success branches during the single first-render load.
      if (p.includes('/welcome.hbs')) throw new Error('network');
      if (p.includes('/heritage.hbs')) return { ok: false, text: async () => '' };
      if (p.includes('pf2e-preview.hbs')) throw new Error('preview fail');
      return { ok: true, text: async () => `<p>${path}</p>` };
    };

    const warns = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));
    try {
      await app._preFirstRender({}, {});
      await app._preFirstRender({}, {});
    } finally {
      console.warn = originalWarn;
    }
    assert.ok(registered.length > 0);
    assert.ok(paths.some((p) => p.includes('welcome.hbs')));
    assert.ok(warns.some((w) => w.includes('Failed to load page template')));

    // Cover _actionEl branches used by selection handlers.
    const withAction = { dataset: { action: 'x', ancestryId: 'elf' }, closest() { return this; } };
    assert.equal(app._actionEl(null, withAction), withAction);
    const nested = {
      dataset: {},
      closest(sel) { return sel === '[data-action]' ? withAction : null; }
    };
    assert.equal(app._actionEl({ currentTarget: nested }), withAction);
    assert.equal(app._actionEl({ target: { dataset: {}, closest: () => null } }), null);
    assert.equal(app._actionEl(null, null), null);
    assert.equal(app._actionEl(null, { dataset: {} }), null);

    app.characterData.name = 'Sora';
    app.characterData.ancestry = { id: 'elf', name: 'Elf', hp: 8 };
    app.characterData.class = { id: 'wiz', name: 'Wizard', hpPerLevel: 10, keyAbility: 'int', spellcasting: { tradition: 'arcane' } };
    app.queries = null;
    const ctx = await app._prepareContext({});
    assert.equal(ctx.character.name, 'Sora');
    assert.equal(ctx.mode, 'create');
    assert.equal(ctx.currentPage, 'welcome');
    assert.equal(ctx.totalPages, 13);
    assert.ok(ctx.ancestries.length >= 1);
    assert.ok(Array.isArray(ctx.skillsList));
    assert.ok(ctx.derivedStats);
    assert.equal(ctx.version, '1.0.1');
  } finally { restoreFoundryMock(previous); }
});

test('Pf2eWizardApp builds a loader when compendium is missing and surfaces save errors', async () => {
  const previous = installFoundryMock();
  try {
    const app = await makeApp();
    app.compendium = null;
    const cache = await app._loadAvailableOptions();
    assert.ok(app.compendium);
    assert.ok(app.queries);
    assert.equal(typeof cache, 'object');

    app.characterData.name = 'Sora';
    app.characterData.ancestry = { id: 'elf' };
    app.characterData.background = { id: 'wan' };
    app.characterData.class = { id: 'wiz' };
    app.characterData.abilityBoosts.free = ['cha', 'con', 'wis', 'str'];
    app.actor = {
      name: 'Sora',
      items: [],
      update: async () => { throw new Error('save boom'); }
    };
    const notes = captureNotifications();
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => errors.push(args.join(' '));
    try {
      await app.onSave(null);
    } finally {
      console.error = originalError;
    }
    assert.ok(notes.some(([t, m]) => t === 'error' && String(m).includes('Failed to update')));
    assert.ok(errors.some((e) => e.includes('Character update failed')));
  } finally { restoreFoundryMock(previous); }
});
