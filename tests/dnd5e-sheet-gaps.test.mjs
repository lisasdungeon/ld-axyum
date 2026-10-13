import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

function makeActor(layout = undefined) {
  let current = layout;
  const savedLayouts = [];
  const actor = {
    name: 'Sora',
    items: [],
    system: { abilities: {}, skills: {}, attributes: { hp: { value: 10, max: 10 } }, details: {} },
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
  sheet._prepareSpells = () => ({ caster: false });
  return sheet;
}

function makeWidgetEl(widgetId) {
  const listeners = {};
  const dragHandle = {
    addEventListener: (type, fn) => { listeners[`drag:${type}`] = fn; }
  };
  const resizeHandle = {
    addEventListener: (type, fn) => { listeners[`resize:${type}`] = fn; }
  };
  const classSet = new Set();
  const el = {
    dataset: { widgetId },
    style: { left: '10px', top: '20px', width: '', height: '' },
    offsetWidth: 200,
    offsetHeight: 150,
    classList: {
      add: (c) => classSet.add(c),
      remove: (c) => classSet.delete(c),
      contains: (c) => classSet.has(c)
    },
    querySelector: (sel) => {
      if (sel === '.widget-drag-handle') return dragHandle;
      if (sel === '.widget-resize-handle') return resizeHandle;
      return null;
    },
    _listeners: listeners,
    _classSet: classSet
  };
  return el;
}

test('Dnd5e sheet _promptNumber callback clamps values and rejects NaN', async () => {
  const previous = installFoundryMock();
  try {
    if (typeof Math.clamp !== 'function') {
      Math.clamp = (n, min, max) => Math.min(max, Math.max(min, n));
    }
    const { actor } = makeActor();
    const sheet = await makeSheet(actor);
    let callback = null;
    globalThis.foundry.applications.api.DialogV2 = {
      prompt: async (opts) => {
        callback = opts.ok.callback;
        return callback(null, { form: { elements: { 'ld-axyum-number-input': { value: '25' } } } });
      }
    };
    const clamped = await sheet._promptNumber('Edit', 10, 0, 20);
    assert.equal(clamped, 20);

    const nanResult = callback(null, { form: { elements: { 'ld-axyum-number-input': { value: 'abc' } } } });
    assert.equal(nanResult, null);

    const missing = callback(null, { form: { elements: {} } });
    assert.equal(missing, null);

    const inRange = callback(null, { form: { elements: { 'ld-axyum-number-input': { value: '7' } } } });
    assert.equal(inRange, 7);
  } finally { restoreFoundryMock(previous); }
});

test('Sheet layout actions bind drag and resize pointer handlers', async () => {
  const previous = installFoundryMock();
  try {
    const layout = {
      version: 1,
      pages: [{ id: 'main', name: 'Main' }],
      widgets: [{ id: 'w1', type: 'combat', page: 'main', x: 10, y: 20, width: 200, height: 150, color: '' }]
    };
    const { actor, savedLayouts } = makeActor(layout);
    const sheet = await makeSheet(actor, true);
    const widget = makeWidgetEl('w1');
    const bare = makeWidgetEl('bare');
    bare.querySelector = () => null;
    const canvas = {
      querySelectorAll: () => [widget, bare]
    };

    sheet.element = {
      querySelector: (sel) => (sel === '.axyum-canvas' ? canvas : null)
    };

    const windowListeners = {};
    const originalAdd = globalThis.window.addEventListener;
    const originalRemove = globalThis.window.removeEventListener;
    globalThis.window.addEventListener = (type, fn, opts) => {
      windowListeners[type] = windowListeners[type] || [];
      windowListeners[type].push({ fn, opts });
    };
    globalThis.window.removeEventListener = (type, fn) => {
      windowListeners[type] = (windowListeners[type] || []).filter((e) => e.fn !== fn);
    };

    try {
      sheet._onRender({}, {});
      assert.ok(widget._listeners['drag:pointerdown']);
      assert.ok(widget._listeners['resize:pointerdown']);

      sheet.element = { querySelector: () => null };
      sheet._setupWidgetInteractions();

      widget._listeners['drag:pointerdown']({ button: 1, preventDefault() {} });
      widget._listeners['drag:pointerdown']({
        button: 0,
        clientX: 100,
        clientY: 100,
        preventDefault() {}
      });
      assert.equal(widget._classSet.has('is-dragging'), true);
      const dragMove = windowListeners.pointermove.at(-1).fn;
      const dragUp = windowListeners.pointerup.at(-1).fn;
      dragMove({ clientX: 130, clientY: 140 });
      assert.equal(widget.style.left, '40px');
      assert.equal(widget.style.top, '60px');
      await dragUp();
      assert.equal(widget._classSet.has('is-dragging'), false);
      assert.equal(savedLayouts.at(-1).widgets.find((w) => w.id === 'w1').x, 40);
      assert.equal(savedLayouts.at(-1).widgets.find((w) => w.id === 'w1').y, 60);

      widget._listeners['resize:pointerdown']({ button: 2, preventDefault() {}, stopPropagation() {} });
      widget._listeners['resize:pointerdown']({
        button: 0,
        clientX: 200,
        clientY: 200,
        preventDefault() {},
        stopPropagation() {}
      });
      assert.equal(widget._classSet.has('is-resizing'), true);
      const resizeMove = windowListeners.pointermove.at(-1).fn;
      const resizeUp = windowListeners.pointerup.at(-1).fn;
      resizeMove({ clientX: 300, clientY: 280 });
      assert.equal(widget.style.width, '300px');
      assert.equal(widget.style.height, '230px');
      widget.offsetWidth = 300;
      widget.offsetHeight = 230;
      await resizeUp();
      assert.equal(widget._classSet.has('is-resizing'), false);
      assert.equal(savedLayouts.at(-1).widgets.find((w) => w.id === 'w1').width, 300);
      assert.equal(savedLayouts.at(-1).widgets.find((w) => w.id === 'w1').height, 230);

      // Minimum size clamps during move.
      widget.style.width = '';
      widget.style.height = '';
      widget.offsetWidth = 200;
      widget.offsetHeight = 150;
      widget._listeners['resize:pointerdown']({
        button: 0, clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {}
      });
      windowListeners.pointermove.at(-1).fn({ clientX: -500, clientY: -500 });
      assert.equal(widget.style.width, '150px');
      assert.equal(widget.style.height, '100px');
      await windowListeners.pointerup.at(-1).fn();
    } finally {
      globalThis.window.addEventListener = originalAdd;
      globalThis.window.removeEventListener = originalRemove;
    }
  } finally { restoreFoundryMock(previous); }
});
