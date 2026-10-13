import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

test('Dnd5eActorAdapter converts classes proficiencies and spells shapes', async () => {
  const previous = installFoundryMock();
  try {
    const { Dnd5eActorAdapter } = await import('../systems/dnd5e/adapter/dnd5e-actor-adapter.js');

    assert.deepEqual(Dnd5eActorAdapter._convertClasses(null), {});
    assert.deepEqual(Dnd5eActorAdapter._convertClasses({
      id: 'wizard', name: 'Wizard', level: 5, hitDie: 'd6'
    }), {
      wizard: { name: 'Wizard', level: 5, hitDice: 'd6', hitDiceUsed: 0 }
    });
    assert.deepEqual(Dnd5eActorAdapter._convertClasses({ id: 'fighter', name: 'Fighter' }), {
      fighter: { name: 'Fighter', level: 1, hitDice: 'd8', hitDiceUsed: 0 }
    });

    assert.deepEqual(Dnd5eActorAdapter._convertProficiencies(null), {
      armor: [], weapons: [], tools: []
    });
    assert.deepEqual(Dnd5eActorAdapter._convertProficiencies({
      armor: ['light'], weapons: ['simple'], tools: ['thieves']
    }), {
      armor: ['light'], weapons: ['simple'], tools: ['thieves']
    });

    assert.deepEqual(Dnd5eActorAdapter._convertSpells(null), {});
    assert.deepEqual(Dnd5eActorAdapter._convertSpells([]), {});
    assert.deepEqual(Dnd5eActorAdapter._convertSpells({ a: { name: 'Fire Bolt', level: 0 } }), {
      spell0: [{ name: 'Fire Bolt', prepared: false, uses: { value: 0, max: 0 } }]
    });
    assert.deepEqual(Dnd5eActorAdapter._convertSpells([
      { name: 'Magic Missile', level: 1, prepared: true, uses: { current: 1, max: 2 } },
      { name: 'Fireball', level: 3 },
      { name: 'Skip', level: 99 },
      null
    ]), {
      spell1: [{ name: 'Magic Missile', prepared: true, uses: { value: 1, max: 2 } }],
      spell3: [{ name: 'Fireball', prepared: false, uses: { value: 0, max: 0 } }]
    });

    const created = [];
    globalThis.Actor.create = async (data) => {
      created.push(data);
      return { id: 'a1', ...data, update: async () => {} };
    };
    const actor = await Dnd5eActorAdapter.createActor({
      name: 'Hero',
      abilities: { str: 16, dex: 14 },
      skills: { athletics: { proficient: true, expertise: false }, stealth: { proficient: true, expertise: true } },
      hitPoints: { current: 10, max: 12, temp: 1 },
      traits: { languages: ['Common'], weaponProficiencies: ['simple'] },
      details: { portrait: 'face.png' },
      currency: { gp: 5 }
    });
    assert.equal(created[0].name, 'Hero');
    assert.equal(created[0].system.abilities.str.value, 16);
    assert.equal(created[0].system.skills.ath.value, 1);
    assert.equal(created[0].system.skills.ste.bonus, 2);
    assert.equal(created[0].img, 'face.png');

    const updates = [];
    await Dnd5eActorAdapter.updateActor({
      update: async (patch) => updates.push(patch)
    }, { name: 'Hero', abilities: {}, skills: {}, traits: {} });
    assert.equal(updates.length, 1);
    assert.ok(actor);
  } finally { restoreFoundryMock(previous); }
});
