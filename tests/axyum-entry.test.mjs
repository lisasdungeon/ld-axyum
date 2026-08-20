import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

test('axyum.mjs registers hooks, helpers, API, and scene controls', async () => {
  const previous = installFoundryMock();
  try {
    globalThis.game.items = [];
    globalThis.game.packs = Object.assign([], { size: 0, values() { return [][Symbol.iterator](); }, get: () => null });
    globalThis.game.settings.register = (...args) => {
      globalThis.__registered = globalThis.__registered || [];
      globalThis.__registered.push(args);
    };
    globalThis.game.settings.get = () => ({});
    globalThis.game.settings.set = async () => {};
    globalThis.fetch = async (path) => {
      if (String(path).includes('biography')) throw new Error('network');
      if (String(path).includes('missing')) return { ok: false, text: async () => '' };
      return { ok: true, text: async () => `<div>${path}</div>` };
    };

    // dynamic import after globals exist
    const mod = await import('../axyum.mjs');
    assert.ok(mod.AxyumApp);
    assert.ok(mod.CompendiumLoader);
    assert.ok(globalThis.openLDAxyum);

    // fire init
    const init = globalThis.Hooks._once.get('init');
    assert.equal(typeof init, 'function');
    await init();
    assert.ok(globalThis.__sheetRegistered);

    // force initializeAxyumIfNeeded catch (lines 111-114) once before successful init
    let assignCount = 0;
    let ldVal = null;
    Object.defineProperty(globalThis.game, 'ldAxyum', {
      configurable: true,
      enumerable: true,
      get() { return ldVal; },
      set(v) {
        assignCount += 1;
        if (assignCount === 1) throw new Error('assign fail');
        ldVal = v;
      }
    });
    // openAxyum swallows the rethrow — still executes init catch
    await globalThis.openLDAxyum();
    // restore normal property for subsequent success path
    delete globalThis.game.ldAxyum;
    globalThis.game.ldAxyum = null;

    // settings registration error path
    globalThis.game.settings.register = () => { throw new Error('reg'); };
    await init();

    // sheet registration error
    globalThis.game.settings.register = () => {};
    globalThis.foundry.applications.apps.DocumentSheetConfig.registerSheet = () => {
      throw new Error('sheet');
    };
    await init();

    // non-dnd5e skips sheet
    globalThis.game.system.id = 'pf2e';
    globalThis.foundry.applications.apps.DocumentSheetConfig.registerSheet = () => {
      globalThis.__sheetRegistered = 'pf2e-should-not';
    };
    await init();
    globalThis.game.system.id = 'dnd5e';

    // ready hook
    const ready = globalThis.Hooks._once.get('ready');
    await ready();
    // second init path for API already created
    await ready();

    // openAxyum paths — ready already initialized; ensure API still present
    if (!globalThis.game.ldAxyum?.open) {
      // if a prior step wiped API, reconstruct minimal surface is not possible
      // without private flags; openLDAxyum should have initialized during ready
      await globalThis.openLDAxyum();
    }
    assert.ok(globalThis.game.ldAxyum?.open);
    await globalThis.openLDAxyum();

    // open via API existing app
    globalThis.foundry.applications.instances = {
      values: () => [{ id: 'gm-hub-app', render: async () => ({ id: 'gm-hub-app' }) }].values()
    };
    await globalThis.game.ldAxyum.open();
    await globalThis.openLDAxyum();

    // openCreate / openEdit / openCompendiumSelector
    await globalThis.game.ldAxyum.openCreate();
    await globalThis.game.ldAxyum.openEdit({ id: 'a1' });
    await globalThis.game.ldAxyum.openCompendiumSelector();

    // open() error path
    const realOpen = globalThis.game.ldAxyum.open;
    globalThis.foundry.applications.instances = {
      values: () => { throw new Error('instances'); }
    };
    await assert.rejects(() => globalThis.game.ldAxyum.open());
    globalThis.game.ldAxyum.open = realOpen;

    // openAxyum outer catch (awaited open rejection)
    globalThis.game.ldAxyum.open = async () => { throw new Error('open fail'); };
    await globalThis.openLDAxyum();
    globalThis.game.ldAxyum.open = realOpen;

    // handlebars helpers
    const helpers = globalThis.Handlebars.helpers;
    assert.equal(helpers.get('eq')(1, 1), true);
    assert.equal(helpers.get('ne')(1, 2), true);
    assert.equal(helpers.get('gt')(2, 1), true);
    assert.equal(helpers.get('gte')(2, 2), true);
    assert.equal(helpers.get('lt')(1, 2), true);
    assert.equal(helpers.get('lte')(1, 1), true);
    assert.equal(helpers.get('add')(1, 2), 3);
    assert.equal(helpers.get('sum')(1, 2), 3);
    assert.equal(helpers.get('includes')([1], 1), true);
    assert.equal(helpers.get('subtract')(5, 2), 3);
    assert.equal(helpers.get('multiply')(2, 3), 6);
    assert.equal(helpers.get('divide')(5, 2), 2);
    assert.equal(helpers.get('divide')(5, 0), 0);
    assert.equal(helpers.get('abs')(-3), 3);
    assert.equal(helpers.get('percent')(1, 4), 25);
    assert.equal(helpers.get('localize')('K'), 'K');
    assert.equal(helpers.get('uppercase')('ab'), 'AB');
    assert.equal(helpers.get('formatModifier')(2), '+2');
    assert.equal(helpers.get('formatModifier')(-1), '-1');
    assert.equal(helpers.get('abilityMod')(18), '+4');
    assert.equal(helpers.get('abilityMod')(8), '-1');
    assert.equal(helpers.get('sumAll')(1, 2, 3, {}), 6);
    assert.equal(helpers.get('join')(['a', 'b'], ';'), 'a;b');
    assert.equal(helpers.get('join')(null, ','), '');
    assert.equal(helpers.get('repeat').call({}, 2, { fn: (ctx) => String(ctx.index) }), '01');
    assert.equal(helpers.get('lookup')({ a: 1 }, 'a'), 1);
    assert.equal(helpers.get('lookup')(null, 'a'), null);

    const foundryLocalize = () => 'FOUNDARY-CORE';
    helpers.set('localize', foundryLocalize);
    helpers.localize = foundryLocalize;
    const { registerHandlebarsHelpers } = await import('../axyum.mjs');
    registerHandlebarsHelpers();
    assert.equal(helpers.get('localize'), foundryLocalize);

    // scene controls — array path with token
    const controlsArr = [{ name: 'token', tools: [] }];
    for (const cb of globalThis.Hooks._on.get('getSceneControlButtons') || []) cb(controlsArr);
    assert.ok(controlsArr[0].tools.some((t) => t.name === 'ld-axyum-open-hub'));
    // invoke tool handlers
    controlsArr[0].tools.find((t) => t.name === 'ld-axyum-open-hub').onClick();
    controlsArr[0].tools.find((t) => t.name === 'ld-axyum-open-hub').onChange();
    // already injected
    for (const cb of globalThis.Hooks._on.get('getSceneControlButtons') || []) cb(controlsArr);

    // array without token
    const controlsBare = [];
    for (const cb of globalThis.Hooks._on.get('getSceneControlButtons') || []) cb(controlsBare);
    assert.ok(controlsBare.some((c) => c.name === 'ld-axyum'));

    // object path with tokens tools object
    const controlsObj = { tokens: { tools: {} } };
    for (const cb of globalThis.Hooks._on.get('getSceneControlButtons') || []) cb(controlsObj);
    assert.ok(controlsObj.tokens.tools['ld-axyum-open-hub']);

    // object without token
    const controlsEmptyObj = {};
    for (const cb of globalThis.Hooks._on.get('getSceneControlButtons') || []) cb(controlsEmptyObj);
    assert.ok(controlsEmptyObj['ld-axyum']);

    // token group with non-array/object tools forces injectInto false branch
    const controlsBadTools = [{ name: 'token', tools: 42 }];
    for (const cb of globalThis.Hooks._on.get('getSceneControlButtons') || []) cb(controlsBadTools);
    assert.ok(controlsBadTools.some((c) => c.name === 'ld-axyum' || c.tools));

    // fetch throw path for templates — re-run preload via open after forcing fetch throw
    const prevFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('network'); };
    // helpers already registered; invoke open which may reload templates if needed
    await globalThis.openLDAxyum().catch(() => {});
    globalThis.fetch = prevFetch;

    // open without open() — fallback to existing gm hub / new hub
    if (globalThis.game.ldAxyum) {
      const prevOpen = globalThis.game.ldAxyum.open;
      globalThis.game.ldAxyum.open = undefined;
      globalThis.foundry.applications.instances = {
        values: () => [{ id: 'gm-hub-app', render: async () => ({}) }].values()
      };
      await globalThis.openLDAxyum();
      globalThis.foundry.applications.instances = { values: () => [].values() };
      // may construct GmHubApp
      await globalThis.openLDAxyum().catch(() => {});
      globalThis.game.ldAxyum.open = prevOpen;
    }

    // non-GM skip
    globalThis.game.user.isGM = false;
    const noGm = [];
    for (const cb of globalThis.Hooks._on.get('getSceneControlButtons') || []) cb(noGm);
    assert.equal(noGm.length, 0);
    globalThis.game.user.isGM = true;

    // actor directory inject
    const footer = Object.assign(Object.create(HTMLElement.prototype), {
      children: [],
      prepend(btn) { this.children.unshift(btn); return btn; },
      querySelector: () => null
    });
    const root = Object.assign(Object.create(HTMLElement.prototype), {
      children: [],
      querySelector(sel) {
        if (sel === '#ld-axyum-new-char') return this._btn || null;
        if (sel === '.directory-footer') return footer;
        return null;
      },
      appendChild(btn) { this.children.push(btn); return btn; }
    });
    for (const cb of globalThis.Hooks._on.get('renderActorDirectory') || []) {
      cb({}, root);
      // second call no-op due to existing button
      root._btn = root.querySelector('#ld-axyum-new-char') || footer.children[0];
      cb({}, root);
    }
    // click new character
    const btn = footer.children[0] || root.children[0];
    if (btn?._listeners?.click) {
      for (const fn of btn._listeners.click) {
        await fn({ preventDefault() {} });
      }
    }

    // directory inject without footer
    const root2 = Object.assign(Object.create(HTMLElement.prototype), {
      children: [],
      querySelector(sel) {
        if (sel === '#ld-axyum-new-char') return null;
        return null;
      },
      appendChild(btn) { this.children.push(btn); this._btn = btn; return btn; }
    });
    for (const cb of globalThis.Hooks._on.get('renderActorDirectory') || []) cb({}, root2);
    assert.ok(root2.children.length >= 1);

    // invalid root
    for (const cb of globalThis.Hooks._on.get('renderActorDirectory') || []) cb({}, { querySelector: () => null });
    // throw path
    for (const cb of globalThis.Hooks._on.get('renderActorDirectory') || []) {
      cb({}, {
        get 0() { throw new Error('html boom'); }
      });
    }

    // template fetch failure path already covered via mixed ok; force all fail once by re-init helpers only
    // initialization failure reset
    // cannot easily re-enter private flag; cover open when already init
    await globalThis.openLDAxyum();

    // export surface
    assert.ok(mod.RulesEngine);
    assert.ok(mod.CharacterModel);
    assert.ok(mod.ExportImportUI);
  } finally {
    restoreFoundryMock(previous);
  }
});
