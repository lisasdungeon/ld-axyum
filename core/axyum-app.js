/**
 * AxyumApp - Main Application Coordinator for LD Axyum
 * Migrated to ApplicationV2 (Foundry v13+)
 */

import { CharacterModel } from './character-model.js';
import { RulesEngine } from './rules-engine.js';
import CompendiumLoader from './compendium-loader.js';
import { WizardNavigation } from './wizard-navigation.js';
import { AbilityScoreManager } from './ability-score-manager.js';
import { CompendiumFilter } from './compendium-filter.js';
import { CharacterCreator } from './character-creator.js';
import { RollTableManager } from './roll-table-manager.js';
import { AxyumContextBuilders } from './axyum-context-builders.js';
import { AxyumActionHandlers } from './axyum-action-handlers.js';
import { AxyumActionHandlersChoices } from './axyum-action-handlers-choices.js';
import { logger } from './logger.js';
import { ROLE_CARD_IMAGES } from './role-card-images.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class AxyumAppBase extends HandlebarsApplicationMixin(ApplicationV2) {
  static _cachedOptions = null;
  static _cachePromise = null;
  static _cachedModuleVersion = null;

  static invalidateContentCache() {
    AxyumAppBase._cachedOptions = null;
    AxyumAppBase._cachePromise = null;
    AxyumAppBase._cachedModuleVersion = null;
  }

  static _ensureCacheFresh() {
    const version = game.modules.get('ld-axyum')?.version || '';
    if (AxyumAppBase._cachedModuleVersion && AxyumAppBase._cachedModuleVersion !== version) {
      AxyumAppBase.invalidateContentCache();
      game.ldAxyum?.compendiumLoader?.clearCache?.();
    }
    AxyumAppBase._cachedModuleVersion = version;
  }

  static DEFAULT_OPTIONS = {
    id: 'axyum-app',
    tag: 'div',
    window: {
      title: 'Character Creator (Axyum)',
      icon: 'fa-solid fa-atom',
      resizable: true,
      minimizable: true,
      positioned: true
    },
    classes: ['ld-axyum-window'],
    position: { width: 1400, height: 900, top: 50, left: 50 },
    actions: {}
  };

  static PARTS = {
    form: { template: 'modules/ld-axyum/ui/axyum-app.hbs' }
  };

  constructor(options = {}) {
    super(options);
    this.mode = options.mode || 'create';
    this.actor = null;

    if (options.actor instanceof Actor) {
      this.actor = options.actor;
      this.mode = 'edit';
    }

    this.characterData = CharacterModel.getDefaults();
    this.availableOptions = { classes: [], races: [], backgrounds: [], spells: [], equipment: [], feats: [] };
    this.navigation = new WizardNavigation();
    this.abilityManager = new AbilityScoreManager();
    this.filter = new CompendiumFilter();
    this.creator = new CharacterCreator(this.availableOptions);
    this.rollTables = new RollTableManager();
    this.currentEquipmentFilter = '';
    this._contentLoading = !AxyumAppBase._cachedOptions;
  }

  /** Resolve data-action host even when Foundry passes an icon/child or null target. */
  _actionEl(event, target) {
    const raw = target || event?.currentTarget || event?.target || null;
    if (!raw || typeof raw.closest !== 'function') return null;
    if (raw.dataset?.action) return raw;
    return raw.closest('[data-action]') || null;
  }

  // ===== CONTEXT PREPARATION =====

  async _prepareContext(options) {
    AxyumAppBase._ensureCacheFresh();
    if (!AxyumAppBase._cachedOptions) {
      this._contentLoading = true;
      if (!AxyumAppBase._cachePromise) {
        AxyumAppBase._cachePromise = this._loadAvailableOptions();
      }
      try {
        await AxyumAppBase._cachePromise;
      } catch (err) {
        logger.error('Failed to load data:', err);
      } finally {
        this._contentLoading = false;
      }
    }

    if (AxyumAppBase._cachedOptions) {
      this.availableOptions = AxyumAppBase._cachedOptions;
      this.creator.availableOptions = AxyumAppBase._cachedOptions;
      this._contentLoading = false;
    }

    const filteredClasses = this.filter.applyAllFilters(this.availableOptions.classes || [], 'class');
    const filteredRaces = this.filter.applyAllFilters(this.availableOptions.races || [], 'race');
    const filteredBackgrounds = this.filter.applyAllFilters(this.availableOptions.backgrounds || [], 'background');
    this._updateDerivedStats();

    const asiCount = RulesEngine.countASIsByLevel(this.characterData.totalLevel || this.characterData.class.level || 1);

    const selectedClassName = this.characterData.class?.name || '';
    const selectedClassData = (this.availableOptions.classes || []).find(c => c.name === selectedClassName);
    const progression = typeof selectedClassData?.spellcasting === 'string' ? selectedClassData.spellcasting : null;
    const isSpellcaster = !!(progression && progression !== 'none') || RulesEngine.isSpellcaster(selectedClassName);

    const level = this.characterData.totalLevel || this.characterData.class?.level || 1;
    const slotInfo = RulesEngine.getSpellSlots(selectedClassName, level);
    const spellSlotArray = slotInfo?.slots || null;
    let maxSpellLevel = 0;
    if (spellSlotArray) {
      spellSlotArray.forEach((count, idx) => { if (count > 0) maxSpellLevel = idx + 1; });
    } else if (isSpellcaster) {
      maxSpellLevel = level >= 17 ? 5 : level >= 11 ? 4 : level >= 7 ? 3 : level >= 3 ? 2 : level >= 1 ? 1 : 0;
      if (String(selectedClassName).toLowerCase() === 'warlock' && level >= 1) {
        maxSpellLevel = Math.min(5, Math.max(1, Math.ceil(level / 2)));
      }
    }
    const cantripCount = RulesEngine.getCantripCount(selectedClassName, level);
    const spellKnownCount = this._getSpellKnownBudget(selectedClassName, level);
    const selectedCantrips = this.characterData.selectedCantrips || [];
    const selectedSpells = this.characterData.selectedSpells || [];
    const skillChoices = this._buildSkillChoices();
    const skillsList = this._buildSkillsList(skillChoices);
    const selectedSkillCount = (this.characterData.skillProficiencies || []).length;
    const armorProfs = this._buildArmorProficiencies();
    const weaponProfs = this._buildWeaponProficiencies();
    const toolProfs = this._buildToolProficiencies();
    const startingEquipment = this._buildStartingEquipmentView();
    const selectedPackageItems = startingEquipment.selectedItems || [];
    const featsList = this._buildFeatsList();
    const selectedFeatCount = (this.characterData.chooseASI ? 1 : 0) + (this.characterData.feats?.length || 0);
    const pointBuy = this._buildPointBuyView();

    const derivedStats = {
      hitPoints: this.characterData.hitPoints?.max || 0,
      armorClass: this.characterData.armorClass || 10,
      proficiencyBonus: this.characterData.proficiencyBonus || 2,
      initiative: this.characterData.initiative || 0,
      passivePerception: this.characterData.passivePerception || 10,
      passiveInsight: this.characterData.passiveInsight || 10,
      speed: this.characterData.speed?.walk || 30,
      isSpellcaster,
      cantripCount,
      spellKnownCount,
      maxSpellLevel,
      spellSlots: spellSlotArray,
      selectedCantripCount: selectedCantrips.length,
      selectedSpellCount: selectedSpells.length,
      abilityModifiers: {
        str: this._getAbilityModifier('str'),
        dex: this._getAbilityModifier('dex'),
        con: this._getAbilityModifier('con'),
        int: this._getAbilityModifier('int'),
        wis: this._getAbilityModifier('wis'),
        cha: this._getAbilityModifier('cha')
      }
    };

    return {
      character: this.characterData,
      characterData: this.characterData,
      derivedStats,
      asiCount,
      isLoading: !!this._contentLoading,
      contentLoaded: !!AxyumAppBase._cachedOptions,
      mode: this.mode,
      currentPage: this.navigation.getCurrentPage(),
      currentPageIndex: this.navigation.getCurrentPageIndex(),
      currentStepLabel: this.navigation.getPageLabel(this.navigation.getCurrentPage()),
      totalPages: this.navigation.getTotalPages(),
      progressPercent: Math.round(((this.navigation.getCurrentPageIndex() + 1) / Math.max(1, this.navigation.getTotalPages())) * 100),
      isFirstPage: this.navigation.isFirstPage(),
      isLastPage: this.navigation.isLastPage(),
      steps: this.navigation.getSteps(),
      version: game.modules.get('ld-axyum')?.version || '1.0.1',
      classes: filteredClasses,
      races: filteredRaces,
      backgrounds: filteredBackgrounds,
      spells: this.availableOptions.spells,
      spellsByLevel: this._buildSpellsByLevel(selectedClassName, maxSpellLevel, isSpellcaster),
      equipment: this._buildEquipmentList(),
      startingEquipment,
      selectedPackageItems,
      feats: featsList,
      featsList,
      selectedFeatCount,
      abilities: this.availableOptions.abilities,
      skillsList,
      skillChoices,
      selectedSkillCount,
      pointBuy,
      rolledScores: this.abilityManager.getRolledScores(),
      diceBreakdowns: this.abilityManager.getDiceBreakdowns(),
      rolledPool: this.abilityManager.getRolledPool(),
      assignedAbilities: this.abilityManager.getAssignedAbilities(),
      rerollStatus: this.abilityManager.getRerollStatus(),
      canReroll: this.abilityManager.canReroll(),
      showHomebrew: this.filter.getHomebrewVisibility(),
      selectedRoleIndex: this.filter.getSelectedRole(),
      roleImages: ROLE_CARD_IMAGES,
      equipmentFilter: this.currentEquipmentFilter,
      selectedEquipmentCount: this.characterData.selectedEquipmentIds?.length || 0,
      maxStartingItems: selectedPackageItems.length || 0,
      selectionPercent: 100,
      availableLanguages: this._buildLanguageList(),
      armorProficiencies: armorProfs,
      weaponProficiencies: weaponProfs,
      toolProficiencies: toolProfs,
      armorGrantCount: armorProfs.filter((a) => a.granted).length,
      weaponGrantCount: weaponProfs.filter((w) => w.granted).length,
      toolGrantCount: toolProfs.filter((t) => t.granted).length,
      languageGrants: this._getLanguageGrants(),
      toolGrants: this._getToolGrants(),
      selectedLanguageCount: this.characterData.proficiencies?.languages?.length || 0,
      totalLanguageSlots: this._getTotalLanguageSlots()
    };
  }

  // ===== LIFECYCLE =====

  async _preRender(context, options) {
    await super._preRender?.(context, options);
    const content = this.element?.querySelector('.axyum-content');
    if (content) this._savedScrollTop = content.scrollTop;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    requestAnimationFrame(() => {
      this._setupDragDrop();
      this._updateAbilitySummary();
      this._setupSpellCheckboxes();
      this._setupFormInputs();
      if (this._savedScrollTop !== undefined) {
        const content = this.element?.querySelector('.axyum-content');
        if (content) content.scrollTop = this._savedScrollTop;
      }
    });
  }

  _setupSpellCheckboxes() {
    const html = this.element;
    if (!html || html.dataset.axyumSpellsBound === 'true') return;
    html.dataset.axyumSpellsBound = 'true';

    html.addEventListener('change', (e) => {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
      if (input.name !== 'cantrips' && input.name !== 'spells') return;

      const key = input.name === 'cantrips' ? 'selectedCantrips' : 'selectedSpells';
      if (!Array.isArray(this.characterData[key])) this.characterData[key] = [];

      const id = input.value;
      const className = this.characterData.class?.name || '';
      const level = this.characterData.totalLevel || this.characterData.class?.level || 1;
      const maxCantrips = RulesEngine.getCantripCount(className, level);
      const maxSpells = this._getSpellKnownBudget(className, level);

      if (input.checked) {
        if (key === 'selectedCantrips' && maxCantrips > 0 && this.characterData[key].length >= maxCantrips) {
          input.checked = false;
          ui.notifications?.warn?.(`You can only select ${maxCantrips} cantrips.`);
          return;
        }
        if (key === 'selectedSpells' && maxSpells > 0 && this.characterData[key].length >= maxSpells) {
          input.checked = false;
          ui.notifications?.warn?.(`You can only select ${maxSpells} spells for this class/level.`);
          return;
        }
        if (!this.characterData[key].includes(id)) this.characterData[key].push(id);
      } else {
        this.characterData[key] = this.characterData[key].filter((x) => x !== id);
      }

      input.closest('.axyum-spell-card')?.classList.toggle('is-selected', input.checked);
      this.render();
    });
  }

  _setupFormInputs() {
    const html = this.element;
    if (!html) return;
    const inputs = html.querySelectorAll('input[type="text"], input[type="number"], select, textarea');
    inputs.forEach(input => {
      if (input.name === 'skillProficiencies') return;
      if (input.hasAttribute('data-action')) return;
      input.addEventListener('change', (e) => this._onFormInputChange(e));
      input.addEventListener('blur', (e) => this._onFormInputChange(e));
    });
  }

  _updateAbilitySummary() {
    const html = this.element;
    if (!html) return;
    const method = this.characterData?.abilityMethod;
    // Point Buy assigns every score by definition; roll/standard-array track explicit assignment.
    const values = method === 'pointbuy'
      ? Object.values(this.characterData?.abilities || {}).filter(v => typeof v === 'number')
      : Object.values(this.abilityManager?.assignedAbilities || {}).filter(v => typeof v === 'number');
    const total = values.reduce((sum, v) => sum + v, 0);
    const count = values.length;
    const totalEl = html.querySelector('#ability-total');
    const countEl = html.querySelector('#assigned-count');
    if (totalEl) totalEl.textContent = total > 0 ? total : '--';
    if (countEl) countEl.textContent = `${count} / 6`;
  }

  _setupDragDrop() {
    const html = this.element;
    if (!html) return;
    html.querySelectorAll('.draggable-score').forEach(el => {
      el.addEventListener('dragstart', this._onDragStart.bind(this));
      el.addEventListener('dragend', this._onDragEnd.bind(this));
    });
    html.querySelectorAll('.ability-drop-zone').forEach(zone => {
      zone.addEventListener('dragover', this._onDragOver.bind(this));
      zone.addEventListener('dragleave', this._onDragLeave.bind(this));
      zone.addEventListener('drop', this._onDrop.bind(this));
    });
  }

  setPosition(position = {}) {
    if (!this.element) return;
    const safePosition = {
      width: position?.width ?? this.options.position?.width ?? 1400,
      height: position?.height ?? this.options.position?.height ?? 900,
      top: position?.top ?? this.options.position?.top ?? 50,
      left: position?.left ?? this.options.position?.left ?? 50
    };
    try {
      return super.setPosition?.(safePosition);
    } catch (err) {
      console.warn('AxyumApp | Position update failed:', err.message);
    }
  }

  _updatePosition(position) {
    const element = this.element;
    if (!element) return;
    if (!position || typeof position !== 'object') return;
    try {
      return super._updatePosition?.(position);
    } catch (err) {
      console.warn('AxyumApp | Position update skipped:', err.message);
    }
  }

  async _onClose(options) {
    this.characterData = null;
    this.availableOptions = null;
    this.navigation = null;
    this.abilityManager = null;
    this.filter = null;
    this.creator = null;
    this.rollTables = null;
    return super._onClose?.(options);
  }
}

