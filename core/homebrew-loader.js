/**
 * Homebrew content loader for LD Axyum
 * @module homebrew-loader
 */

export class HomebrewLoader {
  /**
   * Detect homebrew/custom content packs
   * Returns array of non-dnd5e system packs
   */
  static detectHomebrewPacks() {
    try {
      if (!game?.packs) return [];

      const homebrewPacks = [];
      const systemPacks = ['dnd5e'];

      for (const pack of game.packs.values()) {
        // Skip system packs
        if (systemPacks.some(sys => pack.collection.includes(sys))) {
          continue;
        }

        // Skip empty packs
        if (!pack.index || pack.index.length === 0) {
          continue;
        }

        homebrewPacks.push({
          name: pack.collection,
          label: pack.metadata?.label || pack.collection,
          type: pack.metadata?.type || 'Unknown',
          hasContent: pack.index.length > 0
        });
      }

      return homebrewPacks;
    } catch (err) {
      console.error('HomebrewLoader | Failed to detect homebrew packs', err);
      return [];
    }
  }

  /**
   * Extract source from pack name
   */
  static extractModuleSource(packCollection) {
    if (!packCollection) return 'Unknown';

    // Prefer module id segment before the first '.' (Foundry pack collection form)
    const moduleName = String(packCollection).split('.')[0] || String(packCollection);
    return moduleName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Load homebrew content from all detected packs
   */
  async loadHomebrewContent() {
    try {
      const homebrewPacks = HomebrewLoader.detectHomebrewPacks();
      
      if (homebrewPacks.length === 0) {
        return { 
          classes: [], 
          races: [], 
          spells: [], 
          feats: [], 
          equipment: [],
          detected: false,
          packs: []
        };
      }

      // Load homebrew content from all detected packs
      const homebrewContent = {
        classes: [],
        races: [],
        spells: [],
        feats: [],
        equipment: []
      };

      for (const homebrewPack of homebrewPacks) {
        const content = await this.loadHomebrewFromPack(homebrewPack.name);
        homebrewContent.classes.push(...content.classes);
        homebrewContent.races.push(...content.races);
        homebrewContent.spells.push(...content.spells);
        homebrewContent.feats.push(...content.feats);
        homebrewContent.equipment.push(...content.equipment);
      }

      return {
        ...homebrewContent,
        detected: true,
        packs: homebrewPacks
      };
    } catch (err) {
      console.error('HomebrewLoader | Failed to load homebrew content', err);
      return { 
        classes: [], 
        races: [], 
        spells: [], 
        feats: [], 
        equipment: [],
        detected: false,
        packs: []
      };
    }
  }

  /**
   * Load homebrew content from a specific pack
   */
  async loadHomebrewFromPack(packName) {
    const content = {
      classes: [],
      races: [],
      spells: [],
      feats: [],
      equipment: []
    };

    try {
      const pack = game?.packs?.get?.(packName);
      if (!pack) return content;

      const index = await pack.getIndex({
        fields: [
          'type', 'system.hitDice', 'system.hp', 'system.spellcasting',
          'system.level', 'system.school', 'system.requirements',
          'system.advancement', 'system.traits', 'system.movement',
          'system.type', 'system.rarity', 'system.weight', 'system.price'
        ]
      });
      const source = HomebrewLoader.extractModuleSource(packName);

      for (const entry of index) {
        const item = {
          id: entry._id,
          packName: packName,
          name: entry.name,
          type: entry.type === 'species' ? 'race' : entry.type,
          source: source,
          isHomebrew: true
        };

        switch (entry.type) {
          case 'class':
            content.classes.push({
              ...item,
              hitDice: entry.system?.hitDice || entry.system?.hp?.denomination || 'd8',
              spellcasting: entry.system?.spellcasting?.progression || null
            });
            break;

          case 'species':
          case 'race':
            content.races.push({
              ...item,
              abilityBoosts: entry.system?.advancement || entry.system?.ability || null
            });
            break;

          case 'spell':
            content.spells.push({
              ...item,
              level: entry.system?.level || 0,
              school: entry.system?.school || '',
              classes: entry.system?.classes || []
            });
            break;

          case 'feat':
            content.feats.push({
              ...item,
              prerequisites: entry.system?.prerequisites || [],
              requiresAbility: entry.system?.ability || null,
              requiresLevel: entry.system?.level || 1
            });
            break;

          case 'equipment':
          case 'weapon':
          case 'loot':
            content.equipment.push({
              ...item,
              price: entry.system?.price?.value || 0,
              weight: entry.system?.weight?.value || 0,
              rarity: entry.system?.rarity || 'common'
            });
            break;
        }
      }

      return content;
    } catch (err) {
      console.warn(`HomebrewLoader | Failed to load homebrew from ${packName}`, err);
      return content;
    }
  }

  /**
   * Validate homebrew content
   */
  validateHomebrewContent(content) {
    const errors = [];

    // Validate classes
    if (content.classes && Array.isArray(content.classes)) {
      for (const cls of content.classes) {
        if (!cls.name) errors.push('Class missing name');
        if (!cls.hitDice) errors.push(`Class ${cls.name} missing hitDice`);
      }
    }

    // Validate races
    if (content.races && Array.isArray(content.races)) {
      for (const race of content.races) {
        if (!race.name) errors.push('Race missing name');
      }
    }

    // Validate spells
    if (content.spells && Array.isArray(content.spells)) {
      for (const spell of content.spells) {
        if (!spell.name) errors.push('Spell missing name');
        if (spell.level === undefined) errors.push(`Spell ${spell.name} missing level`);
      }
    }

    // Validate feats
    if (content.feats && Array.isArray(content.feats)) {
      for (const feat of content.feats) {
        if (!feat.name) errors.push('Feat missing name');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Merge homebrew content with official content
   */
  mergeHomebrewContent(official, homebrew) {
    try {
      return {
        classes: this._mergeAndDedup(official.classes, homebrew.classes, 'name', true),
        races: this._mergeAndDedup(official.races, homebrew.races, 'name', true),
        spells: this._mergeAndDedup(official.spells, homebrew.spells, 'name', true),
        feats: this._mergeAndDedup(official.feats, homebrew.feats, 'name', true),
        equipment: this._mergeAndDedup(official.equipment, homebrew.equipment, 'name', true)
      };
    } catch (err) {
      console.error('HomebrewLoader | Failed to merge homebrew content', err);
      return official;
    }
  }

  /**
   * Merge two arrays and deduplicate by key
   * Official items come first, then homebrew
   */
  _mergeAndDedup(officialItems, homebrewItems, dedupeKey, sortBySource = false) {
    const items = [...(officialItems || [])];
    const seen = new Set(items.map(item => item[dedupeKey]));

    // Add homebrew items not already in official content
    for (const item of (homebrewItems || [])) {
      if (!seen.has(item[dedupeKey])) {
        items.push(item);
        seen.add(item[dedupeKey]);
      }
    }

    // Sort: official first, then homebrew, then by name
    if (sortBySource) {
      items.sort((a, b) => {
        if (a.isHomebrew !== b.isHomebrew) {
          return a.isHomebrew ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });
    } else {
      items.sort((a, b) => a.name.localeCompare(b.name));
    }

    return items;
  }
}
