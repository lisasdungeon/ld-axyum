import assert from 'node:assert/strict';
import test from 'node:test';
import { CharacterImporter } from '../core/character-importer.js';

function makeActor(overrides = {}) {
  const updates = [];
  const flags = {};
  const createdDocuments = [];
  return {
    name: 'Existing Actor',
    id: 'actor1',
    items: [],
    system: { details: {}, abilities: {} },
    async update(data) {
      updates.push(data);
      return data;
    },
    async setFlag(scope, key, value) {
      flags[scope] = flags[scope] || {};
      flags[scope][key] = value;
      return value;
    },
    async createEmbeddedDocuments(type, docs) {
      createdDocuments.push({ type, docs });
      return docs;
    },
    _updates: updates,
    _flags: flags,
    _createdDocuments: createdDocuments,
    ...overrides
  };
}

const minimalValidImport = {
  character: { name: 'Test Hero' },
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
};

test('importCharacter accepts minimal valid data and fills defaults', () => {
  const result = CharacterImporter.importCharacter(minimalValidImport);
  assert.equal(result.success, true);
  assert.equal(result.data.character.name, 'Test Hero');
  assert.deepEqual(result.data.items, []);
  assert.equal(result.summary.characterName, 'Test Hero');
});

test('importCharacter rejects missing character name', () => {
  const result = CharacterImporter.importCharacter({ abilities: { str: 10 } });
  assert.equal(result.success, false);
  assert.match(result.error, /Character name is required/);
});

test('importCharacter rejects out-of-range ability scores and attaches details', () => {
  const result = CharacterImporter.importCharacter({
    character: { name: 'Bad Stats' },
    abilities: { str: 99 }
  });
  assert.equal(result.success, false);
  assert.match(result.error, /Invalid ability score for STR/);
  assert.deepEqual(result.details, { ability: 'str', score: 99 });
});

test('applyImportToActor does not throw on a minimal import missing optional sections', async () => {
  const actor = makeActor();
  const result = await CharacterImporter.applyImportToActor(minimalValidImport, actor);
  assert.equal(result.success, true);
  assert.equal(actor._updates.length, 1);
  assert.equal(actor._updates[0].system.attributes.hp.value, 0);
  assert.equal(actor._updates[0].system.attributes.hp.max, 1);
  assert.deepEqual(actor._updates[0].system.traits.armorProf.value, []);
});

test('applyImportToActor applies hit points, proficiencies, and multiclass when present', async () => {
  const actor = makeActor();
  const importData = {
    character: { name: 'Full Hero', level: 5 },
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    hitPoints: { value: 40, max: 44, temp: 2 },
    proficiencies: { armor: ['light', 'medium'], weapons: ['simple'] },
    class: { multiclass: { active: true, classes: ['fighter', 'rogue'] } }
  };

  const result = await CharacterImporter.applyImportToActor(importData, actor);
  assert.equal(result.success, true);
  assert.equal(actor._updates[0].system.attributes.hp.value, 40);
  assert.deepEqual(actor._updates[0].system.traits.armorProf.value, ['light', 'medium']);
  assert.equal(actor._flags['ld-axyum'].isMulticlass, true);
});

test('applyImportToActor imports items and spells', async () => {
  const actor = makeActor();
  const importData = {
    character: { name: 'Loaded Hero' },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    items: [{ name: 'Longsword', type: 'weapon' }],
    spells: { cantrips: [{ name: 'Fire Bolt', level: 0 }] }
  };

  await CharacterImporter.applyImportToActor(importData, actor);
  assert.equal(actor._createdDocuments.length, 2);
  assert.equal(actor._createdDocuments[0].docs[0].name, 'Longsword');
  assert.equal(actor._createdDocuments[1].docs[0].name, 'Fire Bolt');
});

test('loadFromString rejects malformed JSON', () => {
  assert.throws(() => CharacterImporter.loadFromString('{not json'), /Failed to parse JSON/);
});

