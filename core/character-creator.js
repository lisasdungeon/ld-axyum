/**
 * CharacterCreator - Handles actor creation and updates for Axyum
 */
import { CharacterModel } from './character-model.js';
import { RulesEngine } from './rules-engine.js';
import { Dnd5eActorAdapter } from '../systems/dnd5e/adapter/dnd5e-actor-adapter.js';

export class CharacterCreator {
  constructor(availableOptions) {
    this.availableOptions = availableOptions || {};
  }

  async createCharacter(characterData) {
    try {
      // Debug: Log what we're creating
      console.log('LD Axyum | Creating character with data:', {
        name: characterData.name,
        class: characterData.class,
        race: characterData.race,
        background: characterData.background,
        abilities: characterData.abilities,
        availableOptions: {
          classes: this.availableOptions?.classes?.length || 0,
          races: this.availableOptions?.races?.length || 0,
          backgrounds: this.availableOptions?.backgrounds?.length || 0
        }
      });
      
      const validation = CharacterModel.validate(characterData);
      if (!validation.valid) {
        throw new Error(`Cannot create character: ${validation.errors.join(', ')}`);
      }

      Hooks.callAll('axyum.beforeCharacterCreate', characterData);

      // Sync wizard skill picks (skillProficiencies[]) into skills.*.proficient
      if (Array.isArray(characterData.skillProficiencies) && characterData.skillProficiencies.length) {
        if (!characterData.skills || typeof characterData.skills !== 'object') characterData.skills = {};
        for (const key of characterData.skillProficiencies) {
          const k = String(key);
          if (!characterData.skills[k]) characterData.skills[k] = { proficient: false, expertise: false };
          characterData.skills[k].proficient = true;
        }
      }

      // Create the actor with proper D&D 5e system data (classes/levels, skills, proficiencies)
      const actor = await Dnd5eActorAdapter.createActor(characterData);
      if (!actor) throw new Error('Actor.create returned null — check console for Foundry errors');
      console.log('LD Axyum | Actor created:', actor.id);

      // Create linked items (classes, race, background, spells, equipment)
      await this.createEmbeddedItems(actor, characterData);
      await this.applyProficienciesFromItems(actor);
      // Note: Don't manually call prepareData() - Foundry handles this automatically
      // and calling it manually can cause "Cannot redefine property" errors

      Hooks.callAll('axyum.characterCreated', actor, characterData);

      return actor;
    } catch (err) {
      console.error('LD Axyum | Character creation failed', err);
      throw err;
    }
  }

  async updateCharacter(actor, characterData) {
    try {
      if (!actor) {
        throw new Error('No actor to update');
      }

      const validation = CharacterModel.validate(characterData);
      if (!validation.valid) {
        throw new Error(`Cannot update character: ${validation.errors.join(', ')}`);
      }

      Hooks.callAll('axyum.beforeCharacterUpdate', actor, characterData);

      await Dnd5eActorAdapter.updateActor(actor, characterData);
      await this.createEmbeddedItems(actor, characterData);
      await this.applyProficienciesFromItems(actor);

      Hooks.callAll('axyum.characterUpdated', actor, characterData);

      return actor;
    } catch (err) {
      console.error('LD Axyum | Character update failed', err);
      throw err;
    }
  }

  /**
   * Convert Axyum ability format { str: 15 } to dnd5e format { str: { value: 15 } }
   */
  _formatAbilitiesForDnd5e(abilities) {
    const formatted = {};
    const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    for (const key of abilityKeys) {
      const score = abilities?.[key] ?? 10;
      formatted[key] = { value: score };
    }
    return formatted;
  }

  buildActorData(characterData) {
    const name = characterData.name || characterData.details?.name || 'New Character';
    const img = characterData.details?.portrait || 'icons/svg/mystery-man.svg';
    
    // Handle hitPoints as object or number
    let hp = 10;
    if (typeof characterData.hitPoints === 'object' && characterData.hitPoints?.max) {
      hp = Math.floor(characterData.hitPoints.max);
    } else if (typeof characterData.hitPoints === 'number') {
      hp = Math.floor(characterData.hitPoints);
    }
    hp = Math.max(1, hp); // Ensure at least 1 HP
    
    // Convert abilities to dnd5e format
    const abilities = this._formatAbilitiesForDnd5e(characterData.abilities);
    
    return {
      name: name,
      type: 'character',
      img: img,
      system: {
        abilities: abilities,
        attributes: {
          hp: {
            value: hp,
            max: hp
          }
        },
        details: {
          alignment: characterData.details?.alignment || '',
          appearance: characterData.details?.appearance || '',
          trait: characterData.details?.traits || '',
          ideal: characterData.details?.ideals || '',
          bond: characterData.details?.bonds || '',
          flaw: characterData.details?.flaws || '',
          eyes: characterData.details?.eyes || '',
          hair: characterData.details?.hair || '',
          skin: characterData.details?.skin || '',
          height: characterData.details?.height || '',
          weight: characterData.details?.weight || '',
          age: characterData.details?.age || '',
          gender: characterData.details?.gender || '',
          faith: characterData.details?.faith || '',
          biography: {
            value: characterData.biography?.backstory || characterData.details?.backstory || ''
          }
        },
        traits: {
          size: characterData.race?.size || 'med'
        }
      },
      prototypeToken: {
        name: name,
        texture: {
          src: characterData.details?.token || img
        }
      }
    };
  }

