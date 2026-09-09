import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AncestryTransformer, HeritageTransformer, BackgroundTransformer, ClassTransformer,
  FeatTransformer, SpellTransformer, EquipmentTransformer
} from '../systems/pf2e/data/pf2e-content-transformers.js';

test('AncestryTransformer maps full pf2e ancestry items including keyed boost objects', () => {
  const out = AncestryTransformer({
    id: 'a1', name: 'Elf', img: 'elf.png',
    system: {
      hp: '8', size: 'sm', speed: 25,
      boosts: { 0: { value: ['dex'] }, 1: { value: ['free'] } },
      flaws: ['str'],
      traits: { value: ['humanoid', 'elf'] },
      description: { value: '<p>Keen senses.</p>  Long-lived.' }
    }
  }, 'pf2e.ancestries');
  assert.equal(out.id, 'a1');
  assert.equal(out.packName, 'pf2e.ancestries');
  assert.equal(out.name, 'Elf');
  assert.equal(out.img, 'elf.png');
  assert.equal(out.hp, 8);
  assert.equal(out.size, 'sm');
  assert.equal(out.speed, 25);
  assert.deepEqual(out.boosts, ['dex', 'free']);
  assert.deepEqual(out.flaws, ['str']);
  assert.deepEqual(out.traits, ['humanoid', 'elf']);
  assert.equal(out.description, 'Keen senses. Long-lived.');
});

test('AncestryTransformer applies safe defaults for sparse ancestry items', () => {
  const out = AncestryTransformer({ id: 'a2', name: 'Bare', system: {} }, 'p');
  assert.equal(out.hp, 0);
  assert.equal(out.size, 'med');
  assert.equal(out.speed, 25);
  assert.deepEqual(out.boosts, []);
  assert.deepEqual(out.flaws, []);
  assert.deepEqual(out.traits, []);
  assert.equal(out.description, '');
});

test('HeritageTransformer resolves ancestry linkage from every stored shape', () => {
  const bySlug = HeritageTransformer({ id: 'h1', name: 'Snow', system: { ancestry: { slug: 'elf' } } }, 'p');
  assert.equal(bySlug.ancestryId, 'elf');
  const byValue = HeritageTransformer({ id: 'h2', name: 'Ash', system: { ancestry: { value: 'Elf' } } }, 'p');
  assert.equal(byValue.ancestryId, 'Elf');
  const byRaw = HeritageTransformer({ id: 'h3', name: 'Stone', system: { ancestry: 'Dwarf' } }, 'p');
  assert.equal(byRaw.ancestryId, 'Dwarf');
  const none = HeritageTransformer({ id: 'h4', name: 'Loose', system: {} }, 'p');
  assert.equal(none.ancestryId, null);
});

test('BackgroundTransformer extracts boosts, trained skill, and lore skill', () => {
  const out = BackgroundTransformer({
    id: 'b1', name: 'Sailor',
    system: { boosts: ['str', 'wis'], trainedSkills: { value: ['athletics'] }, trainedLore: 'Sailing Lore' }
  }, 'p');
  assert.deepEqual(out.boosts, ['str', 'wis']);
  assert.equal(out.trainedSkill, 'athletics');
  assert.equal(out.loreSkill, 'Sailing Lore');
  const fallback = BackgroundTransformer({ id: 'b2', name: 'Fightr', system: { trainedSkill: 'acrobatics', boosts: null } }, 'p');
  assert.equal(fallback.trainedSkill, 'acrobatics');
  assert.deepEqual(fallback.boosts, []);
});

test('ClassTransformer maps key ability options, class DC rank, and spellcasting', () => {
  const out = ClassTransformer({
    id: 'c1', name: 'Wizard',
    system: {
      hp: 10, keyAbility: { value: ['int', 'wis'] },
      classDC: { rank: 'expert' }, spellcasting: { tradition: 'arcane' }
    }
  }, 'p');
  assert.equal(out.hpPerLevel, 10);
  assert.equal(out.keyAbility, 'int');
  assert.deepEqual(out.keyAbilityOptions, ['int', 'wis']);
  assert.equal(out.classDC, 'expert');
  assert.deepEqual(out.spellcasting, { tradition: 'arcane' });

  const arrayForm = ClassTransformer({ id: 'c2', name: 'Fighter', system: { keyAbility: ['str'], hp: 0 } }, 'p');
  assert.equal(arrayForm.keyAbility, 'str');
  assert.deepEqual(arrayForm.keyAbilityOptions, ['str']);
  assert.equal(arrayForm.hpPerLevel, 8);
  const rawForm = ClassTransformer({ id: 'c3', name: 'Rogue', system: { keyAbility: 'dex', classDC: {} } }, 'p');
  assert.equal(rawForm.keyAbility, 'dex');
  assert.deepEqual(rawForm.keyAbilityOptions, []);
  assert.equal(rawForm.classDC, 'trained');
  assert.equal(rawForm.spellcasting, null);
});

test('FeatTransformer whitelists categories, levels, and flattens prerequisites', () => {
  const out = FeatTransformer({
    id: 'f1', name: 'Elven Accuracy',
    system: {
      category: 'CLASS', level: { value: 4 },
      traits: { value: ['lineage'] },
      prerequisites: { value: [{ value: 'Elf' }, 'Level 2'] }
    }
  }, 'p');
  assert.equal(out.category, 'class');
  assert.equal(out.level, 4);
  assert.deepEqual(out.prerequisites, ['Elf', 'Level 2']);
  assert.deepEqual(out.traits, ['lineage']);
  const odd = FeatTransformer({ id: 'f2', name: 'Weird', system: { category: 'weird' } }, 'p');
  assert.equal(odd.category, 'bonus');
  assert.equal(odd.level, 1);
  assert.deepEqual(odd.prerequisites, []);
});

test('SpellTransformer derives cantrip rank 0 from the cantrip trait', () => {
  const cantrip = SpellTransformer({
    id: 's1', name: 'Light',
    system: { level: { value: 1 }, traits: { value: ['cantrip', 'arcane'], traditions: ['arcane'] } }
  }, 'p');
  assert.equal(cantrip.rank, 0);
  assert.deepEqual(cantrip.traditions, ['arcane']);
  const ranked = SpellTransformer({ id: 's2', name: 'Fireball', system: { rank: { value: 3 } } }, 'p');
  assert.equal(ranked.rank, 3);
  const byLevel = SpellTransformer({ id: 's3', name: 'Fear', system: { level: { value: 2 } } }, 'p');
  assert.equal(byLevel.rank, 2);
  const bare = SpellTransformer({ id: 's4', name: 'Mystery', system: {} }, 'p');
  assert.equal(bare.rank, 0);
});

test('EquipmentTransformer maps bulk, price, category, and dex cap variants', () => {
  const out = EquipmentTransformer({
    id: 'e1', name: 'Longsword', type: 'weapon',
    system: { bulk: { value: '1' }, price: { value: { gp: 15 } }, category: 'martial', dexCap: { value: 3 } }
  }, 'p');
  assert.equal(out.type, 'weapon');
  assert.equal(out.bulk, '1');
  assert.deepEqual(out.price, { gp: 15 });
  assert.equal(out.category, 'martial');
  assert.equal(out.dexCap, 3);
  const bare = EquipmentTransformer({ id: 'e2', name: 'Rock', type: 'equipment', system: { group: 'simple', dexCap: { value: 'x' } } }, 'p');
  assert.equal(bare.bulk, 0);
  assert.deepEqual(bare.price, { gp: 0 });
  assert.equal(bare.category, 'simple');
  assert.equal(bare.dexCap, null);
});
