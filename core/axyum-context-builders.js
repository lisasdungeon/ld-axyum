/**
 * AxyumContextBuilders - mixin with data loading, normalization, and
 * view-model builder helpers consumed by AxyumApp._prepareContext.
 */
import { RulesEngine } from './rules-engine.js';
import CompendiumLoader from './compendium-loader.js';
import { logger } from './logger.js';
import { buildStartingPackages, resolveSelectedPackageItems } from './starting-equipment.js';
import {
  ALL_LANGUAGES, RACE_LANGUAGE_MAP, ARMOR_TYPES, CLASS_ARMOR_MAP,
  WEAPON_TYPES, CLASS_WEAPON_MAP, TOOL_TYPES, BACKGROUND_TOOL_MAP,
  SKILL_DEFINITIONS, CLASS_SKILL_MAP, ABILITY_DEFINITIONS
} from './axyum-static-data.js';
import { CLASS_CARD_IMAGES } from './class-card-images.js';

function normalizeSkillLabel(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getClassPortrait(className) {
  const key = String(className || '').trim().toLowerCase();
  const match = Object.keys(CLASS_CARD_IMAGES).find((name) => name.toLowerCase() === key);
  return match ? CLASS_CARD_IMAGES[match] : null;
}

export const AxyumContextBuilders = (Base) => class extends Base {

  // ===== DATA LOADING =====

  async _loadAvailableOptions() {
    try {
      let loader = game.ldAxyum?.compendiumLoader;
      if (!loader) {
        loader = new CompendiumLoader();
        if (game.ldAxyum) game.ldAxyum.compendiumLoader = loader;
      }

      await loader.loadAllContent();

      let classes = loader.cache.classes || [];
      let races = loader.cache.races || [];
      let backgrounds = loader.cache.backgrounds || [];
      let feats = loader.cache.feats || [];

      const empty = classes.length === 0 && races.length === 0 && backgrounds.length === 0;
      if (empty && (game.packs?.size || 0) > 0) {
        logger.warn('Compendium cache empty after load — forcing reload');
        await loader.clearCache();
        classes = loader.cache.classes || [];
        races = loader.cache.races || [];
        backgrounds = loader.cache.backgrounds || [];
        feats = loader.cache.feats || [];
      }

      const spells = loader.cache.spells || [];
      const equipment = loader.cache.equipment || [];

      this.constructor._cachedOptions = {
        classes: (classes || []).map(cls => this._normalizeClass(cls)).filter(Boolean),
        races: (races || []).map(race => this._normalizeRace(race)).filter(Boolean),
        backgrounds: (backgrounds || []).map(bg => this._normalizeBackground(bg)).filter(Boolean),
        feats: (feats || []).map(feat => this._normalizeFeat(feat)).filter(Boolean),
        spells: (spells || []).map(spell => this._normalizeSpell(spell)).filter(Boolean),
        equipment: (equipment || []).map(item => this._normalizeEquipment(item)).filter(Boolean),
        abilities: ABILITY_DEFINITIONS
      };

      this.availableOptions = this.constructor._cachedOptions;
      this.creator.availableOptions = this.availableOptions;

      logger.log('Available options ready', {
        classes: this.availableOptions.classes.length,
        races: this.availableOptions.races.length,
        backgrounds: this.availableOptions.backgrounds.length
      });
    } catch (err) {
      logger.error('Failed to load available options', err);
      ui.notifications?.error?.('Failed to load compendium content');
      this.constructor._cachedOptions = {
        classes: [], races: [], backgrounds: [], feats: [],
        spells: [], equipment: [], abilities: ABILITY_DEFINITIONS
      };
      this.availableOptions = this.constructor._cachedOptions;
    }
  }

  // ===== NORMALIZERS =====

  _normalizeClass(cls) {
    if (!cls) return null;
    const hitDie = cls.hitDice ? String(cls.hitDice).match(/\d+/)?.[0] || '8' : (cls.hitDie || '8');
    const saves = Array.isArray(cls.saves) ? cls.saves : [];
    return {
      ...cls,
      id: cls.id || '',
      name: cls.name || 'Unknown Class',
      packName: cls.packName || null,
      hitDie,
      hitDieLabel: `d${hitDie} hit die`,
      spellcasting: cls.spellcasting || null,
      spellcastingLabel: cls.spellcastingLabel || (cls.spellcasting ? 'Caster' : 'Martial'),
      saves,
      savesLabel: cls.savesLabel || (saves.length ? saves.join(', ') : '—'),
      primaryAbility: cls.primaryAbility || null,
      description: cls.description || '',
      startingEquipment: Array.isArray(cls.startingEquipment) ? cls.startingEquipment : [],
      icon: this.filter.getClassIcon(cls.name || 'Unknown'),
      portrait: getClassPortrait(cls.name)
    };
  }

  _normalizeRace(race) {
    if (!race) return null;
    const speed = race.speed ?? race.movement?.walk ?? 30;
    return {
      ...race,
      id: race.id || '',
      name: race.name || 'Unknown Race',
      packName: race.packName || null,
      sizeLabel: race.sizeLabel || 'Medium',
      speed,
      speedLabel: race.speedLabel || `${speed} ft`,
      darkvision: race.darkvision || null,
      traitsLabel: race.traitsLabel || null,
      description: race.description || ''
    };
  }

  _normalizeBackground(bg) {
    if (!bg) return null;
    const skillsLabel = bg.skillsLabel
      || (Array.isArray(bg.skills) && bg.skills.length ? bg.skills.join(', ') : null)
      || 'Skill grants vary';
    return {
      ...bg,
      id: bg.id || '',
      name: bg.name || 'Unknown Background',
      packName: bg.packName || null,
      skillsLabel,
      description: bg.description || ''
    };
  }

  _normalizeSpell(spell) {
    if (!spell) return null;
    return { ...spell, id: spell.id || '', name: spell.name || 'Unknown Spell', level: spell.level || 0 };
  }

  _normalizeEquipment(item) {
    if (!item) return null;
    return { ...item, id: item.id || '', name: item.name || 'Unknown Item', type: item.type || 'loot' };
  }

  _normalizeFeat(feat) {
    if (!feat) return null;
    return {
      ...feat,
      id: feat.id || '',
      name: feat.name || 'Unknown Feat',
      requiresLevel: feat.requiresLevel || null,
      blurb: feat.blurb || '',
      prerequisites: feat.prerequisites || []
    };
  }

  // ===== BUILDERS =====

  _buildSkillsList(skillChoices = null) {
    const choices = skillChoices || this._buildSkillChoices();
    const mods = RulesEngine.getAbilityModifiers(this.characterData?.abilities || {});
    const abilityMap = { STR: mods.str || 0, DEX: mods.dex || 0, CON: mods.con || 0, INT: mods.int || 0, WIS: mods.wis || 0, CHA: mods.cha || 0 };
    const selected = new Set(this.characterData.skillProficiencies || []);
    const pool = choices.class?.pool || [];
    const anyPool = !pool.length || pool.some((p) => normalizeSkillLabel(p) === 'any');
    const poolKeys = new Set(
      SKILL_DEFINITIONS
        .filter((s) => anyPool || pool.some((p) => normalizeSkillLabel(p) === normalizeSkillLabel(s.locKey) || normalizeSkillLabel(p) === normalizeSkillLabel(s.key)))
        .map((s) => s.key)
    );
    const max = choices.total || 0;
    const atCap = selected.size >= max;

    return SKILL_DEFINITIONS.map((skill) => {
      const isSelected = selected.has(skill.key);
      const inPool = poolKeys.has(skill.key);
      const selectable = inPool && (!atCap || isSelected);
      const mod = abilityMap[skill.ability] || 0;
      return {
        ...skill,
        label: skill.locKey.replace(/([a-z])([A-Z])/g, '$1 $2'),
        modifier: mod >= 0 ? `+${mod}` : `${mod}`,
        selected: isSelected,
        inPool,
        locked: false,
        selectable
      };
    });
  }

  _buildSkillChoices() {
    const className = this.characterData?.class?.name || '';
    const backgroundName = this.characterData?.background?.name || '';

    let classSkills = null;
    for (const [key, value] of Object.entries(CLASS_SKILL_MAP)) {
      if (className.toLowerCase().includes(key.toLowerCase())) {
        classSkills = { ...value, name: key };
        break;
      }
    }
    if (!classSkills) classSkills = { count: 2, pool: ['Any'], name: className || 'Class' };

    const backgroundSkills = backgroundName ? { count: 2, pool: [] } : null;
    const total = classSkills.count + (backgroundSkills?.count || 0);

    return {
      total,
      class: { name: className || classSkills.name, count: classSkills.count, pool: classSkills.pool },
      race: null,
      background: backgroundSkills ? { name: backgroundName, count: backgroundSkills.count, pool: backgroundSkills.pool } : null
    };
  }

  _getSpellKnownBudget(className, level) {
    const n = String(className || '').toLowerCase();
    const lvl = Math.max(1, level || 1);
    const known = {
      bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
      sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
      warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
      ranger: [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11]
    };
    if (known[n]) return known[n][Math.min(20, lvl) - 1] || 0;
    // Prepared casters: soft budget = level + casting mod (min 1)
    if (['cleric', 'druid', 'wizard', 'paladin', 'artificer'].includes(n)) {
      const ability = n === 'wizard' || n === 'artificer' ? 'int' : (n === 'paladin' ? 'cha' : 'wis');
      const score = this.characterData?.abilities?.[ability] ?? 10;
      const mod = Math.floor((score - 10) / 2);
      return Math.max(1, lvl + Math.max(0, mod));
    }
    return 0;
  }

  _buildSpellsByLevel(className = '', maxSpellLevel = 9, isSpellcaster = false) {
    let spells = this.availableOptions.spells || [];
    if (isSpellcaster && className) {
      const lower = className.toLowerCase();
      spells = spells.filter((spell) => {
        if ((spell.level || 0) > maxSpellLevel) return false;
        const list = spell.classes || [];
        if (!list.length) return true;
        return list.some((c) => String(c).toLowerCase().includes(lower));
      });
    }
    const grouped = [];
    for (const spell of spells) {
      const lvl = spell.level || 0;
      if (!grouped[lvl]) grouped[lvl] = [];
      grouped[lvl].push(spell);
    }
    for (let i = 0; i < grouped.length; i++) {
      if (grouped[i]) grouped[i].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      else grouped[i] = [];
    }
    return grouped;
  }

  _buildStartingEquipmentView() {
    const raw = this.characterData?.class?.startingEquipment
      || (this.availableOptions.classes || []).find((c) => c.id === this.characterData?.class?.id)?.startingEquipment
      || [];
    const built = buildStartingPackages(raw, this.availableOptions.equipment || []);
    const selectedId = this.characterData.startingPackageId;
    const choices = this.characterData.startingPackageChoices || {};
    const packages = (built.packages || []).map((pkg) => ({
      ...pkg,
      choices: (pkg.choices || []).map((choice) => ({
        ...choice,
        packageId: pkg.id,
        options: (choice.options || []).map((opt) => ({
          ...opt,
          packageId: pkg.id,
          choiceId: choice.id,
          isChosen: choices[choice.id] === opt.id
        }))
      }))
    }));
    const selectedPkg = packages.find((p) => p.id === selectedId) || null;
    const selectedItems = resolveSelectedPackageItems(selectedPkg, choices);
    return { ...built, packages, selectedItems };
  }

  _featSlotsAvailable() {
    return RulesEngine.countASIsByLevel(this.characterData.totalLevel || this.characterData.class?.level || 1);
  }

  _buildEquipmentList() {
    let equipment = [...(this.availableOptions.equipment || [])];

    const normalizeType = (t) => (String(t || '').toLowerCase().trim());
    const selectedFilter = normalizeType(this.currentEquipmentFilter);

    if (selectedFilter) {
      const filterMap = {
        weapon: ['weapon', 'weapons'],
        equipment: ['equipment', 'armor', 'armour'],
        tool: ['tool', 'tools'],
        gear: ['loot', 'consumable', 'backpack', 'container', 'gear']
      };
      const allowed = filterMap[selectedFilter] || [selectedFilter];
      equipment = equipment.filter(item => allowed.includes(normalizeType(item?.type)));
    }

    equipment = equipment.filter(item => !!item && !!item.name && !!item.type);
    return equipment.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
  }

  _buildFeatsList() {
    const characterLevel = this.characterData?.totalLevel || 1;
    return (this.availableOptions.feats || [])
      .filter(feat => feat && (!feat.requiresLevel || feat.requiresLevel <= characterLevel))
      .sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
  }

  _buildLanguageList() {
    const raceLanguages = this._getRaceLanguages();
    return ALL_LANGUAGES.map(lang => ({
      ...lang,
      granted: raceLanguages.includes(lang.id),
      source: raceLanguages.includes(lang.id) ? this.characterData.race.name : null
    }));
  }

  _getRaceLanguages() {
    const raceName = this.characterData.race.name?.toLowerCase() || '';
    return RACE_LANGUAGE_MAP[raceName] || ['common'];
  }

  _getLanguageGrants() {
    const raceName = this.characterData.race.name;
    const backgroundName = this.characterData.background.name;
    return {
      race: raceName ? { name: raceName, languages: this._getRaceLanguages().join(', ') } : null,
      background: backgroundName ? { name: backgroundName, count: 1 } : null
    };
  }

  _getTotalLanguageSlots() {
    return this._getRaceLanguages().length + (this.characterData.background.name ? 1 : 0);
  }

  _buildArmorProficiencies() {
    const className = this.characterData.class.name?.toLowerCase() || '';
    const grantedArmor = CLASS_ARMOR_MAP[className] || [];
    return ARMOR_TYPES.map(armor => ({
      ...armor,
      granted: grantedArmor.includes(armor.id),
      source: grantedArmor.includes(armor.id) ? this.characterData.class.name : null
    }));
  }

  _buildWeaponProficiencies() {
    const className = this.characterData.class.name?.toLowerCase() || '';
    const grantedWeapons = CLASS_WEAPON_MAP[className] || [];
    return WEAPON_TYPES.map(weapon => ({
      ...weapon,
      granted: grantedWeapons.includes(weapon.id),
      source: grantedWeapons.includes(weapon.id) ? this.characterData.class.name : null
    }));
  }

  _buildToolProficiencies() {
    const backgroundName = this.characterData.background.name?.toLowerCase() || '';
    const grantedTools = BACKGROUND_TOOL_MAP[backgroundName] || [];
    return TOOL_TYPES.map(tool => ({
      ...tool,
      granted: grantedTools.includes(tool.id),
      source: grantedTools.includes(tool.id) ? this.characterData.background.name : null
    }));
  }

  _getToolGrants() {
    const backgroundName = this.characterData.background.name;
    return { background: backgroundName ? { name: backgroundName } : null };
  }

  _getAbilityModifier(ability) {
    const score = this.characterData.abilities[ability] || 10;
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  // ===== POINT BUY =====

  _buildPointBuyView() {
    const rules = this.abilityManager.getPointBuyRules();
    const active = this.characterData.abilityMethod === 'pointbuy';
    const abilities = this.characterData.abilities || {};
    let spent = 0;
    const rows = ABILITY_DEFINITIONS.map((ability) => {
      const score = abilities[ability.key] ?? rules.minScore;
      spent += rules.costs[score] ?? 0;
      return {
        ...ability,
        score,
        canDecrease: score > rules.minScore,
        canIncrease: score < rules.maxScore
      };
    });
    const remaining = rules.pointsTotal - spent;
    for (const row of rows) {
      const nextCost = rules.costs[Math.min(rules.maxScore, row.score + 1)] ?? Infinity;
      const currentCost = rules.costs[row.score] ?? 0;
      if (row.canIncrease && (nextCost - currentCost) > remaining) row.canIncrease = false;
    }
    return { active, rows, pointsTotal: rules.pointsTotal, pointsSpent: spent, pointsRemaining: remaining };
  }

  // ===== DERIVED STATS =====

  _calculateHP() {
    const conMod = Math.floor((this.characterData.abilities.con - 10) / 2);
    const hitDie = parseInt(this.characterData.class.hitDie) || 8;
    const level = this.characterData.class.level || 1;
    const maxHP = hitDie + conMod + ((level - 1) * (Math.floor(hitDie / 2) + 1 + conMod));
    return Math.floor(Math.max(1, maxHP));
  }

  _calculateAC() {
    const dexMod = Math.floor((this.characterData.abilities.dex - 10) / 2);
    return 10 + dexMod;
  }

  _calculateProficiencyBonus() {
    const level = this.characterData.totalLevel || this.characterData.class.level || 1;
    return Math.floor((level - 1) / 4) + 2;
  }

  _calculateInitiative() {
    return Math.floor((this.characterData.abilities.dex - 10) / 2);
  }

  _calculatePassivePerception() {
    const wisMod = Math.floor((this.characterData.abilities.wis - 10) / 2);
    const profBonus = this._calculateProficiencyBonus();
    const isProficient = this.characterData.skillProficiencies?.includes('perception') || false;
    return 10 + wisMod + (isProficient ? profBonus : 0);
  }

  _getTotalLevel() {
    if (this.characterData?.isMulticlass && Array.isArray(this.characterData.classes) && this.characterData.classes.length > 0) {
      return this.characterData.classes.reduce((sum, c) => sum + (parseInt(c.level, 10) || 1), 0);
    }
    return parseInt(this.characterData?.class?.level, 10) || 1;
  }

  _calculatePassiveInsight() {
    const wisMod = Math.floor((this.characterData.abilities.wis - 10) / 2);
    const profBonus = this._calculateProficiencyBonus();
    const isProficient = this.characterData.skillProficiencies?.includes('insight') || false;
    return 10 + wisMod + (isProficient ? profBonus : 0);
  }

  _updateDerivedStats() {
    this.characterData.totalLevel = this._getTotalLevel();
    this.characterData.hitPoints = { max: this._calculateHP(), current: this._calculateHP(), temp: 0 };
    this.characterData.armorClass = this._calculateAC();
    this.characterData.proficiencyBonus = this._calculateProficiencyBonus();
    this.characterData.initiative = this._calculateInitiative();
    this.characterData.passivePerception = this._calculatePassivePerception();
    this.characterData.passiveInsight = this._calculatePassiveInsight();

    if (!this.characterData.speed) {
      this.characterData.speed = { walk: 30, swim: 0, fly: 0, burrow: 0, climb: 0 };
    }
    if (this.characterData.race.speed) {
      this.characterData.speed.walk = this.characterData.race.speed;
    }
  }
};
