import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';
import { Pf2eCompendiumQueries } from '../systems/pf2e/data/pf2e-compendium-queries.js';
import { AncestryTransformer } from '../systems/pf2e/data/pf2e-content-transformers.js';

test('Pf2eCompendiumQueries filters heritages and returns empty-cache fallbacks', () => {
  const empty = new Pf2eCompendiumQueries(null);
  assert.deepEqual(empty.getAncestries(), []);
  assert.deepEqual(empty.getBackgrounds(), []);
  assert.deepEqual(empty.getClasses(), []);
  assert.deepEqual(empty.getEquipment(), []);
  assert.deepEqual(empty.getHeritagesForAncestry('missing'), []);

  const cache = {
    ancestries: [{ id: 'elf', name: 'Elf' }, { id: 'dwarf', name: 'Dwarf' }],
    heritages: [
      { id: 'snow', name: 'Snow', ancestryId: 'Elf' },
      { id: 'ash', name: 'Ash', ancestryId: 'dwarf' },
      { id: 'loose', name: 'Loose', ancestryId: null }
    ],
    backgrounds: [{ id: 'b1' }],
    classes: [{ id: 'c1' }],
    equipment: [{ id: 'e1' }],
    feats: { skill: [{ id: 'f1', level: 2 }, { id: 'f2', level: 8 }] },
    spells: [
      { id: 'light', rank: 0, traditions: ['arcane'] },
      { id: 'fire', rank: 1, traditions: ['arcane'] },
      { id: 'heal', rank: 1, traditions: ['divine'] },
      { id: 'open', rank: 0 }
    ]
  };
  const q = new Pf2eCompendiumQueries(cache);

  assert.deepEqual(q.getHeritagesForAncestry('elf').map((h) => h.id), ['snow']);
  assert.deepEqual(q.getHeritagesForAncestry('ghost').map((h) => h.id), ['snow', 'ash', 'loose']);
  assert.deepEqual(q.getBackgrounds(), cache.backgrounds);
  assert.deepEqual(q.getClasses(), cache.classes);
  assert.deepEqual(q.getEquipment(), cache.equipment);
  assert.deepEqual(q.getFeatsByCategory('skill', 3).map((f) => f.id), ['f1']);
  assert.deepEqual(q.getSpellsForTradition('arcane', 1).map((s) => s.id), ['light', 'fire', 'open']);
  assert.deepEqual(q.getCantrips('arcane').map((s) => s.id), ['light', 'open']);
});

test('normalizeBoostList returns [] for primitive boost fields', () => {
  const out = AncestryTransformer({
    id: 'a', name: 'Odd', system: { boosts: 'dex', flaws: 2 }
  }, 'p');
  assert.deepEqual(out.boosts, []);
  assert.deepEqual(out.flaws, []);
});

test('Pf2eCharacterModel.clone recovers from circular data', async () => {
  const previous = installFoundryMock();
  try {
    const { Pf2eCharacterModel } = await import('../systems/pf2e/data/pf2e-character-model.js');
    const circular = { name: 'Loop' };
    circular.self = circular;
    const warns = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warns.push(args);
    try {
      const clone = Pf2eCharacterModel.clone(circular);
      assert.equal(clone.name, '');
      assert.equal(clone.level, 1);
      assert.ok(warns.some((args) => String(args[0]).includes('Clone error')));
    } finally {
      console.warn = originalWarn;
    }
  } finally { restoreFoundryMock(previous); }
});

test('Pf2eCompendiumLoader loads categorizes feats and caches results', async () => {
  const previous = installFoundryMock();
  try {
    const { Pf2eCompendiumLoader } = await import('../systems/pf2e/data/pf2e-compendium-loader.js');
    const loader = new Pf2eCompendiumLoader();
    const calls = [];
    loader.loader.getOrLoad = async (type) => {
      calls.push(type);
      if (type === 'feat') {
        return [
          { id: 'fa', category: 'ancestry' },
          { id: 'fc', category: 'class' },
          { id: 'fs', category: 'skill' },
          { id: 'fg', category: 'general' },
          { id: 'fb', category: 'bonus' },
          { id: 'fx', category: 'other' }
        ];
      }
      if (type === 'weapon') return [{ id: 'w1' }];
      if (type === 'armor') return [{ id: 'a1' }];
      if (type === 'equipment') return [{ id: 'e1' }];
      if (type === 'spell') return [{ id: 's1' }];
      return [{ id: type }];
    };
    let cleared = false;
    loader.loader.clearCache = () => { cleared = true; };

    const cache = await loader.loadAllContent(['pf2e.ancestries']);
    assert.deepEqual(calls, ['ancestry', 'heritage', 'background', 'class', 'feat', 'spell', 'weapon', 'armor', 'equipment']);
    assert.equal(cache.ancestries[0].id, 'ancestry');
    assert.deepEqual(cache.feats.ancestry.map((f) => f.id), ['fa']);
    assert.deepEqual(cache.feats.class.map((f) => f.id), ['fc']);
    assert.deepEqual(cache.feats.skill.map((f) => f.id), ['fs']);
    assert.deepEqual(cache.feats.general.map((f) => f.id), ['fg']);
    assert.deepEqual(cache.feats.bonus.map((f) => f.id), ['fb']);
    assert.deepEqual(cache.equipment.map((e) => e.id), ['w1', 'a1', 'e1']);
    assert.equal(loader._loaded, true);

    calls.length = 0;
    const again = await loader.getOrLoadAll();
    assert.equal(again, cache);
    assert.equal(calls.length, 0);

    loader.clearCache();
    assert.equal(cleared, true);
    assert.equal(loader._loaded, false);

    await loader.getOrLoadAll(['x']);
    assert.ok(calls.includes('ancestry'));
  } finally { restoreFoundryMock(previous); }
});