  buildActorUpdateData(characterData) {
    // Handle hitPoints as object or number
    let hp = 10;
    if (typeof characterData.hitPoints === 'object' && characterData.hitPoints?.max) {
      hp = Math.floor(characterData.hitPoints.max);
    } else if (typeof characterData.hitPoints === 'number') {
      hp = Math.floor(characterData.hitPoints);
    }
    hp = Math.max(1, hp);
    
    // Convert abilities to dnd5e format
    const abilities = this._formatAbilitiesForDnd5e(characterData.abilities);
    
    return {
      'system.abilities': abilities,
      'system.attributes.hp.value': hp,
      'system.attributes.hp.max': hp,
      'system.details.alignment': characterData.details?.alignment || '',
      'system.details.appearance': characterData.details?.appearance || '',
      'system.details.trait': characterData.details?.traits || '',
      'system.details.ideal': characterData.details?.ideals || '',
      'system.details.bond': characterData.details?.bonds || '',
      'system.details.flaw': characterData.details?.flaws || '',
      'system.details.eyes': characterData.details?.eyes || '',
      'system.details.hair': characterData.details?.hair || '',
      'system.details.skin': characterData.details?.skin || '',
      'system.details.height': characterData.details?.height || '',
      'system.details.weight': characterData.details?.weight || '',
      'system.details.age': characterData.details?.age || '',
      'system.details.gender': characterData.details?.gender || '',
      'system.details.faith': characterData.details?.faith || '',
      'system.details.biography.value': characterData.biography?.backstory || characterData.details?.backstory || '',
      'system.traits.size': characterData.race?.size || 'med'
    };
  }

  async createEmbeddedItems(actor, characterData) {
    const itemsToCreate = [];

    const findItemSource = (id, type, name) => {
      const typeMapping = {
        'class': 'classes',
        'race': 'races',
        'background': 'backgrounds',
        'equipment': 'equipment',
        'spell': 'spells',
        'feat': 'feats'
      };
      
      const optionKey = typeMapping[type];
      if (!optionKey || !this.availableOptions[optionKey]) {
        console.warn(`LD Axyum | No availableOptions for type: ${type} (key: ${optionKey})`);
        return null;
      }

      const items = this.availableOptions[optionKey];
      console.log(`LD Axyum | findItemSource: Looking for ${type} id=${id} name=${name} in ${items?.length || 0} items`);
      if (id) {
        const found = items.find(item => item.id === id);
        console.log(`LD Axyum | findItemSource: Found by id:`, found?.name || 'NOT FOUND');
        return found;
      } else if (name) {
        const found = items.find(item => item.name === name);
        console.log(`LD Axyum | findItemSource: Found by name:`, found?.name || 'NOT FOUND');
        return found;
      }
      return null;
    };

    const prepareItemData = async (sourceItem) => {
      if (!sourceItem) return null;

      try {
        let doc;
        if (sourceItem.packName === 'world') {
          doc = game.items.get(sourceItem.id);
        } else if (sourceItem.packName) {
          const pack = game.packs.get(sourceItem.packName);
          if (pack) {
            doc = await pack.getDocument(sourceItem.id);
          }
        }

        if (doc) {
          const data = doc.toObject();
          delete data._id;
          return data;
        }
      } catch (err) {
        console.warn(`LD Axyum | Failed to fetch item ${sourceItem.name}`, err);
      }
      return null;
    };

    console.log('LD Axyum | createEmbeddedItems - Starting item creation');
    console.log('LD Axyum | availableOptions status:', {
      classes: this.availableOptions?.classes?.length || 0,
      races: this.availableOptions?.races?.length || 0,
      backgrounds: this.availableOptions?.backgrounds?.length || 0
    });

    if (characterData.isMulticlass && characterData.classes?.length) {
      for (const cls of characterData.classes) {
        console.log('LD Axyum | Looking for multiclass:', cls);
        const source = findItemSource(cls.id, 'class', cls.name);
        const itemData = await prepareItemData(source);
        if (itemData) {
          if (itemData.system) itemData.system.levels = cls.level || 1;
          itemsToCreate.push(itemData);
          console.log('LD Axyum | Added class item:', itemData.name);
        }
      }
    } else if (characterData.class?.id) {
      console.log('LD Axyum | Looking for class:', characterData.class);
      const source = findItemSource(characterData.class.id, 'class', characterData.class.name);
      console.log('LD Axyum | Class source found:', source?.name || 'NOT FOUND');
      const itemData = await prepareItemData(source);
      if (itemData) {
        if (itemData.system) itemData.system.levels = characterData.class.level || 1;
        itemsToCreate.push(itemData);
        console.log('LD Axyum | Added class item:', itemData.name);
      } else {
        console.warn('LD Axyum | Failed to prepare class item data');
      }
    }

    if (characterData.race?.id) {
      console.log('LD Axyum | Looking for race:', characterData.race);
      const source = findItemSource(characterData.race.id, 'race', characterData.race.name);
      console.log('LD Axyum | Race source found:', source?.name || 'NOT FOUND');
      const itemData = await prepareItemData(source);
      if (itemData) {
        itemsToCreate.push(itemData);
        console.log('LD Axyum | Added race item:', itemData.name);
      } else {
        console.warn('LD Axyum | Failed to prepare race item data');
      }
    }

    if (characterData.background?.id) {
      console.log('LD Axyum | Looking for background:', characterData.background);
      const source = findItemSource(characterData.background.id, 'background', characterData.background.name);
      console.log('LD Axyum | Background source found:', source?.name || 'NOT FOUND');
      const itemData = await prepareItemData(source);
      if (itemData) {
        itemsToCreate.push(itemData);
        console.log('LD Axyum | Added background item:', itemData.name);
      } else {
        console.warn('LD Axyum | Failed to prepare background item data');
      }
    }

    if (characterData.selectedEquipmentIds?.length) {
      for (const id of characterData.selectedEquipmentIds) {
        const source = findItemSource(id, 'equipment');
        const itemData = await prepareItemData(source);
        if (itemData) itemsToCreate.push(itemData);
      }
    }

    const allSpells = [
      ...(characterData.selectedCantrips || []),
      ...(characterData.selectedSpells || [])
    ];
    for (const id of allSpells) {
      const source = findItemSource(id, 'spell');
      const itemData = await prepareItemData(source);
      if (itemData) itemsToCreate.push(itemData);
    }

    if (characterData.feats?.length) {
      for (const featName of characterData.feats) {
        const source = findItemSource(null, 'feat', featName);
        const itemData = await prepareItemData(source);
        if (itemData) itemsToCreate.push(itemData);
      }
    }

    if (itemsToCreate.length > 0) {
      try {
        const createdItems = await actor.createEmbeddedDocuments('Item', itemsToCreate);
        console.log('LD Axyum | Successfully created', createdItems.length, 'items');
      } catch (err) {
        console.error('LD Axyum | Failed to create embedded items:', err);
        throw err;
      }
    }
  }

