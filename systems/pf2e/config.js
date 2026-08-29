/**
 * Pathfinder 2nd Edition System Configuration
 */
import { Pf2eWizardApp } from './wizard/pf2e-wizard-app.js';
import { Pf2eRulesEngine } from './rules/pf2e-rules-engine.js';
import { Pf2eCharacterModel } from './data/pf2e-character-model.js';
import { Pf2eActorAdapter } from './adapter/pf2e-actor-adapter.js';

export const pf2eConfig = {
  id: 'pf2e',
  name: 'Pathfinder 2nd Edition',
  description: 'Modern fantasy RPG with ancestry and heritage',
  icon: 'fa-solid fa-dragon',
  color: '#C87533',
  underglow: '#8B4513',
  version: '1.0.0',
  available: true,

  wizardClass: Pf2eWizardApp,
  rulesEngine: Pf2eRulesEngine,
  characterModel: Pf2eCharacterModel,
  actorAdapter: Pf2eActorAdapter,

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
