/**
 * LD Axyum - Next Generation Multi-System Character Manager
 * Main module entry point (multipath v13/v14)
 */

import { GmHubApp } from './gm-hub/gm-hub-app.js';
import { AxyumApp } from './core/axyum-app.js';
import { RulesEngine } from './core/rules-engine.js';
import { CharacterModel } from './core/character-model.js';
import { CharacterExporter } from './core/character-exporter.js';
import { CharacterImporter } from './core/character-importer.js';
import { ExportImportUI } from './core/export-import-ui.js';
import { SpellManagement } from './core/spell-management.js';
import { AdvantageDisadvantageTracker } from './core/advantage-disadvantage-tracker.js';
import { ProficiencyBonusAutomation } from './core/proficiency-bonus-automation.js';
import CompendiumLoader from './core/compendium-loader.js';
import { CompendiumSelector } from './ui/modals/compendium-selector.js';
import { MODULE_ID, forceRender, getOpenApp } from './core/multipath.js';
import { Dnd5eCharacterSheet } from './systems/dnd5e/sheet/dnd5e-sheet.js';

// ============================================
// Module Initialization
// ============================================
let _axyumInitialized = false;
let _templatePromise = null;  // Cache the template loading promise

/** Open (or focus) the GM Hub — primary public entry. */
const openAxyum = async () => {
  console.log('LD Axyum | openAxyum called');
  try {
    await initializeAxyumIfNeeded();
    if (game.ldAxyum?.open) {
      return await game.ldAxyum.open();
    }
    const existing = getOpenApp('gm-hub-app');
    if (existing) return forceRender(existing);
    const app = new GmHubApp();
    return forceRender(app);
  } catch (e) {
    console.error('LD Axyum | Failed to open:', e);
    ui.notifications?.warn?.('Failed to open Axyum GM Hub');
  }
};

globalThis.openLDAxyum = openAxyum;

// ============================================
// LAZY LOADING INITIALIZATION
// ============================================
async function initializeAxyumIfNeeded() {
  if (_axyumInitialized) return _templatePromise;
  try {
    _axyumInitialized = true;
    
    // Register helpers immediately (synchronous, fast)
    registerHandlebarsHelpers();
    
    // Start template loading - store promise for reuse
    _templatePromise = preloadHandlebarsTemplates();
    
    // Public API (no legacy automation required)
    game.ldAxyum = {
      open: async () => {
        try {
          if (_templatePromise) await _templatePromise;
          const existing = getOpenApp('gm-hub-app');
          if (existing) return forceRender(existing);
          const app = new GmHubApp();
          return forceRender(app);
        } catch (err) {
          console.error('LD Axyum | Error in open():', err);
          ui.notifications?.error?.('Failed to open Axyum GM Hub: ' + err.message);
          throw err;
        }
      },
      openCreate: async () => {
        if (_templatePromise) await _templatePromise;
        return forceRender(new AxyumApp({ mode: 'create' }));
      },
      openEdit: async (actor) => {
        if (_templatePromise) await _templatePromise;
        return forceRender(new AxyumApp({ mode: 'edit', actor }));
      },
      openCompendiumSelector: async () => forceRender(new CompendiumSelector()),
      GmHubApp, AxyumApp, RulesEngine, CharacterModel,
      CharacterExporter, CharacterImporter, ExportImportUI, SpellManagement,
      AdvantageDisadvantageTracker, ProficiencyBonusAutomation,
      CompendiumLoader, CompendiumSelector
    };
    
    window.CharacterExporter = CharacterExporter;
    window.CharacterImporter = CharacterImporter;
    window.ExportImportUI = ExportImportUI;
    window.SpellManagement = SpellManagement;
    
    const loader = new CompendiumLoader();
    game.ldAxyum.compendiumLoader = loader;

    console.log('LD Axyum | Starting background compendium load...');
    loader.loadAllContent().then(() => {
      console.log('LD Axyum | Compendium loaded', {
        classes: loader.cache.classes?.length || 0,
        races: loader.cache.races?.length || 0,
        backgrounds: loader.cache.backgrounds?.length || 0,
        spells: loader.cache.spells?.length || 0,
        equipment: loader.cache.equipment?.length || 0,
        feats: loader.cache.feats?.length || 0
      });
    }).catch(err => console.error('LD Axyum | Compendium load failed', err));
  } catch (err) {
    _axyumInitialized = false;
    console.error('LD Axyum | Initialization failed', err);
    throw err;
  }
}

function hasHandlebarsHelper(name) {
  if (Handlebars.helpers?.[name]) return true;
  if (typeof Handlebars.helpers?.get === 'function' && Handlebars.helpers.get(name)) return true;
  return false;
}

function registerHandlebarsHelper(name, fn) {
  if (hasHandlebarsHelper(name)) return;
  Handlebars.registerHelper(name, fn);
}

