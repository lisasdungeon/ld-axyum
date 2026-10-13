/**
 * LD Axyum - Next Generation Multi-System Character Manager
 * Thin bootstrap: settings on init, heavy modules load only on user triggers.
 */

import { MODULE_ID, forceRender, getOpenApp } from './core/multipath.js';
import { registerHandlebarsHelpers } from './core/handlebars-helpers.js';

export { registerHandlebarsHelpers };

let _axyumInitialized = false;
let _templatePromise = null;
let _systemRegistry = null;
let _coreModules = null;
let _coreModulesPromise = null;

/** Import map for heavy modules. Overridable in tests via __setCoreImporter. */
let _coreImporter = async () => Promise.all([
  import('./gm-hub/gm-hub-app.js'),
  import('./core/axyum-app.js'),
  import('./core/rules-engine.js'),
  import('./core/character-model.js'),
  import('./core/character-exporter.js'),
  import('./core/character-importer.js'),
  import('./core/export-import-ui.js'),
  import('./core/spell-management.js'),
  import('./core/advantage-disadvantage-tracker.js'),
  import('./core/proficiency-bonus-automation.js'),
  import('./core/compendium-loader.js'),
  import('./ui/modals/compendium-selector.js'),
  import('./gm-hub/system-registry.js')
]);

/** Test-only seam to force import failures / alternate loaders. */
export function __setCoreImporter(fn) {
  _coreImporter = fn;
  _coreModules = null;
  _coreModulesPromise = null;
}

/** Dynamic-import heavy feature modules once; cache forever. */
async function loadCoreModules() {
  if (_coreModules) return _coreModules;
  if (_coreModulesPromise) return _coreModulesPromise;

  _coreModulesPromise = (async () => {
    const [
      gmHubMod,
      axyumAppMod,
      rulesMod,
      modelMod,
      exporterMod,
      importerMod,
      exportImportMod,
      spellMod,
      advMod,
      profMod,
      loaderMod,
      selectorMod,
      registryMod
    ] = await _coreImporter();

    _coreModules = {
      GmHubApp: gmHubMod.GmHubApp,
      AxyumApp: axyumAppMod.AxyumApp,
      RulesEngine: rulesMod.RulesEngine,
      CharacterModel: modelMod.CharacterModel,
      CharacterExporter: exporterMod.CharacterExporter,
      CharacterImporter: importerMod.CharacterImporter,
      ExportImportUI: exportImportMod.ExportImportUI,
      SpellManagement: spellMod.SpellManagement,
      AdvantageDisadvantageTracker: advMod.AdvantageDisadvantageTracker,
      ProficiencyBonusAutomation: profMod.ProficiencyBonusAutomation,
      CompendiumLoader: loaderMod.default,
      CompendiumSelector: selectorMod.CompendiumSelector,
      SystemRegistry: registryMod.SystemRegistry
    };
    return _coreModules;
  })();

  try {
    return await _coreModulesPromise;
  } catch (err) {
    _coreModulesPromise = null;
    throw err;
  }
}

/** Public accessor for macros / tests after modules have been loaded. */
export async function getAxyumModules() {
  return loadCoreModules();
}

async function resolveWizardClass(config, fallback) {
  if (!config?.available) return null;
  if (typeof config.loadWizardClass === 'function') {
    const loaded = await config.loadWizardClass();
    if (loaded) return loaded;
  }
  if (config.wizardClass) return config.wizardClass;
  return null;
}

async function getWizardClassForActiveSystem() {
  const mods = await loadCoreModules();
  const systemId = game.system?.id;
  try {
    if (!_systemRegistry) _systemRegistry = new mods.SystemRegistry();
    const config = systemId ? await _systemRegistry.getSystem(systemId) : null;
    const WizardClass = await resolveWizardClass(config, mods.AxyumApp);
    if (WizardClass) return WizardClass;
    console.warn(`LD Axyum | Falling back to AxyumApp (dnd5e) for active system "${systemId}"`, {
      configFound: Boolean(config),
      available: config?.available,
      hasWizardLoader: Boolean(config?.loadWizardClass || config?.wizardClass)
    });
    return mods.AxyumApp;
  } catch (err) {
    console.warn(`LD Axyum | Failed to resolve wizard for active system "${systemId}", falling back to AxyumApp`, err);
    return mods.AxyumApp;
  }
}

