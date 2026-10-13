/**
 * D&D 5e System Configuration
 * Defines the structure and metadata for D&D 5e support.
 * Wizard class loads on demand (lazy / trigger-based).
 */

export const dnd5eConfig = {
  id: 'dnd5e',
  name: 'Dungeons & Dragons 5th Edition',
  description: 'Classic fantasy RPG with classes, levels, and magic',
  icon: 'fa-solid fa-dungeon',
  color: '#8B4513',
  underglow: '#654321',
  version: '1.0.0',
  available: true,

  wizardClass: null,

  async loadWizardClass() {
    const { AxyumApp } = await import('../../core/axyum-app.js');
    return AxyumApp;
  },

  requiredFoundrySystem: 'dnd5e',
  minimumFoundryVersion: '13.0.0',

  features: {
    classes: true,
    races: true,
    backgrounds: true,
    levels: true,
    spells: true,
    equipment: true,
    multiclassing: true,
    feats: true
  }
};