export function registerHandlebarsHelpers() {
  registerHandlebarsHelper('eq', (a, b) => a === b);
  registerHandlebarsHelper('ne', (a, b) => a !== b);
  registerHandlebarsHelper('gt', (a, b) => a > b);
  registerHandlebarsHelper('gte', (a, b) => a >= b);
  registerHandlebarsHelper('lt', (a, b) => a < b);
  registerHandlebarsHelper('lte', (a, b) => a <= b);
  registerHandlebarsHelper('add', (a, b) => a + b);
  registerHandlebarsHelper('sum', (a, b) => a + b);
  registerHandlebarsHelper('includes', (arr, val) => Array.isArray(arr) && arr.includes(val));
  registerHandlebarsHelper('subtract', (a, b) => a - b);
  registerHandlebarsHelper('multiply', (a, b) => a * b);
  registerHandlebarsHelper('divide', (a, b) => b !== 0 ? Math.floor(a / b) : 0);
  registerHandlebarsHelper('abs', (a) => Math.abs(a));
  registerHandlebarsHelper('percent', (current, total) => Math.round((current / (total || 1)) * 100));
  // Never replace Foundry's localize helper. Replacing it blanks core UI templates.
  registerHandlebarsHelper('uppercase', (str) => String(str || '').toUpperCase());
  registerHandlebarsHelper('localize', (key) => game.i18n?.localize?.(String(key)) || String(key));
  registerHandlebarsHelper('formatModifier', (value) => {
    const num = Number(value) || 0;
    return num >= 0 ? `+${num}` : `${num}`;
  });
  registerHandlebarsHelper('abilityMod', (score) => {
    const s = Number(score) || 10;
    const mod = Math.floor((s - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  });
  registerHandlebarsHelper('sumAll', function() {
    const args = Array.prototype.slice.call(arguments, 0, -1);
    return args.reduce((sum, val) => sum + (Number(val) || 0), 0);
  });
  registerHandlebarsHelper('join', (arr, separator) => {
    if (!Array.isArray(arr)) return '';
    return arr.join(separator || ', ');
  });
  registerHandlebarsHelper('repeat', function(count, options) {
    let result = '';
    for (let i = 0; i < count; i++) {
      result += options.fn({ index: i });
    }
    return result;
  });
  registerHandlebarsHelper('lookup', (obj, key) => {
    if (!obj) return null;
    return obj[key];
  });
}

async function preloadHandlebarsTemplates() {
  const templatePaths = [
    // Main app template
    'modules/ld-axyum/ui/axyum-app.hbs',
    
    // Wizard pages
    'modules/ld-axyum/ui/pages/welcome.hbs',
    'modules/ld-axyum/ui/pages/role.hbs',
    'modules/ld-axyum/ui/pages/class.hbs',
    'modules/ld-axyum/ui/pages/multiclass.hbs',
    'modules/ld-axyum/ui/pages/race.hbs',
    'modules/ld-axyum/ui/pages/background.hbs',
    'modules/ld-axyum/ui/pages/abilities.hbs',
    'modules/ld-axyum/ui/pages/skills.hbs',
    'modules/ld-axyum/ui/pages/proficiencies.hbs',
    'modules/ld-axyum/ui/pages/equipment.hbs',
    'modules/ld-axyum/ui/pages/spells.hbs',
    'modules/ld-axyum/ui/pages/details.hbs',
    'modules/ld-axyum/ui/pages/biography.hbs',
    'modules/ld-axyum/ui/pages/summary.hbs',
    'modules/ld-axyum/ui/pages/feat-selection.hbs',
    
    // Sheet templates
    'modules/ld-axyum/ui/sheet/character-sheet.hbs',
    'modules/ld-axyum/ui/sheet/axyum-character-preview-simple.hbs',
    
    // Modal templates
    'modules/ld-axyum/ui/modals/export-modal.hbs',
    'modules/ld-axyum/ui/modals/import-modal.hbs',
    'modules/ld-axyum/ui/modals/compendium-selector.hbs'
  ];

  // Fetch all templates in parallel and register as partials
  const fetchPromises = templatePaths.map(async (path) => {
    try {
      const response = await fetch(path);
      if (!response.ok) return null;
      const text = await response.text();
      return { path, text };
    } catch (err) {
      console.warn(`LD Axyum | Failed to load template: ${path}`);
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);
  
  // Register all templates as partials
  for (const result of results) {
    if (!result) continue;
    const { path, text } = result;
    const partialName = path.replace(/\.hbs$/, '');
    Handlebars.registerPartial(partialName, text);
  }
  
  console.log('LD Axyum | Templates loaded and partials registered');
}

// ============================================
// Hook: init - Register settings only
// ============================================

Hooks.once('init', async () => {
  console.log('LD Axyum | Init hook - registering settings');

  try {
    game.settings.register(MODULE_ID, 'enabledCompendia', {
      name: game.i18n?.localize?.("LD_AXYUM.Settings.EnabledCompendia.Name") || "Enabled Compendia",
      hint: game.i18n?.localize?.("LD_AXYUM.Settings.EnabledCompendia.Hint") || "Select which compendia to use for character creation. Open the Compendium Selector to configure.",
      scope: 'world',
      config: false,
      type: Object,
      default: {}
    });

    game.settings.register(MODULE_ID, 'useVariantRules', {
      name: game.i18n?.localize?.("LD_AXYUM.Settings.VariantRules.Name") || "Enable Variant Rules",
      hint: game.i18n?.localize?.("LD_AXYUM.Settings.VariantRules.Hint") || "Allow Tasha's Cauldron and DMG optional rules",
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
    });

    game.settings.register(MODULE_ID, 'enableDebug', {
      name: game.i18n?.localize?.("LD_AXYUM.Settings.Debug.Name") || "Enable Debug Logging",
      hint: game.i18n?.localize?.("LD_AXYUM.Settings.Debug.Hint") || "Show extra console output while troubleshooting.",
      scope: 'client',
      config: false,
      type: Boolean,
      default: false
    });

    game.settings.register(MODULE_ID, 'theme', {
      name: game.i18n?.localize?.("LD_AXYUM.Settings.Theme.Name") || "UI Theme",
      hint: game.i18n?.localize?.("LD_AXYUM.Settings.Theme.Hint") || "Choose visual theme",
      scope: 'client',
      config: true,
      type: String,
      default: 'modern',
      choices: {
        'modern': 'Modern (Default)',
        'classic': 'Classic',
        'dark': 'Dark Mode'
      }
    });

    // Multipath Object shapes (never bare Array)
    game.settings.register(MODULE_ID, 'contentSources', {
      scope: 'world',
      config: false,
      type: Object,
      default: { byCategory: {} }
    });

  } catch (e) {
    console.warn('LD Axyum | Settings registration error', e);
  }

  // Register the Axyum character sheet as an available option for dnd5e characters.
  // makeDefault is false — only characters created by the wizard (flagged with
  // core.sheetClass) open with it automatically; others keep their existing sheet.
  if (game.system?.id === 'dnd5e') {
    try {
      const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;
      DocumentSheetConfig.registerSheet(Actor, MODULE_ID, Dnd5eCharacterSheet, {
        types: ['character'],
        makeDefault: false,
        label: 'LD Axyum Character Sheet'
      });
    } catch (e) {
      console.warn('LD Axyum | Character sheet registration error', e);
    }
  }
});

// ============================================
// Scene controls — multipath token tools inject
// ============================================
Hooks.on('getSceneControlButtons', (controls) => {
  if (!game.user?.isGM) return;

  const toolId = 'ld-axyum-open-hub';
  const tool = {
    name: toolId,
    title: 'LD Axyum Hub',
    icon: 'fas fa-atom',
    button: true,
    order: 55,
    onChange: () => openAxyum(),
    onClick: () => openAxyum()
  };

  const injectInto = (group) => {
    if (!group) return false;
    if (Array.isArray(group.tools)) {
      if (!group.tools.some((t) => t.name === toolId)) group.tools.push(tool);
      return true;
    }
    if (group.tools && typeof group.tools === 'object') {
      group.tools[toolId] = tool;
      return true;
    }
    return false;
  };

  if (Array.isArray(controls)) {
    const token = controls.find((c) => c.name === 'token' || c.name === 'tokens');
    if (token && injectInto(token)) return;
    controls.push({
      name: 'ld-axyum',
      title: 'LD Axyum',
      icon: 'fas fa-atom',
      layer: 'tokens',
      visible: true,
      tools: [tool]
    });
  } else if (controls && typeof controls === 'object') {
    const token = controls.tokens || controls.token;
    if (token && injectInto(token)) return;
    controls['ld-axyum'] = {
      name: 'ld-axyum',
      title: 'LD Axyum',
      icon: 'fas fa-atom',
      visible: true,
      tools: { [toolId]: tool }
    };
  }
});

// Actors sidebar — "New Character (Axyum)" for GMs / creators
Hooks.on('renderActorDirectory', (app, html) => {
  try {
    const root = html?.[0] || html || app?.element;
    if (!(root instanceof HTMLElement)) return;
    if (root.querySelector('#ld-axyum-new-char')) return;

    const footer =
      root.querySelector('.directory-footer') ||
      root.querySelector('footer') ||
      root.querySelector('.action-buttons') ||
      null;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'ld-axyum-new-char';
    btn.className = 'ld-axyum-sidebar-btn';
    btn.innerHTML = '<i class="fas fa-atom"></i> New Character (Axyum)';
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      await initializeAxyumIfNeeded();
      await game.ldAxyum?.openCreate?.();
    });

    if (footer) footer.prepend(btn);
    else root.appendChild(btn);
  } catch (err) {
    console.warn('LD Axyum | ActorDirectory inject failed', err);
  }
});

// ============================================
// Hook: ready - Initialize Core Components
// ============================================
Hooks.once('ready', async () => {
  console.log('LD Axyum | Ready hook - pre-loading everything in background');
  initializeAxyumIfNeeded();
});

// ============================================
// Exports
// ============================================

export { 
  AxyumApp, 
  RulesEngine, 
  CharacterModel, 
  CharacterExporter, 
  CharacterImporter, 
  ExportImportUI,
  SpellManagement,
  AdvantageDisadvantageTracker,
  ProficiencyBonusAutomation,
  CompendiumLoader,
  CompendiumSelector
};

