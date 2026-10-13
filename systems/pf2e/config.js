/**
 * Pathfinder 2nd Edition System Configuration
 * Heavy wizard / rules modules load on demand (lazy / trigger-based).
 */

export const pf2eConfig = {
  id: 'pf2e',
  name: 'Pathfinder 2nd Edition',
  description: 'Modern fantasy RPG with ancestry and heritage',
  icon: 'fa-solid fa-dragon',
  color: '#C87533',
  underglow: '#8B4513',
  version: '1.0.0',
  available: true,

  wizardClass: null,
  rulesEngine: null,
  characterModel: null,
  actorAdapter: null,

  async loadWizardClass() {
    const { Pf2eWizardApp } = await import('./wizard/pf2e-wizard-app.js');
    return Pf2eWizardApp;
  },

  async loadRulesEngine() {
    const { Pf2eRulesEngine } = await import('./rules/pf2e-rules-engine.js');
    return Pf2eRulesEngine;
  },

  async loadCharacterModel() {
    const { Pf2eCharacterModel } = await import('./data/pf2e-character-model.js');
    return Pf2eCharacterModel;
  },

  async loadActorAdapter() {
    const { Pf2eActorAdapter } = await import('./adapter/pf2e-actor-adapter.js');
    return Pf2eActorAdapter;
  },

  requiredFoundrySystem: 'pf2e',
  minimumFoundryVersion: '13.0.0',

  features: {
    ancestry: true,
    heritage: true,
    backgrounds: true,
    classes: true,
    proficiency: true,
    feats: true,
    spellcasting: true
  }
};
