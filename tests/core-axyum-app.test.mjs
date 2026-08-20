import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

function el(props = {}) {
  const node = Object.assign(Object.create(HTMLElement.prototype), {
    style: {},
    dataset: { action: 'test', ...(props.dataset || {}) },
    classList: {
      _s: new Set(),
      add(v) { this._s.add(v); },
      remove(v) { this._s.delete(v); },
      contains(v) { return this._s.has(v); },
      toggle(v, force) {
        if (force === false) this._s.delete(v);
        else if (force === true || !this._s.has(v)) this._s.add(v);
        else this._s.delete(v);
      }
    },
    children: [],
    value: '',
    checked: false,
    type: 'text',
    name: '',
    disabled: false,
    textContent: '',
    hidden: false,
    scrollTop: 0,
    _listeners: {},
    ...props
  });
  // dataset may be overwritten by props spread — ensure action host + custom keys
  node.dataset = { action: 'test', ...(props.dataset || {}), ...(node.dataset || {}) };
  node.addEventListener = (t, fn) => {
    node._listeners[t] = node._listeners[t] || [];
    node._listeners[t].push(fn);
  };
  node.querySelector = props.querySelector || (() => null);
  node.querySelectorAll = props.querySelectorAll || (() => []);
  node.closest = props.closest || (() => node);
  node.hasAttribute = (a) => a in (props.attrs || {});
  node.matches = (sel) => props.matchesSel === sel;
  return node;
}

