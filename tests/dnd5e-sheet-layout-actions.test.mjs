import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';
import { WIDGET_TYPES } from '../systems/dnd5e/sheet/sheet-layout-manager.js';

function el(dataset = {}) {
  return { dataset: { action: 'test', ...dataset } };
}

/** Dialog stub that actually runs each prompt's ok.callback against a fake form. */
function stubDialog({ inputs = [], confirms = [] } = {}) {
  const calls = { prompt: [], confirm: [] };
  let pi = 0;
  let ci = 0;
  globalThis.foundry.applications.api.DialogV2 = {
    prompt: async (opts) => {
      calls.prompt.push(opts);
      const elements = inputs[pi++];
      if (elements === undefined || elements === null) return elements;
      return opts.ok?.callback?.(null, { form: { elements } });
    },
    confirm: async (opts) => { calls.confirm.push(opts); return confirms[ci++]; }
  };
  return calls;
}

const PAGE_INPUT = (value) => ({ 'ld-axyum-page-name': { value } });
const SELECT_INPUT = (value) => ({ 'ld-axyum-page-select': { value } });

function makeActor(layout = undefined) {
  const savedLayouts = [];
  let current = layout;
  const actor = {
    name: 'Sora', items: [],
    system: { abilities: {}, skills: {}, attributes: {}, details: {} },
    getFlag: (_s, key) => (key === 'sheetLayout' ? current : null),
    setFlag: async (_s, _k, value) => { savedLayouts.push(value); current = value; }
  };
  return { actor, savedLayouts };
}

async function makeSheet(actor, editMode = false) {
  const { Dnd5eCharacterSheet } = await import('../systems/dnd5e/sheet/dnd5e-sheet.js');
  const sheet = new Dnd5eCharacterSheet({ document: actor });
  sheet.actor = actor;
  sheet.editMode = editMode;
  sheet.render = async () => sheet;
  return sheet;
}

test('Edit mode toggles and renders, page switching requires a page id', async () => {
  const previous = installFoundryMock();
  try {
    const { actor } = makeActor();
    const sheet = await makeSheet(actor);
    const renders = [];
    sheet.render = async () => { renders.push(1); return sheet; };

    await sheet.onToggleEditMode();
    assert.equal(sheet.editMode, true);
    await sheet.onToggleEditMode();
    assert.equal(sheet.editMode, false);
    assert.equal(renders.length, 2);

    await sheet.onSwitchPage(null, el({}));
    assert.equal(sheet.currentPageId, null);
    await sheet.onSwitchPage(null, el({ pageId: 'main' }));
    assert.equal(sheet.currentPageId, 'main');
    assert.equal(renders.length, 3);
  } finally { restoreFoundryMock(previous); }
});

test('Add page trims the prompted name, persists the page, and selects it', async () => {
  const previous = installFoundryMock();
  try {
    const { actor, savedLayouts } = makeActor();
    const sheet = await makeSheet(actor);
    const calls = stubDialog({ inputs: [PAGE_INPUT('  Loot  '), PAGE_INPUT('   '), null] });

    await sheet.onAddPage();
    assert.equal(savedLayouts.length, 1);
    assert.deepEqual(savedLayouts[0].pages.map((p) => p.name), ['Main', 'Loot']);
    assert.equal(sheet.currentPageId, savedLayouts[0].pages.at(-1).id);

    await sheet.onAddPage();
    await sheet.onAddPage();
    assert.equal(savedLayouts.length, 1);
    assert.ok(calls.prompt.every((c) => c.window.title === 'New Page'));
  } finally { restoreFoundryMock(previous); }
});

test('Rename page targets the requested page or falls back to the current page', async () => {
  const previous = installFoundryMock();
  try {
    const layout = {
      version: 1,
      pages: [{ id: 'main', name: 'Main' }, { id: 'notes', name: 'Notes' }],
      widgets: []
    };
    const { actor, savedLayouts } = makeActor(layout);
    const sheet = await makeSheet(actor);
    stubDialog({ inputs: [PAGE_INPUT('Journal'), PAGE_INPUT('  Journal  ')] });

    await sheet.onRenamePage(null, el({ pageId: 'notes' }));
    assert.deepEqual(savedLayouts[0].pages.map((p) => p.name), ['Main', 'Journal']);

    sheet.currentPageId = 'notes';
    await sheet.onRenamePage(null, el({}));
    assert.equal(savedLayouts[1].pages[1].name, 'Journal');
    assert.equal(savedLayouts[1].pages[0].name, 'Main');
  } finally { restoreFoundryMock(previous); }
});

test('Delete page confirms, reassigns widgets, and follows the deleted current page', async () => {
  const previous = installFoundryMock();
  try {
    const saved = {
      version: 1,
      pages: [{ id: 'main', name: 'Main' }, { id: 'notes', name: 'Notes' }],
      widgets: [{ id: 'w1', type: 'skills', page: 'notes', x: 10, y: 10, width: 440, height: 320, color: '' }]
    };
    const { actor, savedLayouts } = makeActor(saved);
    const sheet = await makeSheet(actor);
    sheet.currentPageId = 'notes';
    const calls = stubDialog({ confirms: [false, true] });

    await sheet.onDeletePage(null, el({ pageId: 'notes' }));
    assert.equal(savedLayouts.length, 0);

    await sheet.onDeletePage(null, el({ pageId: 'notes' }));
    assert.equal(savedLayouts.length, 1);
    assert.deepEqual(savedLayouts[0].pages.map((p) => p.id), ['main']);
    assert.equal(savedLayouts[0].widgets.find((w) => w.id === 'w1').page, 'main');
    assert.equal(sheet.currentPageId, 'main');

    await sheet.onDeletePage(null, el({}));
    assert.equal(savedLayouts.length, 1);
    assert.equal(calls.confirm.length, 2);
    assert.equal(calls.confirm[0].window.title, 'Delete Page');
  } finally { restoreFoundryMock(previous); }
});