test('compareWithActor flags name and level differences', () => {
  const actor = makeActor({
    name: 'Old Name',
    system: { details: { level: 3 }, abilities: { str: 10 } }
  });
  const importData = {
    character: { name: 'New Name', level: 5 },
    abilities: { str: 14 }
  };

  const comparison = CharacterImporter.compareWithActor(importData, actor);
  assert.equal(comparison.differences.some((d) => d.field === 'Character Name'), true);
  assert.equal(comparison.differences.some((d) => d.field === 'Level'), true);
});

test('importCharacter rejects null, non-object, and empty ability payloads', () => {
  assert.equal(CharacterImporter.importCharacter(null).success, false);
  assert.match(CharacterImporter.importCharacter(null).error, /Import data is required/);
  assert.match(CharacterImporter.importCharacter('nope').error, /JSON object/);
  assert.match(
    CharacterImporter.importCharacter({ character: { name: 'No Abilities' }, abilities: {} }).error,
    /Ability scores are required/
  );
});

test('applyImportToActor stores ASI, feats, homebrew, conditions, and all spell lists', async () => {
  const actor = makeActor();
  const importData = {
    character: { name: 'Full Import', race: 'Elf', class: 'Wizard', subclass: 'Evoker', background: 'Sage', alignment: 'NG', level: 8 },
    abilities: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
    armorClass: 13,
    speed: 35,
    hitPoints: { value: 40, max: 44, temp: 2 },
    proficiencies: { armor: ['light'], weapons: ['simple'], tools: ['thieves'], languages: ['common', 'elvish'] },
    class: { multiclass: { active: true, classes: ['wizard', 'fighter'] } },
    asiSelections: [{ level: 4, type: 'asi', improvements: ['int', 'int'] }, { level: 8, type: 'feat', feat: 'war-caster' }],
    feats: [{ name: 'War Caster', source: 'phb', level: 8, description: 'Concentration', prerequisites: 'spellcaster' }],
    homebrew: {
      feats: [{ id: 'hb-feat-1', name: 'Homebrew Feat' }],
      features: [{ id: 'hb-feat-feature', name: 'Homebrew Feature' }],
      spells: [{ id: 'hb-spell-1', name: 'Homebrew Spell' }]
    },
    conditions: {
      active: ['poisoned', 'frightened'],
      temporary: [
        { type: 'abilities', values: { str: 2 } },
        { type: 'ac', value: 1 },
        { type: 'resistances', values: ['fire'] }
      ]
    },
    items: [{ name: 'Staff', type: 'weapon', quantity: 1, equipped: true, rarity: 'uncommon', value: 10, weight: 4, description: 'oak', source: 'home' }],
    spells: {
      cantrips: [{ name: 'Light', level: 0, school: 'evocation', castingTime: 'action', range: 'touch', components: { verbal: true, somatic: true, material: false }, duration: '1 hour', description: 'glow', source: 'phb' }],
      prepared: [{ name: 'Shield', level: 1 }],
      known: [{ name: 'Magic Missile', level: 1 }],
      available: [{ name: 'Sleep', level: 1 }]
    },
    biography: { notes: 'A long note' }
  };

  const result = await CharacterImporter.applyImportToActor(importData, actor);
  assert.equal(result.success, true);
  assert.equal(actor._flags['ld-axyum'].isMulticlass, true);
  assert.equal(actor._flags['ld-axyum'].asiSelections[4].type, 'asi');
  assert.equal(actor._flags['ld-axyum'].feats.feat_0.name, 'War Caster');
  assert.equal(actor._flags['ld-axyum'].homebrewFeats['hb-feat-1'].name, 'Homebrew Feat');
  assert.equal(actor._flags['ld-axyum'].homebrewFeatures['hb-feat-feature'].name, 'Homebrew Feature');
  assert.equal(actor._flags['ld-axyum'].homebrewSpells['hb-spell-1'].name, 'Homebrew Spell');
  assert.equal(actor._flags.dnd5e.conditions.poisoned, true);
  assert.deepEqual(actor._flags.dnd5e.temporaryAbilities, { str: 2 });
  assert.equal(actor._flags.dnd5e.temporaryAC, 1);
  assert.deepEqual(actor._flags.dnd5e.temporaryResistances, ['fire']);
  assert.equal(actor._createdDocuments[0].docs[0].name, 'Staff');
  assert.equal(actor._createdDocuments[1].docs.length, 4);
  assert.equal(actor._createdDocuments[1].docs.find((s) => s.name === 'Shield').system.preparation.prepared, true);
});