test('AxyumApp context builders, lifecycle, and action handlers cover branches', async () => {
  const previous = installFoundryMock();
  const timers = [];
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => {
    timers.push(fn);
    return timers.length;
  };
  globalThis.requestAnimationFrame = (fn) => { fn(); return 1; };
  try {
    const { AxyumApp } = await import('../core/axyum-app.js');
    AxyumApp.invalidateContentCache();
    globalThis.game.ldAxyum = {
      compendiumLoader: {
        cache: {
          classes: [{
            id: 'c1', name: 'Wizard', hitDice: 'd6', spellcasting: 'full', saves: ['INT'],
            skills: ['Arcana'], packName: 'world', source: 'PHB', startingEquipment: []
          }, {
            id: 'c2', name: 'Warlock', hitDice: 'd8', spellcasting: 'pact', saves: ['WIS'],
            skills: [], packName: 'dnd5e.classes', source: 'PHB'
          }],
          races: [{ id: 'r1', name: 'Elf', movement: { walk: 35 }, packName: 'world', source: 'PHB' }],
          backgrounds: [{ id: 'b1', name: 'Sage', packName: 'world', source: 'PHB', skills: ['Arcana'] }],
          spells: [
            { id: 's0', name: 'Light', level: 0, classes: ['Wizard'] },
            { id: 's1', name: 'Fireball', level: 3, classes: ['Wizard'] }
          ],
          equipment: [{ id: 'e1', name: 'Staff', type: 'weapon', packName: 'world' }],
          feats: [{ id: 'f1', name: 'Alert', requiresLevel: 1 }]
        },
        loadAllContent: async function () { return this.cache; },
        clearCache: async function () { return this.cache; }
      }
    };
    globalThis.game.packs = {
      size: 1,
      get: () => ({
        getDocument: async () => ({ system: { startingEquipment: [{ type: 'linked', count: 1 }] } })
      })
    };
    globalThis.game.settings.get = (mod, key) => {
      if (mod === 'core' && key === 'globalAmbientVolume') return 1;
      return null;
    };
    globalThis.foundry.audio = {
      AudioHelper: {
        play: async () => {}
      }
    };

    const app = new AxyumApp({ mode: 'create' });
    app.render = async () => app;
    app.close = async () => { app.closed = true; };
    app.element = el({
      dataset: {},
      querySelector: (sel) => {
        if (sel === '.axyum-content') return { scrollTop: 12 };
        if (sel === 'input[name="name"]') return { value: 'Hero' };
        if (sel === '#ability-total') return { textContent: '' };
        if (sel === '#assigned-count') return { textContent: '' };
        if (sel.startsWith('#dice-anim-')) {
          return {
            classList: { add() {} },
            querySelectorAll: () => [{
              className: '',
              classList: { add() {}, remove() {} },
              offsetWidth: 1
            }]
          };
        }
        if (sel.startsWith('[name=')) return { value: '' };
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel.includes('draggable-score')) return [el({ dataset: { score: '15' } })];
        if (sel.includes('ability-drop-zone')) return [el({ dataset: { ability: 'str' } })];
        if (sel.includes('input')) {
          return [
            el({ name: 'details.traits', type: 'text', value: 'x' }),
            el({ name: 'skillProficiencies', type: 'text' }),
            el({ name: 'level', type: 'number', value: '3', attrs: { 'data-action': true }, hasAttribute: (a) => a === 'data-action' })
          ];
        }
        if (sel === '.drag-over') return [el()];
        return [];
      }
    });
    app.element.dataset = {};
    app.element.addEventListener = (t, fn) => {
      app.element._listeners = app.element._listeners || {};
      app.element._listeners[t] = app.element._listeners[t] || [];
      app.element._listeners[t].push(fn);
    };

    // cache miss load
    await app._prepareContext({});
    assert.ok(app.availableOptions.classes.length >= 1);
    // warlock path
    app.characterData.class = { id: 'c2', name: 'Warlock', level: 5, hitDie: '8' };
    app.characterData.totalLevel = 5;
    app.characterData.abilityMethod = 'pointbuy';
    app.characterData.abilities = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 15 };
    app.characterData.chooseASI = false;
    app.characterData.feats = [];
    app.characterData.skillProficiencies = [];
    app.characterData.proficiencies = { languages: [], armor: [], weapons: [], tools: [] };
    app.characterData.selectedCantrips = [];
    app.characterData.selectedSpells = [];
    app.characterData.startingPackageId = null;
    app.characterData.startingPackageChoices = {};
    app.characterData.selectedEquipmentIds = [];
    const ctx = await app._prepareContext({});
    assert.ok(ctx.derivedStats);

    // load error path
    AxyumApp.invalidateContentCache();
    const badLoader = {
      loadAllContent: async () => { throw new Error('load boom'); },
      cache: {}
    };
    globalThis.game.ldAxyum.compendiumLoader = badLoader;
    await app._loadAvailableOptions();
    assert.deepEqual(app.availableOptions.classes, []);

    // empty cache force reload
    AxyumApp.invalidateContentCache();
    globalThis.game.ldAxyum.compendiumLoader = {
      cache: { classes: [], races: [], backgrounds: [], spells: [], equipment: [], feats: [] },
      loadAllContent: async function () { return this.cache; },
      clearCache: async function () {
        this.cache = {
          classes: [{ id: 'c1', name: 'Wizard', hitDice: 'd6', spellcasting: 'full', saves: [], skills: [] }],
          races: [{ id: 'r1', name: 'Human' }],
          backgrounds: [{ id: 'b1', name: 'Sage' }],
          spells: [], equipment: [], feats: []
        };
        return this.cache;
      }
    };
    globalThis.game.packs.size = 2;
    await app._loadAvailableOptions();
    assert.ok(app.availableOptions.classes.length >= 1);

    // version change invalidates
    AxyumApp._cachedModuleVersion = '0.0.1';
    globalThis.game.modules.get = () => ({ version: '9.9.9' });
    globalThis.game.ldAxyum.compendiumLoader.clearCache = () => {};
    AxyumApp._ensureCacheFresh();

    // normalizers
    assert.equal(app._normalizeClass(null), null);
    assert.ok(app._normalizeClass({ name: 'X', hitDie: '10', saves: 'bad' }).hitDieLabel);
    assert.ok(app._normalizeRace({ name: 'R' }));
    assert.ok(app._normalizeBackground({ name: 'B' }));
    assert.ok(app._normalizeSpell({ name: 'S', level: 1 }));
    assert.ok(app._normalizeEquipment({ name: 'E' }));
    assert.ok(app._normalizeFeat({ name: 'F' }));
    assert.ok(app._buildSkillsList(null));
    app.characterData.class = { name: 'Wizard', level: 4, id: 'c1' };
    app.characterData.background = { name: 'Sage', id: 'b1' };
    assert.ok(app._buildSkillChoices());
    assert.ok(app._getSpellKnownBudget('wizard', 5) >= 0);
    assert.ok(app._getSpellKnownBudget('sorcerer', 5) >= 0);
    assert.ok(app._getSpellKnownBudget('bard', 5) >= 0);
    assert.ok(app._getSpellKnownBudget('warlock', 5) >= 0);
    assert.ok(app._getSpellKnownBudget('fighter', 5) >= 0);
    assert.ok(app._buildSpellsByLevel('Wizard', 3, true));
    assert.ok(app._buildSpellsByLevel('', 0, false));
    assert.ok(app._buildStartingEquipmentView());
    assert.ok(app._featSlotsAvailable() >= 0);
    assert.ok(app._buildEquipmentList());
    assert.ok(app._buildFeatsList());
    assert.ok(app._buildLanguageList());
    assert.ok(Array.isArray(app._getRaceLanguages()));
    assert.ok(app._getLanguageGrants());
    assert.ok(app._getTotalLanguageSlots() >= 0);
    assert.ok(app._buildArmorProficiencies());
    assert.ok(app._buildWeaponProficiencies());
    assert.ok(app._buildToolProficiencies());
    assert.ok(app._getToolGrants());
    assert.match(String(app._getAbilityModifier('str')), /^[+-]?\d+$/);
    assert.ok(app._buildPointBuyView());
    assert.ok(app._calculateHP() >= 0);
    assert.ok(app._calculateAC() >= 0);
    assert.ok(app._calculateProficiencyBonus() >= 2);
    assert.ok(Number.isInteger(app._calculateInitiative()));
    assert.ok(app._calculatePassivePerception() >= 0);
    assert.ok(app._getTotalLevel() >= 1);
    assert.ok(app._calculatePassiveInsight() >= 0);
    app._updateDerivedStats();

    // action el
    assert.equal(app._actionEl(null, null), null);
    const withAction = el({ dataset: { action: 'x' } });
    assert.equal(app._actionEl({}, withAction), withAction);
    const child = el({
      dataset: {},
      closest: () => el({ dataset: { action: 'y' } })
    });
    assert.ok(app._actionEl({ target: child }, null));

    // lifecycle
    await app._preRender({}, {});
    app._onRender({}, {});
    app._setupSpellCheckboxes();
    const changeHandlers = app.element._listeners.change || [];
    const mkCheckbox = (name, value, checked) => {
      const input = Object.assign(Object.create(HTMLElement.prototype), {
        type: 'checkbox', name, value, checked,
        closest: () => ({ classList: { toggle() {} } })
      });
      Object.setPrototypeOf(input, HTMLInputElement?.prototype || HTMLElement.prototype);
      return input;
    };
    globalThis.HTMLInputElement = class HTMLInputElement extends HTMLElement {};
    for (const h of changeHandlers) {
      const c1 = mkCheckbox('cantrips', 's0', true);
      app.characterData.selectedCantrips = [];
      app.characterData.class = { name: 'Wizard', level: 1 };
      h({ target: c1 });
      const c2 = mkCheckbox('spells', 's1', true);
      app.characterData.selectedSpells = [];
      h({ target: c2 });
      c2.checked = false;
      h({ target: c2 });
      // over limit
      app.characterData.selectedCantrips = ['a', 'b', 'c', 'd', 'e', 'f'];
      const c3 = mkCheckbox('cantrips', 'over', true);
      h({ target: c3 });
      app.characterData.selectedSpells = Array.from({ length: 50 }, (_, i) => `s${i}`);
      const c4 = mkCheckbox('spells', 'over', true);
      h({ target: c4 });
      // ignore non-checkbox
      h({ target: { type: 'text' } });
    }
    app.element.dataset.axyumSpellsBound = 'true';
    app._setupSpellCheckboxes();
    app._setupFormInputs();
    app.characterData.abilityMethod = 'pointbuy';
    app._updateAbilitySummary();
    app.characterData.abilityMethod = 'roll';
    app.abilityManager.assignedAbilities = { str: 15 };
    app._updateAbilitySummary();
    app._setupDragDrop();
    app.setPosition({ width: 100 });
    app.setPosition();
    app.element = null;
    app.setPosition({});
    app.element = el();
    app._updatePosition(null);
    app._updatePosition({ left: 1 });
    await app._onClose({});

    assert.ok(true);
  } finally {
    globalThis.setTimeout = realSetTimeout;
    restoreFoundryMock(previous);
  }
});
