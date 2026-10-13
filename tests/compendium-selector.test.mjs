import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

function el(partial = {}) {
  return Object.assign(Object.create(HTMLElement.prototype), {
    dataset: {},
    classList: {
      _set: new Set(),
      add(v) { this._set.add(v); },
      remove(v) { this._set.delete(v); },
      toggle(v, force) {
        if (force === true) this._set.add(v);
        else if (force === false) this._set.delete(v);
        else if (this._set.has(v)) this._set.delete(v);
        else this._set.add(v);
      },
      contains(v) { return this._set.has(v); }
    },
    checked: false,
    ...partial
  });
}

test('CompendiumSelector categorizes packs and saves settings', async () => {
  const previous = installFoundryMock();
  try {
    const settingsStore = {};
    globalThis.game.settings.get = (_m, key) => settingsStore[key] || {};
    globalThis.game.settings.set = async (_m, key, val) => { settingsStore[key] = val; };
    globalThis.game.user.isGM = true;

    const packs = [
      {
        collection: 'dnd5e.classes',
        title: 'Classes',
        documentName: 'Item',
        metadata: { packageName: 'dnd5e', flags: { dnd5e: { types: ['class'] } } }
      },
      {
        collection: 'world.races',
        title: 'Custom Races',
        documentName: 'Item',
        metadata: { packageName: 'world', flags: { dnd5e: { types: ['race', 'species'] } } }
      },
      {
        collection: 'homebrew.backgrounds',
        title: 'Background Pack',
        documentName: 'Item',
        metadata: { packageName: 'homebrew-mod', flags: { dnd5e: { types: ['background'] } } }
      },
      {
        collection: 'dnd5e.spells',
        title: 'Spells',
        documentName: 'Item',
        metadata: { packageName: 'dnd5e', flags: { dnd5e: { types: ['spell'] } } }
      },
      {
        collection: 'dnd5e.items',
        title: 'Equipment Items',
        documentName: 'Item',
        metadata: { packageName: 'dnd5e', flags: { dnd5e: { types: ['equipment', 'weapon'] } } }
      },
      {
        collection: 'dnd5e.feats',
        title: 'Feats',
        documentName: 'Item',
        metadata: { packageName: 'dnd5e', flags: { dnd5e: { types: ['feat'] } } }
      },
      {
        collection: 'world.uncategorized-pack',
        title: 'Odds and Ends Bundle',
        documentName: 'Item',
        metadata: { packageName: 'world' }
      },
      {
        collection: 'world.actors',
        title: 'Actors',
        documentName: 'Actor',
        metadata: { packageName: 'world' }
      },
      {
        collection: 'world.name-class-pack',
        title: 'Named Class Bundle',
        documentName: 'Item',
        metadata: { packageName: 'world' }
      }
    ];
    globalThis.game.packs = {
      values() { return packs[Symbol.iterator](); }
    };

    const infos = [];
    const warns = [];
    const successes = [];
    globalThis.ui.notifications = {
      info: (m) => infos.push(m),
      warn: (m) => warns.push(m),
      success: (m) => successes.push(m),
      error: () => {}
    };

    const { CompendiumSelector } = await import('../ui/modals/compendium-selector.js');
    const app = new CompendiumSelector();

    const ctx = await app._prepareContext({});
    assert.ok(ctx.hasClasses);
    assert.ok(ctx.hasRaces);
    assert.ok(ctx.hasBackgrounds);
    assert.ok(ctx.hasSpells);
    assert.ok(ctx.hasEquipment);
    assert.ok(ctx.hasFeats);
    assert.ok(ctx.hasOther);
    assert.equal(app._getIconForType('Item'), 'fa-solid fa-suitcase');
    assert.equal(app._getIconForType('Actor'), 'fa-solid fa-users');
    assert.equal(app._getIconForType('JournalEntry'), 'fa-solid fa-book');
    assert.equal(app._getIconForType('RollTable'), 'fa-solid fa-th-list');
    assert.equal(app._getIconForType('Macro'), 'fa-solid fa-code');
    assert.equal(app._getIconForType('Playlist'), 'fa-solid fa-music');
    assert.equal(app._getIconForType('Scene'), 'fa-solid fa-map');
    assert.equal(app._getIconForType('Unknown'), 'fa-solid fa-folder');

    // Explicit selection path
    settingsStore.enabledCompendia = { 'dnd5e.classes': true };
    const ctx2 = await app._prepareContext({});
    assert.equal(ctx2.compendia.classes.find((p) => p.id === 'dnd5e.classes')?.enabled, true);

    // settings get throw
    globalThis.game.settings.get = () => { throw new Error('no setting'); };
    const ctx3 = await app._prepareContext({});
    assert.ok(ctx3.compendia);

    // empty packs
    globalThis.game.packs = null;
    const ctx4 = await app._prepareContext({});
    assert.equal(ctx4.hasClasses, false);

    // Build a fake element tree for UI actions
    const tabItems = [el(), el()];
    const panels = [
      el({ dataset: { tab: 'classes' } }),
      el({ dataset: { tab: 'races' } })
    ];
    const checks = [
      el({ dataset: { packId: 'dnd5e.classes' }, checked: true }),
      el({ dataset: { packId: 'world.races' }, checked: false })
    ];
    app.element = {
      querySelectorAll(sel) {
        if (sel === '.tabs .item') return tabItems;
        if (sel === '.tab-content') return panels;
        if (sel.includes('input[type="checkbox"]') && sel.includes('classes')) {
          return [checks[0]];
        }
        if (sel === 'input[type="checkbox"]:checked') {
          return checks.filter((c) => c.checked);
        }
        return [];
      },
      querySelector(sel) {
        if (sel === '.tab-content[data-tab="races"]') return panels[1];
        return null;
      }
    };

    app._onRender({}, {});
    assert.ok(tabItems[0].classList._set.has('active'));
    assert.ok(panels[0].classList._set.has('active'));

    app._onSwitchTab({ currentTarget: el({ dataset: { tab: 'races' }, classList: tabItems[1].classList }) });
    assert.ok(panels[1].classList._set.has('active'));

    app._onSelectAll({ currentTarget: el({ dataset: { tab: 'classes' } }) });
    assert.equal(checks[0].checked, true);
    app._onDeselectAll({ currentTarget: el({ dataset: { tab: 'classes' } }) });
    assert.equal(checks[0].checked, false);
    checks[0].checked = true;

    let closed = false;
    app.close = async () => { closed = true; };

    globalThis.game.settings.get = (_m, key) => settingsStore[key] || {};
    globalThis.game.ldAxyum = {
      AxyumApp: { invalidateContentCache() {} },
      compendiumLoader: {
        async clearCache() { return true; }
      }
    };

    await app._onSave({});
    assert.equal(settingsStore.enabledCompendia['dnd5e.classes'], true);
    assert.ok(successes.length >= 1);
    assert.equal(closed, true);

    // clearCache failure
    closed = false;
    globalThis.game.ldAxyum.compendiumLoader.clearCache = async () => { throw new Error('reload fail'); };
    await app._onSave({});
    assert.ok(warns.some((m) => String(m).includes('Failed to reload')));

    // non-GM
    globalThis.game.user.isGM = false;
    warns.length = 0;
    await app._onSave({});
    assert.ok(warns.some((m) => String(m).includes('Only the GM')));

    // no loader
    globalThis.game.user.isGM = true;
    globalThis.game.ldAxyum = {};
    closed = false;
    await app._onSave({});
    assert.equal(closed, true);

    app._onCancel();
  } finally {
    restoreFoundryMock(previous);
  }
});
