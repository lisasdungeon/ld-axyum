import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

function makeRoot(overrides = {}) {
  const buttons = [];
  const contents = [];
  const root = Object.assign(Object.create(HTMLElement.prototype), {
    dataset: {},
    querySelector(sel) {
      if (sel?.startsWith('[data-tab=')) {
        const tab = sel.match(/data-tab="([^"]+)"/)?.[1];
        return contents.find((c) => c.dataset.tab === tab) || null;
      }
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.tab-button') return buttons;
      if (sel === '.tab-content') return contents;
      return [];
    },
    contains() { return true; },
    addEventListener(type, fn) {
      this._listeners = this._listeners || {};
      this._listeners[type] = this._listeners[type] || [];
      this._listeners[type].push(fn);
    },
    ...overrides
  });
  root._buttons = buttons;
  root._contents = contents;
  return root;
}

test('GmHubApp prepares context, switches tabs, and launches wizards lazily', async () => {
  const previous = installFoundryMock();
  try {
    globalThis.game.system.id = 'dnd5e';
    globalThis.game.systems = { get: (id) => (id === 'dnd5e' ? { id: 'dnd5e' } : null) };
    const warns = [];
    const infos = [];
    const errors = [];
    globalThis.ui.notifications = {
      warn: (m) => warns.push(m),
      info: (m) => infos.push(m),
      error: (m) => errors.push(m)
    };
    globalThis.document = {
      querySelectorAll: () => [
        { style: {}, },
      ]
    };
    globalThis.window.getComputedStyle = () => ({ zIndex: '200' });

    const { GmHubApp } = await import('../gm-hub/gm-hub-app.js');
    const app = new GmHubApp();

    assert.equal(app._getSystemTheme('dnd5e'), 'Post-Apocalyptic Axyum');
    assert.equal(app._getSystemTheme('coc7'), 'Cthulhu Wasteland');
    assert.equal(app._getSystemTheme('cyberpunk2020'), 'Neon Ruins');
    assert.equal(app._getSystemTheme('bitd'), 'Gothic Decay');
    assert.equal(app._getSystemTheme('pf2e'), 'Ancient Remnants');
    assert.equal(app._getSystemTheme('unknown'), 'Axyum Theme');

    const ctx = await app._prepareContext({});
    assert.ok(Array.isArray(ctx.systems));
    assert.ok(ctx.systems.length >= 1);
    const dnd = ctx.systems.find((s) => s.id === 'dnd5e');
    assert.ok(dnd);
    assert.equal(dnd.cardClass, 'system-card-dnd5e');
    assert.ok(dnd.theme);

    // Unavailable system path
    await app.onSelectSystem({}, { dataset: { systemId: 'coc7' } });
    assert.ok(warns.some((m) => String(m).includes('not available')));

    // Available system launches wizard via loadWizardClass
    const rendered = [];
    const { AxyumApp } = await import('../core/axyum-app.js');
    const prevRender = AxyumApp.prototype.render;
    AxyumApp.prototype.render = async function() {
      rendered.push(this);
      return this;
    };
    try {
      await app.onSelectSystem({
        target: { closest: () => ({ dataset: { systemId: 'dnd5e' } }) }
      });
      assert.ok(rendered.length >= 1);

      // Fallback import path: available system with no wizardClass / loadWizardClass
      const prevGetOk = app.systemRegistry.getSystem.bind(app.systemRegistry);
      app.systemRegistry.getSystem = async () => ({
        id: 'custom',
        name: 'Custom',
        available: true,
        wizardClass: null
      });
      await app.onSelectSystem({}, { dataset: { systemId: 'custom' } });
      assert.ok(rendered.length >= 2);
      app.systemRegistry.getSystem = prevGetOk;
    } finally {
      AxyumApp.prototype.render = prevRender;
    }

    // Error path
    const prevGet = app.systemRegistry.getSystem.bind(app.systemRegistry);
    app.systemRegistry.getSystem = async () => { throw new Error('boom'); };
    await app.onSelectSystem({}, { dataset: { systemId: 'dnd5e' } });
    assert.ok(errors.some((m) => String(m).includes('Failed to launch')));
    app.systemRegistry.getSystem = prevGet;

    await app.onOpenSettings({});
    await app.onPreviewSheet({}, { dataset: { systemId: 'dnd5e' } });
    assert.ok(infos.some((m) => String(m).includes('Sheet preview')));
    await app.onUseSheet({}, { dataset: { systemId: 'dnd5e' } });
    assert.ok(infos.some((m) => String(m).includes('Default sheet')));

    // Tab switching
    const root = makeRoot();
    const btnA = Object.assign(Object.create(HTMLElement.prototype), {
      dataset: { tab: 'systems' },
      classList: {
        _set: new Set(['active']),
        add(v) { this._set.add(v); },
        remove(v) { this._set.delete(v); }
      }
    });
    const btnB = Object.assign(Object.create(HTMLElement.prototype), {
      dataset: { tab: 'sheets' },
      classList: {
        _set: new Set(),
        add(v) { this._set.add(v); },
        remove(v) { this._set.delete(v); }
      }
    });
    const panelA = Object.assign(Object.create(HTMLElement.prototype), {
      dataset: { tab: 'systems' },
      classList: {
        _set: new Set(['active']),
        add(v) { this._set.add(v); },
        remove(v) { this._set.delete(v); }
      }
    });
    const panelB = Object.assign(Object.create(HTMLElement.prototype), {
      dataset: { tab: 'sheets' },
      classList: {
        _set: new Set(),
        add(v) { this._set.add(v); },
        remove(v) { this._set.delete(v); }
      }
    });
    root._buttons.push(btnA, btnB);
    root._contents.push(panelA, panelB);
    app.element = root;

    app.onSwitchTab({ currentTarget: btnB, preventDefault() {} });
    assert.ok(btnB.classList._set.has('active'));
    assert.ok(panelB.classList._set.has('active'));

    // bindHubListeners via _onRender + tab click fallback
    app._onRender({}, {});
    assert.equal(root.dataset.ldAxyumListenersBound, 'true');
    // second bind is no-op
    app._onRender({}, {});

    const clickFns = root._listeners?.click || [];
    assert.ok(clickFns.length >= 1);
    const tabBtn = Object.assign(Object.create(HTMLElement.prototype), {
      classList: { contains: () => false },
      dataset: { tab: 'systems' },
      closest(sel) { return sel === '.tab-button' ? this : null; }
    });
    // Rebind classList methods used by onSwitchTab
    tabBtn.classList = {
      _set: new Set(),
      add(v) { this._set.add(v); },
      remove(v) { this._set.delete(v); }
    };
    for (const fn of clickFns) {
      fn({
        target: tabBtn,
        preventDefault() {},
        stopPropagation() {}
      });
    }

    // getRootElement branches: element as HTMLElement already covered;
    // pass non-element array-like via temporary element
    app.element = [{ dataset: {} }];
    app.onSwitchTab({ currentTarget: btnA, preventDefault() {} });

    // html element path for getRootElement through bind with null root
    app.element = null;
    app._onRender({}, {});

    // z-index catch path
    globalThis.document.querySelectorAll = () => { throw new Error('dom'); };
    app.element = Object.assign(Object.create(HTMLElement.prototype), {
      dataset: { ldAxyumListenersBound: 'true' },
      style: {},
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; }
    });
    app._onRender({}, {});

  } finally {
    restoreFoundryMock(previous);
  }
});