test('applyImportToActor returns failure when actor update throws', async () => {
  const actor = makeActor({
    async update() {
      throw new Error('update failed');
    }
  });
  const result = await CharacterImporter.applyImportToActor(minimalValidImport, actor);
  assert.equal(result.success, false);
  assert.match(result.error, /update failed/);
});

test('loadFromFile resolves parsed JSON and rejects parse and read failures', async () => {
  class MockFileReader {
    constructor() {
      this.onload = null;
      this.onerror = null;
    }
    readAsText(file) {
      if (file?.failRead) {
        this.onerror?.();
        return;
      }
      this.onload?.({ target: { result: file?.contents ?? '' } });
    }
  }
  const previous = globalThis.FileReader;
  globalThis.FileReader = MockFileReader;
  try {
    const data = await CharacterImporter.loadFromFile({ contents: JSON.stringify(minimalValidImport) });
    assert.equal(data.character.name, 'Test Hero');
    await assert.rejects(
      () => CharacterImporter.loadFromFile({ contents: '{bad' }),
      /Failed to parse JSON/
    );
    await assert.rejects(
      () => CharacterImporter.loadFromFile({ failRead: true }),
      /Failed to read file/
    );
  } finally {
    globalThis.FileReader = previous;
  }
});

test('compareWithActor warns about missing items and unexpected versions', () => {
  const actor = makeActor({
    name: 'Hero',
    items: [{ name: 'Sword' }],
    system: { details: { level: 1 }, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }
  });
  const comparison = CharacterImporter.compareWithActor(
    {
      version: '2.0',
      character: { name: 'Hero', level: 1 },
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    },
    actor
  );
  assert.equal(comparison.warnings.some((w) => /no items/.test(w)), true);
  assert.equal(comparison.warnings.some((w) => /version is 2.0/.test(w)), true);
});

test('importCharacter summary counts spells, feats, homebrew, and condition flags', () => {
  const result = CharacterImporter.importCharacter({
    character: { name: 'Summary Hero', race: 'Human', class: 'Fighter', level: 3 },
    abilities: { str: 15, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    feats: [{ name: 'Tough' }],
    asiSelections: [{ level: 4 }],
    class: { multiclass: { active: true, classes: ['fighter', 'rogue'] } },
    homebrew: {
      feats: [{ id: 'a' }],
      features: [{ id: 'b' }],
      spells: [{ id: 'c' }]
    },
    conditions: {
      active: ['blinded'],
      temporary: [{ type: 'ac', value: 1 }]
    },
    items: [{ name: 'Shield', type: 'equipment' }],
    spells: {
      cantrips: [{ name: 'Mage Hand' }],
      prepared: [{ name: 'Shield' }],
      known: [{ name: 'Fireball' }],
      available: [{ name: 'Fly' }]
    }
  });
  assert.equal(result.success, true);
  assert.equal(result.summary.itemCount, 1);
  assert.equal(result.summary.spellCount, 4);
  assert.equal(result.summary.featCount, 1);
  assert.equal(result.summary.homebrewCount, 3);
  assert.equal(result.summary.hasMulticlass, true);
  assert.equal(result.summary.hasASISelections, true);
  assert.equal(result.summary.hasConditions, true);
  assert.equal(result.summary.hasTemporaryModifiers, true);
});
