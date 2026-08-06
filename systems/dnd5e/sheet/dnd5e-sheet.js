/**
 * D&D 5e Character Sheet - LD Axyum Theme
 * Registered Foundry actor sheet. Reads dnd5e's own computed derived data
 * (abilities/skills/AC/initiative/etc.) instead of recalculating it, so
 * values stay correct for armor, feats, and other bonuses dnd5e applies.
 *
 * Layout is a free-form, per-actor-saved canvas (see sheet-layout-manager.js
 * and dnd5e-sheet-layout-actions.js) — every section is a widget the player
 * can drag, resize, recolor, and assign to any page while "Edit Layout" is on.
 */
import { normalizeLayout, computeCanvasSize } from './sheet-layout-manager.js';
import { Dnd5eSheetLayoutActions } from './dnd5e-sheet-layout-actions.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const SKILL_ABILITY_FALLBACK = {
  acr: 'dex', ani: 'wis', arc: 'int', ath: 'str', dec: 'cha',
  his: 'int', ins: 'wis', itm: 'cha', inv: 'int', med: 'wis',
  nat: 'int', prc: 'wis', prf: 'cha', per: 'cha', rel: 'int',
  slt: 'dex', ste: 'dex', sur: 'wis'
};

class Dnd5eCharacterSheetBase extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    id: 'ld-axyum-dnd5e-sheet-{id}',
    tag: 'div',
    window: {
      title: 'Character Sheet (LD Axyum)',
      icon: 'fa-solid fa-user',
      resizable: true,
      minimizable: true
    },
    classes: ['ld-axyum-sheet', 'dnd5e-sheet'],
    position: { width: 1000, height: 750 },
    actions: {}
  };

  static PARTS = {
    main: { template: 'modules/ld-axyum/systems/dnd5e/sheet/dnd5e-sheet.hbs' }
  };

  constructor(options = {}) {
    super(options);
    this.editMode = false;
    this.currentPageId = null;
  }

  // ActorSheetV2 is constructed with {document: actor}; `this.actor` is provided as an alias.

  async _prepareContext(options) {
    const spellcasting = this._prepareSpells();
    const layout = normalizeLayout(this.actor.getFlag('ld-axyum', 'sheetLayout'), spellcasting.caster);
    if (!this.currentPageId || !layout.pages.some((p) => p.id === this.currentPageId)) {
      this.currentPageId = layout.pages[0].id;
    }

    const widgets = layout.widgets
      .filter((w) => w.page === this.currentPageId)
      .map((w) => ({ ...w, colorStyle: `--widget-color: ${w.color};` }));

    return {
      actor: this.actor,
      system: this.actor.system,
      abilities: this._prepareAbilities(),
      skills: this._prepareSkills(),
      combat: this._prepareCombat(),
      spellcasting,
      equipment: this._prepareEquipment(),
      features: this._prepareFeatures(),
      biography: this._prepareBiography(),
      editMode: this.editMode,
      pages: layout.pages.map((p) => ({ ...p, active: p.id === this.currentPageId })),
      currentPageId: this.currentPageId,
      widgets,
      canvasSize: computeCanvasSize(layout, this.currentPageId)
    };
  }

  // ===== CONTEXT BUILDERS (read dnd5e's own derived data) =====

  _prepareAbilities() {
    const abilities = {};
    const names = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
    const sys = this.actor.system;
    for (const [key, name] of Object.entries(names)) {
      const a = sys.abilities?.[key] || {};
      const mod = a.mod ?? Math.floor(((a.value ?? 10) - 10) / 2);
      const save = a.save?.value ?? mod;
      abilities[key] = {
        name,
        score: a.value ?? 10,
        modifier: mod >= 0 ? `+${mod}` : `${mod}`,
        savingThrow: save >= 0 ? `+${save}` : `${save}`,
        saveProficient: !!a.saveProf?.hasProficiency
      };
    }
    return abilities;
  }

  _prepareSkills() {
    const sys = this.actor.system;
    const skills = [];
    for (const [key, skill] of Object.entries(sys.skills || {})) {
      const config = CONFIG.DND5E?.skills?.[key];
      const label = config?.label ? game.i18n.localize(config.label) : key;
      const total = skill.total ?? 0;
      skills.push({
        key,
        name: label,
        ability: (skill.ability || SKILL_ABILITY_FALLBACK[key] || '').toUpperCase(),
        proficient: (skill.value ?? 0) > 0,
        expertise: (skill.value ?? 0) > 1,
        modifier: total >= 0 ? `+${total}` : `${total}`
      });
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
  }

  _prepareCombat() {
    const sys = this.actor.system;
    const init = sys.attributes?.init?.total ?? sys.attributes?.init?.mod ?? 0;
    const hd = sys.attributes?.hd || {};
    return {
      hitPoints: {
        current: sys.attributes?.hp?.value ?? 0,
        max: sys.attributes?.hp?.max ?? 0,
        temp: sys.attributes?.hp?.temp ?? 0
      },
      armorClass: sys.attributes?.ac?.value ?? 10,
      initiative: init >= 0 ? `+${init}` : `${init}`,
      speed: sys.attributes?.movement?.walk ?? 30,
      hitDice: `${hd.value ?? 0} / ${hd.max ?? 0}`,
      proficiencyBonus: sys.attributes?.prof ?? 2
    };
  }

  _prepareSpells() {
    const sys = this.actor.system;
    const slots = [];
    for (let lvl = 1; lvl <= 9; lvl++) {
      const s = sys.spells?.[`spell${lvl}`];
      if (s?.max > 0) slots.push({ level: lvl, value: s.value ?? 0, max: s.max });
    }
    const pact = sys.spells?.pact;
    if (pact?.max > 0) slots.push({ level: `${pact.level ? pact.level + ' ' : ''}Pact`, value: pact.value ?? 0, max: pact.max });

    const spells = this.actor.items
      .filter((i) => i.type === 'spell')
      .map((i) => ({
        id: i.id,
        name: i.name,
        level: i.system?.level || 0,
        prepared: !!i.system?.preparation?.prepared
      }))
      .sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

    return { caster: spells.length > 0 || slots.length > 0, slots, spells };
  }

  _prepareEquipment() {
    return this.actor.items
      .filter((item) => ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container'].includes(item.type))
      .map((item) => ({
        name: item.name,
        type: item.type,
        quantity: item.system?.quantity || 1,
        equipped: item.system?.equipped || false
      }));
  }

  _prepareFeatures() {
    const sys = this.actor.system;
    const raceItem = this.actor.items.find((i) => i.type === 'race' || i.type === 'species');
    const bgItem = this.actor.items.find((i) => i.type === 'background');
    const classItems = this.actor.items.filter((i) => i.type === 'class');
    return {
      race: raceItem?.name || sys.details?.race?.name || sys.details?.race || '',
      background: bgItem?.name || sys.details?.background?.name || sys.details?.background || '',
      classes: classItems.map((cls) => ({ name: cls.name, level: cls.system?.levels ?? cls.system?.level ?? 1 }))
    };
  }

  _prepareBiography() {
    const sys = this.actor.system;
    return {
      personality: sys.details?.trait || '',
      backstory: sys.details?.biography?.value || ''
    };
  }

  // ===== BASIC ROLL / EDIT HANDLERS =====

  async onEditAbility(event, target) {
    const ability = target.dataset.ability;
    const current = this.actor.system.abilities?.[ability]?.value ?? 10;
    const value = await this._promptNumber('Edit Ability Score', current, 3, 30);
    if (value !== null && value !== current) {
      await this.actor.update({ [`system.abilities.${ability}.value`]: value });
    }
  }

  async onRollAbility(event, target) {
    await this.actor.rollAbilityCheck({ ability: target.dataset.ability });
  }

  async onRollSkill(event, target) {
    await this.actor.rollSkill({ skill: target.dataset.skill });
  }

  async onRollSavingThrow(event, target) {
    await this.actor.rollSavingThrow({ ability: target.dataset.ability });
  }

  async onToggleProficiency(event, target) {
    const type = target.dataset.type;
    const key = target.dataset.key;

    if (type === 'skill') {
      const current = this.actor.system.skills?.[key]?.value ?? 0;
      await this.actor.update({ [`system.skills.${key}.value`]: current > 0 ? 0 : 1 });
    } else if (type === 'save') {
      const proficient = this.actor.system.abilities?.[key]?.proficient;
      await this.actor.update({ [`system.abilities.${key}.proficient`]: proficient ? 0 : 1 });
    } else if (type === 'spellPrepared') {
      const item = this.actor.items.get(key);
      if (item) {
        const prepared = !!item.system?.preparation?.prepared;
        await item.update({ 'system.preparation.prepared': !prepared });
      }
    }
  }

  async onEditHitPoints(event, target) {
    const type = target.dataset.type;
    const current = this.actor.system.attributes?.hp?.[type] ?? 0;
    const value = await this._promptNumber(`Edit ${type.charAt(0).toUpperCase()}${type.slice(1)} HP`, current, 0, 999);
    if (value !== null) {
      await this.actor.update({ [`system.attributes.hp.${type}`]: value });
    }
  }

  async onRollHitDie(event, target) {
    await this.actor.rollHitDie();
  }

  async onShowArtwork() {
    new foundry.applications.apps.ImagePopout({ src: this.actor.img, uuid: this.actor.uuid }).render(true);
  }

  // ===== UTILITY =====

  async _promptNumber(title, defaultValue, min = 0, max = 999) {
    return foundry.applications.api.DialogV2.prompt({
      window: { title },
      content: `<div style="margin:0.5rem 0;"><input type="number" id="ld-axyum-number-input" value="${defaultValue}" min="${min}" max="${max}" style="width:100%;padding:0.5rem;"></div>`,
      ok: {
        label: 'OK',
        callback: (event, button) => {
          const value = parseInt(button.form.elements['ld-axyum-number-input']?.value ?? '', 10);
          return isNaN(value) ? null : Math.clamp(value, min, max);
        }
      },
      rejectClose: false
    });
  }
}

const Dnd5eCharacterSheet = Dnd5eSheetLayoutActions(Dnd5eCharacterSheetBase);

Dnd5eCharacterSheet.DEFAULT_OPTIONS.actions = {
  editAbility: Dnd5eCharacterSheet.prototype.onEditAbility,
  rollAbility: Dnd5eCharacterSheet.prototype.onRollAbility,
  rollSkill: Dnd5eCharacterSheet.prototype.onRollSkill,
  rollSavingThrow: Dnd5eCharacterSheet.prototype.onRollSavingThrow,
  toggleProficiency: Dnd5eCharacterSheet.prototype.onToggleProficiency,
  editHitPoints: Dnd5eCharacterSheet.prototype.onEditHitPoints,
  rollHitDie: Dnd5eCharacterSheet.prototype.onRollHitDie,
  showArtwork: Dnd5eCharacterSheet.prototype.onShowArtwork,
  toggleEditMode: Dnd5eCharacterSheet.prototype.onToggleEditMode,
  switchPage: Dnd5eCharacterSheet.prototype.onSwitchPage,
  addPage: Dnd5eCharacterSheet.prototype.onAddPage,
  renamePage: Dnd5eCharacterSheet.prototype.onRenamePage,
  deletePage: Dnd5eCharacterSheet.prototype.onDeletePage,
  resetLayout: Dnd5eCharacterSheet.prototype.onResetLayout,
  setWidgetColor: Dnd5eCharacterSheet.prototype.onSetWidgetColor,
  movePageMenu: Dnd5eCharacterSheet.prototype.onMovePageMenu
};

export { Dnd5eCharacterSheet };
