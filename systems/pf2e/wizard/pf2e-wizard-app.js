/**
 * Pf2eWizardApp - PF2e character creation wizard.
 * Self-contained ApplicationV2 class: does not reuse core/axyum-app.js
 * (that shell hardcodes the dnd5e page list) and does not touch axyum.mjs
 * (loads its own Handlebars partials on first render instead).
 */
import { Pf2eCharacterModel } from '../data/pf2e-character-model.js';
import { Pf2eCompendiumLoader } from '../data/pf2e-compendium-loader.js';
import { Pf2eWizardNavigation } from './pf2e-wizard-navigation.js';
import { Pf2eWizardContextBuilders } from './pf2e-wizard-context-builders.js';
import { Pf2eWizardActionHandlers } from './pf2e-wizard-action-handlers.js';
import { MODULE_ID } from '../../../core/multipath.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PAGE_PARTIALS = [
  'welcome', 'ancestry', 'heritage', 'background', 'class', 'key-ability',
  'ability-boosts', 'skills', 'feats', 'spells', 'equipment', 'details', 'summary'
];

let _partialsLoaded = false;

class Pf2eWizardAppBase extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'pf2e-wizard-app',
    tag: 'div',
    window: {
      title: 'Character Creator (Pathfinder 2e)',
      icon: 'fa-solid fa-dragon',
      resizable: true,
      minimizable: true,
      positioned: true
    },
    classes: ['ld-axyum-window', 'pf2e-wizard'],
    position: { width: 1400, height: 900, top: 50, left: 50 },
    actions: {}
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/systems/pf2e/wizard/templates/pf2e-wizard-app.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this.mode = options.mode || 'create';
    this.actor = null;
    if (options.actor instanceof Actor) {
      this.actor = options.actor;
      this.mode = 'edit';
    }

    this.characterData = Pf2eCharacterModel.getDefaults();
    this.navigation = new Pf2eWizardNavigation();
    this.compendium = new Pf2eCompendiumLoader();
    this.queries = null;
  }

  _actionEl(event, target) {
    const raw = target || event?.currentTarget || event?.target || null;
    if (!raw || typeof raw.closest !== 'function') return null;
    if (raw.dataset?.action) return raw;
    return raw.closest('[data-action]') || null;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    requestAnimationFrame(() => this._setupFormInputs());
  }

  _setupFormInputs() {
    const html = this.element;
    if (!html) return;
    const inputs = html.querySelectorAll('input[type="text"], input[type="number"], select, textarea');
    inputs.forEach((input) => {
      if (input.hasAttribute('data-action')) return;
      input.addEventListener('change', (e) => this._onFormInputChange(e));
      input.addEventListener('blur', (e) => this._onFormInputChange(e));
    });
  }

  /** Writes a dotted `name="a.b.c"` input into this.characterData. */
  _onFormInputChange(event) {
    const input = event.target;
    const name = input.name;
    if (!name) return;

    const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
    const parts = name.split('.').filter(Boolean);
    if (!parts.length || parts.some((p) => forbidden.has(p))) return;

    let target = this.characterData;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (typeof target[key] !== 'object' || target[key] === null) target[key] = {};
      target = target[key];
    }

    const finalKey = parts[parts.length - 1];
    target[finalKey] = input.type === 'number' ? (parseInt(input.value, 10) || 0) : input.value;

    if (this._renderDebounceTimer) clearTimeout(this._renderDebounceTimer);
    this._renderDebounceTimer = setTimeout(() => this.render(), 100);
  }

  async _preFirstRender(context, options) {
    await super._preFirstRender?.(context, options);
    if (_partialsLoaded) return;
    _partialsLoaded = true;

    const fetches = PAGE_PARTIALS.map(async (page) => {
      const path = `modules/${MODULE_ID}/systems/pf2e/wizard/pages/${page}.hbs`;
      try {
        const response = await fetch(path);
        if (!response.ok) return null;
        const text = await response.text();
        return { path, text };
      } catch (err) {
        console.warn(`Pf2eWizardApp | Failed to load page template: ${path}`, err);
        return null;
      }
    });

    const previewPath = `modules/${MODULE_ID}/systems/pf2e/wizard/templates/pf2e-preview.hbs`;
    fetches.push(fetch(previewPath).then((r) => r.ok ? r.text().then((text) => ({ path: previewPath, text })) : null).catch(() => null));

    const results = await Promise.all(fetches);
    for (const result of results) {
      if (!result) continue;
      const partialName = result.path.replace(/\.hbs$/, '');
      Handlebars.registerPartial(partialName, result.text);
    }
  }

  async _prepareContext(options) {
    if (!this.queries) {
      await this._loadAvailableOptions();
    }

    const derivedStats = this._buildDerivedStats();

    return {
      character: this.characterData,
      characterData: this.characterData,
      derivedStats,
      skillsList: this._buildSkillsList(),
      featSections: this._buildFeatSections(),
      isSpellcaster: this._isSpellcaster(),
      spellPreview: this._buildSpellPreview(),
      spellsByRank: this._buildSpellsByRank(),
      ancestries: this.queries?.getAncestries() || [],
      heritages: this.queries?.getHeritagesForAncestry(this.characterData.ancestry?.id) || [],
      backgrounds: this.queries?.getBackgrounds() || [],
      classes: this.queries?.getClasses() || [],
      equipment: this.queries?.getEquipment() || [],
      pf2eRanks: ['untrained', 'trained', 'expert', 'master', 'legendary'],
      mode: this.mode,
      currentPage: this.navigation.getCurrentPage(),
      currentPageIndex: this.navigation.getCurrentPageIndex(),
      currentStepLabel: this.navigation.getPageLabel(this.navigation.getCurrentPage()),
      totalPages: this.navigation.getTotalPages(),
      progressPercent: Math.round(((this.navigation.getCurrentPageIndex() + 1) / Math.max(1, this.navigation.getTotalPages())) * 100),
      isFirstPage: this.navigation.isFirstPage(),
      isLastPage: this.navigation.isLastPage(),
      steps: this.navigation.getSteps(),
      version: game.modules.get(MODULE_ID)?.version || ''
    };
  }
}

export const Pf2eWizardApp = Pf2eWizardActionHandlers(Pf2eWizardContextBuilders(Pf2eWizardAppBase));

Pf2eWizardApp.DEFAULT_OPTIONS.actions = {
  next: Pf2eWizardApp.prototype.onNext,
  previous: Pf2eWizardApp.prototype.onPrevious,
  create: Pf2eWizardApp.prototype.onCreate,
  save: Pf2eWizardApp.prototype.onSave,
  selectAncestry: Pf2eWizardApp.prototype.onSelectAncestry,
  selectHeritage: Pf2eWizardApp.prototype.onSelectHeritage,
  selectBackground: Pf2eWizardApp.prototype.onSelectBackground,
  selectClass: Pf2eWizardApp.prototype.onSelectClass,
  selectKeyAbility: Pf2eWizardApp.prototype.onSelectKeyAbility,
  assignBoost: Pf2eWizardApp.prototype.onAssignBoost,
  removeBoost: Pf2eWizardApp.prototype.onRemoveBoost,
  toggleSkillTraining: Pf2eWizardApp.prototype.onToggleSkillTraining,
  toggleFeat: Pf2eWizardApp.prototype.onToggleFeat,
  toggleSpell: Pf2eWizardApp.prototype.onToggleSpell,
  toggleEquipment: Pf2eWizardApp.prototype.onToggleEquipment,
  toggleProficiencyWithoutLevel: Pf2eWizardApp.prototype.onToggleProficiencyWithoutLevel
};