const openAxyum = async () => {
  console.log('LD Axyum | openAxyum called');
  try {
    await initializeAxyumIfNeeded();
    if (game.ldAxyum?.open) {
      return await game.ldAxyum.open();
    }
    const mods = await loadCoreModules();
    const existing = getOpenApp('gm-hub-app');
    if (existing) return forceRender(existing);
    const app = new mods.GmHubApp();
    return forceRender(app);
  } catch (e) {
    console.error('LD Axyum | Failed to open:', e);
    ui.notifications?.warn?.('Failed to open Axyum GM Hub');
  }
};

globalThis.openLDAxyum = openAxyum;

/**
 * Trigger-based initialization. Runs only when a user action needs Axyum
 * (hub open, create character, sheet tools). Never from ready preload.
 */
async function initializeAxyumIfNeeded() {
  if (_axyumInitialized) return _templatePromise;
  try {
    _axyumInitialized = true;

    registerHandlebarsHelpers();

    const { preloadHandlebarsTemplates } = await import('./core/template-loader.js');
    _templatePromise = preloadHandlebarsTemplates();

    const mods = await loadCoreModules();

    game.ldAxyum = {
      open: async () => {
        try {
          if (_templatePromise) await _templatePromise;
          const existing = getOpenApp('gm-hub-app');
          if (existing) return forceRender(existing);
          const app = new mods.GmHubApp();
          return forceRender(app);
        } catch (err) {
          console.error('LD Axyum | Error in open():', err);
          ui.notifications?.error?.('Failed to open Axyum GM Hub: ' + err.message);
          throw err;
        }
      },
      openCreate: async () => {
        if (_templatePromise) await _templatePromise;
        const WizardClass = await getWizardClassForActiveSystem();
        return forceRender(new WizardClass({ mode: 'create' }));
      },
      openEdit: async (actor) => {
        if (_templatePromise) await _templatePromise;
        const WizardClass = await getWizardClassForActiveSystem();
        return forceRender(new WizardClass({ mode: 'edit', actor }));
      },
      openCompendiumSelector: async () => {
        await loadCoreModules();
        return forceRender(new mods.CompendiumSelector());
      },
      GmHubApp: mods.GmHubApp,
      AxyumApp: mods.AxyumApp,
      RulesEngine: mods.RulesEngine,
      CharacterModel: mods.CharacterModel,
      CharacterExporter: mods.CharacterExporter,
      CharacterImporter: mods.CharacterImporter,
      ExportImportUI: mods.ExportImportUI,
      SpellManagement: mods.SpellManagement,
      AdvantageDisadvantageTracker: mods.AdvantageDisadvantageTracker,
      ProficiencyBonusAutomation: mods.ProficiencyBonusAutomation,
      CompendiumLoader: mods.CompendiumLoader,
      CompendiumSelector: mods.CompendiumSelector
    };

    window.CharacterExporter = mods.CharacterExporter;
    window.CharacterImporter = mods.CharacterImporter;
    window.ExportImportUI = mods.ExportImportUI;
    window.SpellManagement = mods.SpellManagement;

    const loader = new mods.CompendiumLoader();
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

    game.settings.register(MODULE_ID, 'showSceneControlButton', {
      name: 'Show Scene Control Button',
      hint: 'Show the LD Axyum button on the left scene control bar.',
      scope: 'client',
      config: true,
      type: Boolean,
      default: true,
      onChange: () => ui.controls?.render?.({ reset: true, force: true })
    });

    game.settings.register(MODULE_ID, 'contentSources', {
      scope: 'world',
      config: false,
      type: Object,
      default: { byCategory: {} }
    });

  } catch (e) {
    console.warn('LD Axyum | Settings registration error', e);
  }

  // Sheet class is loaded only when the active system needs it (trigger: init + dnd5e).
  if (game.system?.id === 'dnd5e') {
    try {
      const { Dnd5eCharacterSheet } = await import('./systems/dnd5e/sheet/dnd5e-sheet.js');
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
  try { if (game.settings.get(MODULE_ID, 'showSceneControlButton') === false) return; } catch { /* not registered yet */ }

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
// Hook: ready - light only (controls refresh)
// Heavy init is trigger-based via openAxyum / sidebar.
// ============================================
Hooks.once('ready', async () => {
  console.log('LD Axyum | Ready hook - controls refresh only');
  setTimeout(() => {
    if (ui.controls) ui.controls.render({ reset: true, force: true });
  }, 1000);
});