// Compose mixins: context builders + both action handler halves
export const AxyumApp = AxyumActionHandlersChoices(AxyumActionHandlers(AxyumContextBuilders(AxyumAppBase)));

AxyumApp.DEFAULT_OPTIONS.actions = {
  next: AxyumApp.prototype.onNext,
  previous: AxyumApp.prototype.onPrevious,
  create: AxyumApp.prototype.onCreate,
  save: AxyumApp.prototype.onSave,
  selectClass: AxyumApp.prototype.onSelectClass,
  selectRace: AxyumApp.prototype.onSelectRace,
  selectBackground: AxyumApp.prototype.onSelectBackground,
  rollAbility: AxyumApp.prototype.onRollAbility,
  rollAllAbilities: AxyumApp.prototype.onRollAllAbilities,
  assignScore: AxyumApp.prototype.onAssignScore,
  unassignScore: AxyumApp.prototype.onUnassignScore,
  useStandardArray: AxyumApp.prototype.onUseStandardArray,
  usePointBuy: AxyumApp.prototype.onUsePointBuy,
  increaseAbilityScore: AxyumApp.prototype.onIncreaseAbilityScore,
  decreaseAbilityScore: AxyumApp.prototype.onDecreaseAbilityScore,
  resetAbilities: AxyumApp.prototype.onResetAbilities,
  assignScoreClick: AxyumApp.prototype.onAssignScoreClick,
  rollTrait: AxyumApp.prototype.onRollTrait,
  filterCompendium: AxyumApp.prototype.onFilterCompendium,
  toggleHomebrew: AxyumApp.prototype.onToggleHomebrew,
  selectRole: AxyumApp.prototype.onSelectRole,
  configureCompendia: AxyumApp.prototype.onConfigureCompendia,
  filterEquipment: AxyumApp.prototype.onFilterEquipment,
  toggleEquipment: AxyumApp.prototype.onToggleEquipment,
  selectStartingPackage: AxyumApp.prototype.onSelectStartingPackage,
  selectPackageChoice: AxyumApp.prototype.onSelectPackageChoice,
  toggleLanguage: AxyumApp.prototype.onToggleLanguage,
  toggleArmorProf: AxyumApp.prototype.onToggleArmorProf,
  toggleWeaponProf: AxyumApp.prototype.onToggleWeaponProf,
  toggleToolProf: AxyumApp.prototype.onToggleToolProf,
  toggleSkill: AxyumApp.prototype.onToggleSkill,
  toggleFeat: AxyumApp.prototype.onToggleFeat,
  toggleASI: AxyumApp.prototype.onToggleASI
};