test('Delete page warns instead of removing the last remaining page', async () => {
  const previous = installFoundryMock();
  try {
    const { actor } = makeActor();
    const sheet = await makeSheet(actor);
    const notes = [];
    globalThis.ui.notifications.warn = (m) => notes.push(m);
    const calls = stubDialog();

    await sheet.onDeletePage(null, el({}));
    assert.deepEqual(notes, ['You need at least one page.']);
    assert.equal(calls.confirm.length, 0);
  } finally { restoreFoundryMock(previous); }
});

test('Reset layout confirms and restores the default non-caster layout', async () => {
  const previous = installFoundryMock();
  try {
    const saved = {
      version: 1,
      pages: [{ id: 'x', name: 'X' }],
      widgets: [{ id: 'w1', type: 'combat', page: 'x', x: 0, y: 0, width: 300, height: 160, color: '#f00' }]
    };
    const { actor, savedLayouts } = makeActor(saved);
    const sheet = await makeSheet(actor);
    stubDialog({ confirms: [false, true] });

    await sheet.onResetLayout();
    assert.equal(savedLayouts.length, 0);

    await sheet.onResetLayout();
    assert.equal(savedLayouts.length, 1);
    assert.deepEqual(savedLayouts[0].pages.map((p) => p.name), ['Main']);
    assert.equal(savedLayouts[0].widgets.length, Object.keys(WIDGET_TYPES).length - 1);
    assert.ok(savedLayouts[0].widgets.every((w) => w.type !== 'spells'));
    assert.equal(sheet.currentPageId, 'main');
  } finally { restoreFoundryMock(previous); }
});

test('Widget color picker seeds from the stored color and persists on change', async () => {
  const previous = installFoundryMock();
  try {
    const saved = {
      version: 1,
      pages: [{ id: 'main', name: 'Main' }],
      widgets: [{ id: 'w1', type: 'combat', page: 'main', x: 0, y: 0, width: 300, height: 160, color: '#123456' }]
    };
    const { actor, savedLayouts } = makeActor(saved);
    const sheet = await makeSheet(actor);
    stubDialog();
    const created = [];
    const originalCreate = globalThis.document.createElement;
    globalThis.document.createElement = (tag) => {
      const input = {
        tagName: 'INPUT', type: '', value: '', listeners: {},
        addEventListener(type, fn) { this.listeners[type] = fn; },
        click() { this.listeners.change?.(); created.push(this); }
      };
      created.push(input);
      return input;
    };

    await sheet.onSetWidgetColor(null, el({ widgetId: 'w1' }));
    const seeded = created.find((i) => i.tagName === 'INPUT');
    assert.equal(seeded.type, 'color');
    assert.equal(seeded.value, '#123456');
    assert.equal(savedLayouts.at(-1).widgets.find((w) => w.id === 'w1').color, seeded.value);

    created.length = 0;
    await sheet.onSetWidgetColor(null, el({ widgetId: 'ghost' }));
    const fallback = created.find((i) => i.tagName === 'INPUT');
    assert.equal(fallback.value, '#7dd3fc');
    globalThis.document.createElement = originalCreate;
  } finally { restoreFoundryMock(previous); }
});

test('Move page menu rejects missing widgets no-op moves and missing selections', async () => {
  const previous = installFoundryMock();
  try {
    const saved = {
      version: 1,
      pages: [{ id: 'main', name: 'Main' }, { id: 'stash', name: 'Stash' }],
      widgets: [{ id: 'w1', type: 'skills', page: 'main', x: 0, y: 0, width: 440, height: 320, color: '' }]
    };
    const { actor, savedLayouts } = makeActor(saved);
    const sheet = await makeSheet(actor);
    const calls = stubDialog({ inputs: [SELECT_INPUT('main'), SELECT_INPUT('stash'), null] });

    await sheet.onMovePageMenu(null, el({ widgetId: 'ghost' }));
    assert.equal(savedLayouts.length, 0);

    await sheet.onMovePageMenu(null, el({ widgetId: 'w1' }));
    assert.equal(savedLayouts.length, 0);

    await sheet.onMovePageMenu(null, el({ widgetId: 'w1' }));
    assert.equal(savedLayouts.length, 1);
    assert.equal(savedLayouts[0].widgets.find((w) => w.id === 'w1').page, 'stash');
    assert.equal(savedLayouts[0].widgets.find((w) => w.id === 'w1').x, 16);
    assert.equal(sheet.currentPageId, 'stash');

    await sheet.onMovePageMenu(null, el({ widgetId: 'w1' }));
    assert.equal(savedLayouts.length, 1);
    assert.ok(calls.prompt[1].window.title.includes('Skills'));
  } finally { restoreFoundryMock(previous); }
});

test('Layout mutations route through normalizeLayout and persist via setFlag', async () => {
  const previous = installFoundryMock();
  try {
    const { actor, savedLayouts } = makeActor();
    const sheet = await makeSheet(actor);

    const fetched = await sheet._getLayout();
    assert.equal(fetched.pages.length, 1);
    assert.equal(fetched.widgets.length, Object.keys(WIDGET_TYPES).length - 1);
    assert.ok(fetched.widgets.every((w) => w.type !== 'spells'));

    await sheet._mutateLayout((layout) => ({
      ...layout,
      pages: [...layout.pages, { id: 'extra', name: 'Extra' }]
    }));
    assert.equal(savedLayouts.length, 1);
    assert.deepEqual(savedLayouts[0].pages.map((p) => p.id), ['main', 'extra']);
  } finally { restoreFoundryMock(previous); }
});