test('SystemRegistry lists systems and handles config load failures', async () => {
  const previous = installFoundryMock();
  try {
    globalThis.game.system.id = 'dnd5e';
    globalThis.game.systems = {
      get(id) {
        if (id === 'dnd5e') return { id: 'dnd5e' };
        return null;
      }
    };

    const { SystemRegistry } = await import('../gm-hub/system-registry.js');
    const registry = new SystemRegistry();
    const systems = await registry.getAvailableSystems();
    assert.ok(systems.some((s) => s.id === 'dnd5e'));
    assert.ok(systems.some((s) => s.id === 'pf2e'));

    const dnd = await registry.getSystem('dnd5e');
    assert.equal(dnd.available, true);
    assert.equal(typeof dnd.loadWizardClass, 'function');

    // Secondary systems.get fallback when game.system is different
    globalThis.game.system.id = 'other';
    assert.equal(registry.isFoundrySystemAvailable('dnd5e'), true);
    assert.equal(registry.isFoundrySystemAvailable('missing'), false);

    // No systems collection
    globalThis.game.systems = null;
    assert.equal(registry.isFoundrySystemAvailable('dnd5e'), false);
    globalThis.game.system.id = 'dnd5e';
    assert.equal(registry.isFoundrySystemAvailable('dnd5e'), true);

    // Force real import-failure catch via overridable seam
    const broken = new SystemRegistry();
    const realImport = broken._importSystemConfig.bind(broken);
    broken._importSystemConfig = async (systemId) => {
      if (systemId === 'coc7') throw new Error('config fail');
      return realImport(systemId);
    };
    await broken.initialize();
    const listed = await broken.getAvailableSystems();
    const coc = listed.find((s) => s.id === 'coc7');
    assert.ok(coc);
    assert.equal(coc.available, false);
    assert.match(coc.name, /Loading/);

    // Config without requiredFoundrySystem stays available when flagged
    const openReg = new SystemRegistry();
    openReg._importSystemConfig = async (systemId) => {
      if (systemId === 'bitd') {
        return {
          bitdConfig: {
            id: 'bitd',
            name: 'BitD',
            available: true,
            icon: 'fa-solid fa-mask',
            color: '#000',
            underglow: '#111',
            version: '1.0.0'
          }
        };
      }
      return realImport(systemId);
    };
    await openReg.initialize();
    const bitd = await openReg.getSystem('bitd');
    assert.equal(bitd.available, true);
  } finally {
    restoreFoundryMock(previous);
  }
});
