/**
 * Pf2eWizardNavigation - PF2e wizard page sequence, built on the generic
 * core/wizard-navigation.js page-walking mechanics.
 */
import { WizardNavigation } from '../../../core/wizard-navigation.js';

export const PF2E_PAGES = [
  'welcome',
  'ancestry',
  'heritage',
  'background',
  'class',
  'key-ability',
  'ability-boosts',
  'skills',
  'feats',
  'spells',
  'equipment',
  'details',
  'summary'
];

const PF2E_PAGE_LABELS = {
  welcome: 'Welcome',
  ancestry: 'Ancestry',
  heritage: 'Heritage',
  background: 'Background',
  class: 'Class',
  'key-ability': 'Key Ability',
  'ability-boosts': 'Ability Boosts',
  skills: 'Skills',
  feats: 'Feats',
  spells: 'Spells',
  equipment: 'Equipment',
  details: 'Details',
  summary: 'Summary'
};

export class Pf2eWizardNavigation extends WizardNavigation {
  constructor(pages = PF2E_PAGES) {
    super(pages);
  }

  getPageLabel(pageName) {
    return PF2E_PAGE_LABELS[pageName] || super.getPageLabel(pageName);
  }
}