  async applyProficienciesFromItems(actor) {
    const weaponProfs = new Set();
    const armorProfs = new Set();
    const languages = new Set();

    for (const item of actor.items) {
      if (item.type === 'class' || item.type === 'background' || item.type === 'race') {
        const itemProfs = item.system?.traits?.weaponProf?.value || item.system?.weaponProf?.value || [];
        const itemArmor = item.system?.traits?.armorProf?.value || item.system?.armorProf?.value || [];
        const itemLangs = item.system?.traits?.languages?.value || item.system?.languages?.value || [];

        itemProfs.forEach(p => weaponProfs.add(p));
        itemArmor.forEach(a => armorProfs.add(a));
        itemLangs.forEach(l => languages.add(l));
      }
    }

    await actor.update({
      'system.traits.weaponProf.value': Array.from(weaponProfs),
      'system.traits.armorProf.value': Array.from(armorProfs),
      'system.traits.languages.value': Array.from(languages)
    });

    console.log('LD Axyum | Applied proficiencies:', {
      weapons: Array.from(weaponProfs),
      armor: Array.from(armorProfs),
      languages: Array.from(languages)
    });
  }

  validateMulticlassSelection(characterData) {
    if (!characterData.isMulticlass || !characterData.classes) {
      return { valid: true, errors: [] };
    }

    const errors = [];

    const classIds = characterData.classes.map(c => c.id);
    if (new Set(classIds).size !== classIds.length) {
      errors.push('Cannot select the same class twice');
    }

    const totalLevel = characterData.classes.reduce((sum, c) => sum + (c.level || 1), 0);
    if (totalLevel > 20) {
      errors.push('Total class levels cannot exceed 20');
    }

    if (totalLevel < 1) {
      errors.push('Must have at least 1 total class level');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  buildClassList(characterData) {
    if (!characterData.classes || !Array.isArray(characterData.classes)) {
      return [];
    }

    return characterData.classes.map((cls, index) => ({
      index,
      id: cls.id,
      name: cls.name,
      level: cls.level || 1,
      subclass: cls.subclass || ''
    }));
  }

  buildMulticlassSpellPreview(characterData) {
    if (!characterData.isMulticlass || !characterData.classes) {
      return null;
    }

    const spellSlots = RulesEngine.calculateMulticlassSpellSlots(characterData.classes);
    
    if (!spellSlots || Object.keys(spellSlots).length === 0) {
      return null;
    }

    const preview = [];
    for (let level = 1; level <= 9; level++) {
      const slots = spellSlots[`level${level}`] || 0;
      if (slots > 0) {
        preview.push({
          level,
          slots,
          label: level === 1 ? '1st' : level === 2 ? '2nd' : level === 3 ? '3rd' : `${level}th`
        });
      }
    }

    return preview.length > 0 ? preview : null;
  }
}
