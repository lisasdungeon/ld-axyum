import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

function makeCharacter(overrides = {}) {
  return {
    name: 'Sora',
    level: 2,
    ancestry: { id: 'elf', name: 'Elf', hp: 8, flaws: ['str'], packName: 'pf2e.ancestries' },
    heritage: { id: 'snow', name: 'Snow', packName: 'pf2e.heritages' },
    background: { id: 'wan', name: 'Wanderer', packName: 'pf2e.backgrounds' },
    class: { id: 'wiz', name: 'Wizard', hpPerLevel: 10, packName: 'pf2e.classes' },
    abilityBoosts: {
      ancestry: ['dex'],
      background: 'int',
      class: 'int',
      free: ['cha', 'con', 'wis', 'str']
    },
    proficiencies: {
      saves: { fortitude: 'trained', reflex: 'expert', will: 'trained' },
      skills: { arcana: 'trained', stealth: 'expert', ghost: 'nope' },
      perception: 'trained',
      classDC: 'trained'
    },
    feats: { ancestry: ['fa'], class: ['fc'], skill: [], general: [] },
    spells: { selectedCantrips: ['light'], selectedSpells: { 1: ['fire'] } },
    equipment: { selectedIds: ['sword'] },
    languages: ['Common'],
    details: { portrait: 'face.png', backstory: 'A story' },
    ...overrides
  };
}

function makeCache() {
  return {
    ancestries: [{ id: 'elf', packName: 'pf2e.ancestries' }],
    heritages: [{ id: 'snow', packName: 'world' }],
    backgrounds: [{ id: 'wan', packName: 'pf2e.backgrounds' }],
    classes: [{ id: 'wiz', packName: 'pf2e.classes' }],
    feats: {
      ancestry: [{ id: 'fa', packName: 'pf2e.feats' }],
      class: [{ id: 'fc', packName: 'pf2e.feats' }]
    },
    spells: [
      { id: 'light', packName: 'pf2e.spells' },
      { id: 'fire', packName: 'pf2e.spells' }
    ],
    equipment: [{ id: 'sword', packName: 'pf2e.equipment' }]
  };
}

function makeDoc(id) {
  return {
    id,
    toObject() { return { _id: id, name: id, type: 'feat', system: {} }; }
  };
}

test('Pf2eActorAdapter converts skills ranks and creates embedded items', async () => {
  const previous = installFoundryMock();
  try {
    const { Pf2eActorAdapter } = await import('../systems/pf2e/adapter/pf2e-actor-adapter.js');
    const cache = makeCache();
    const created = [];
    const packDocs = new Map([
      ['elf', makeDoc('elf')],
      ['wan', makeDoc('wan')],
      ['wiz', makeDoc('wiz')],
      ['fa', makeDoc('fa')],
      ['fc', makeDoc('fc')],
      ['light', makeDoc('light')],
      ['fire', makeDoc('fire')],
      ['sword', makeDoc('sword')]
    ]);

    globalThis.game.items = Object.assign([], {
      get: (id) => (id === 'snow' ? makeDoc('snow') : null)
    });
    globalThis.game.packs = {
      get: (name) => ({
        getDocument: async (id) => {
          if (name === 'pf2e.feats' && id === 'fc') throw new Error('pack fail');
          return packDocs.get(id) || null;
        }
      })
    };

    globalThis.Actor.create = async (data) => {
      created.push(data);
      const items = [];
      return {
        id: 'a1',
        name: data.name,
        system: data.system,
        items,
        createEmbeddedDocuments: async (_type, docs) => {
          items.push(...docs);
          return docs;
        },
        deleteEmbeddedDocuments: async () => {},
        update: async () => {}
      };
    };

    const warns = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warns.push(args.join(' '));
    let actor;
    try {
      actor = await Pf2eActorAdapter.createActor(makeCharacter(), cache);
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(created[0].name, 'Sora');
    assert.equal(created[0].system.skills.arcana.rank, 1);
    assert.equal(created[0].system.skills.stealth.rank, 2);
    assert.equal(created[0].system.skills.ghost.rank, 0);
    assert.equal(created[0].system.saves.reflex.rank, 2);
    assert.ok(actor.items.some((i) => i.name === 'elf'));
    assert.ok(actor.items.some((i) => i.name === 'snow'));
    assert.ok(actor.items.some((i) => i.name === 'fa'));
    assert.ok(actor.items.some((i) => i.name === 'light'));
    assert.ok(actor.items.some((i) => i.name === 'sword'));
    assert.ok(!actor.items.some((i) => i.name === 'fc'));
    assert.ok(warns.some((w) => w.includes('Failed to fetch item')));

    const updates = [];
    const deleted = [];
    const embedded = [];
    const existing = {
      name: 'Sora',
      items: [
        { id: 'old-a', type: 'ancestry' },
        { id: 'keep', type: 'feat' }
      ],
      update: async (patch) => updates.push(patch),
      deleteEmbeddedDocuments: async (_type, ids) => { deleted.push(...ids); },
      createEmbeddedDocuments: async (_type, docs) => { embedded.push(...docs); return docs; }
    };
    await Pf2eActorAdapter.updateActor(existing, makeCharacter({ feats: {}, spells: {}, equipment: { selectedIds: [] } }), {
      ancestries: cache.ancestries,
      heritages: cache.heritages,
      backgrounds: cache.backgrounds,
      classes: cache.classes
    });
    assert.equal(updates.length, 1);
    assert.deepEqual(deleted, ['old-a']);
    assert.ok(embedded.length > 0);

    const bare = await Pf2eActorAdapter.createActor({ name: 'Bare' }, {});
    assert.equal(bare.name, 'Bare');
  } finally { restoreFoundryMock(previous); }
});

test('Pf2eActorAdapter skips missing cache entries and null create results', async () => {
  const previous = installFoundryMock();
  try {
    const { Pf2eActorAdapter } = await import('../systems/pf2e/adapter/pf2e-actor-adapter.js');
    globalThis.Actor.create = async () => null;
    await assert.rejects(
      () => Pf2eActorAdapter.createActor({ name: 'Nope' }, {}),
      /Actor.create returned null/
    );

    const actor = {
      name: 'Empty',
      items: [],
      update: async () => {},
      createEmbeddedDocuments: async () => { throw new Error('should not create'); },
      deleteEmbeddedDocuments: async () => {}
    };
    await Pf2eActorAdapter.updateActor(actor, makeCharacter({
      ancestry: { id: 'missing' },
      heritage: {},
      background: { id: 'missing' },
      class: { id: 'missing' },
      feats: { ancestry: ['missing'], class: [], skill: [], general: [] },
      spells: { selectedCantrips: ['missing'], selectedSpells: { 1: ['missing'] } },
      equipment: { selectedIds: ['missing'] }
    }), makeCache());
  } finally { restoreFoundryMock(previous); }
});
