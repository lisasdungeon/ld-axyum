/**
 * Compendium Selector - Modal for choosing which compendia to use
 * Migrated to ApplicationV2 (Foundry v13+)
 */

import { logger } from '../../core/logger.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const NON_ITEM_DOCUMENT_TYPES = new Set(['Actor', 'JournalEntry', 'RollTable', 'Macro', 'Playlist', 'Scene', 'Adventure', 'Cards']);

function packDocumentName(pack) {
  return pack?.documentName || pack?.metadata?.documentName || pack?.metadata?.type || '';
}

/** Only exclude packs we can positively identify as non-Item — never exclude on an unrecognized/empty value. */
function isKnownNonItemPack(pack) {
  return NON_ITEM_DOCUMENT_TYPES.has(packDocumentName(pack));
}

export class CompendiumSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'ld-axyum-compendium-selector',
    tag: 'div',
    window: {
      title: 'Configure Compendia Sources',
      icon: 'fa-solid fa-book-open',
      resizable: true,
      minimizable: true
    },
    classes: ['ld-axyum-compendium-selector'],
    position: { width: 700, height: 600 },
    actions: {
      selectAll: CompendiumSelector.prototype._onSelectAll,
      deselectAll: CompendiumSelector.prototype._onDeselectAll,
      saveCompendia: CompendiumSelector.prototype._onSave,
      cancelSelector: CompendiumSelector.prototype._onCancel,
      switchTab: CompendiumSelector.prototype._onSwitchTab
    }
  };

  static PARTS = {
    main: { template: 'modules/ld-axyum/ui/modals/compendium-selector.hbs' }
  };

  async _prepareContext(options) {
    const compendia = {
      classes: [], races: [], backgrounds: [],
      spells: [], equipment: [], feats: [], other: []
    };

    let enabledCompendia = {};
    try {
      enabledCompendia = game.settings.get('ld-axyum', 'enabledCompendia') || {};
    } catch (e) {
      logger.warn('enabledCompendia setting unavailable', e);
    }

    const hasExplicitSelection = Object.values(enabledCompendia).some(Boolean);
    const packs = game.packs?.values?.() ? Array.from(game.packs.values()) : [];

    for (const pack of packs) {
      if (isKnownNonItemPack(pack)) continue;
      const docName = packDocumentName(pack);

      const packInfo = {
        id: pack.collection,
        name: pack.title,
        package: pack.metadata?.packageName || '',
        type: docName || 'Item',
        enabled: hasExplicitSelection
          ? !!enabledCompendia[pack.collection]
          : true,
        icon: this._getIconForType(docName || 'Item'),
        isHomebrew: pack.metadata?.packageName !== 'dnd5e' && pack.metadata?.packageName !== 'world'
      };

      const packTypes = (pack.metadata?.flags?.dnd5e?.types || []).map(t => String(t).toLowerCase());
      const categorized = { classes: false, races: false, backgrounds: false, spells: false, equipment: false, feats: false };

      const addToCategory = (category) => {
        if (!categorized[category]) {
          compendia[category].push(packInfo);
          categorized[category] = true;
        }
      };

      if (packTypes.length > 0) {
        if (packTypes.includes('class')) addToCategory('classes');
        if (packTypes.includes('race') || packTypes.includes('species')) addToCategory('races');
        if (packTypes.includes('background')) addToCategory('backgrounds');
        if (packTypes.includes('spell')) addToCategory('spells');
        if (packTypes.includes('equipment') || packTypes.includes('item') || packTypes.includes('weapon')) addToCategory('equipment');
        if (packTypes.includes('feat')) addToCategory('feats');
      }

      if (!Object.values(categorized).some(Boolean)) {
        const searchText = `${pack.collection} ${pack.title} ${pack.metadata?.packageName || ''}`.toLowerCase();
        if (searchText.includes('class')) addToCategory('classes');
        if (searchText.includes('race') || searchText.includes('species') || searchText.includes('origin') || searchText.includes('ancestry') || searchText.includes('lineage')) addToCategory('races');
        if (searchText.includes('background')) addToCategory('backgrounds');
        if (searchText.includes('spell') || searchText.includes('magic')) addToCategory('spells');
        if (searchText.includes('equipment') || searchText.includes('item') || searchText.includes('weapon') || searchText.includes('armor') || searchText.includes('gear') || searchText.includes('treasure')) addToCategory('equipment');
        if (searchText.includes('feat') || searchText.includes('talent')) addToCategory('feats');
      }

      if (!Object.values(categorized).some(Boolean)) {
        // Uncategorized Item packs still matter — put in other so they can be enabled
        compendia.other.push(packInfo);
      }
    }

    for (const category in compendia) {
      compendia[category].sort((a, b) => a.name.localeCompare(b.name));
    }

    return {
      compendia,
      hasClasses: compendia.classes.length > 0,
      hasRaces: compendia.races.length > 0,
      hasBackgrounds: compendia.backgrounds.length > 0,
      hasSpells: compendia.spells.length > 0,
      hasEquipment: compendia.equipment.length > 0,
      hasFeats: compendia.feats.length > 0,
      hasOther: compendia.other.length > 0
    };
  }

  _getIconForType(type) {
    const icons = {
      Item: 'fa-solid fa-suitcase',
      Actor: 'fa-solid fa-users',
      JournalEntry: 'fa-solid fa-book',
      RollTable: 'fa-solid fa-th-list',
      Macro: 'fa-solid fa-code',
      Playlist: 'fa-solid fa-music',
      Scene: 'fa-solid fa-map'
    };
    return icons[type] || 'fa-solid fa-folder';
  }

  _onRender(context, options) {
    this.element.querySelectorAll('.tabs .item').forEach((tab, index) => {
      tab.classList.toggle('active', index === 0);
    });
    this.element.querySelectorAll('.tab-content').forEach((panel, index) => {
      panel.classList.toggle('active', index === 0);
    });
  }

  _onSwitchTab(event) {
    const tab = event.currentTarget.dataset.tab;
    this.element.querySelectorAll('.tabs .item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    this.element.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const target = this.element.querySelector(`.tab-content[data-tab="${tab}"]`);
    if (target) target.classList.add('active');
  }

  _onSelectAll(event) {
    const tab = event.currentTarget.dataset.tab;
    this.element.querySelectorAll(`.tab-content[data-tab="${tab}"] input[type="checkbox"]`).forEach(cb => { cb.checked = true; });
  }

  _onDeselectAll(event) {
    const tab = event.currentTarget.dataset.tab;
    this.element.querySelectorAll(`.tab-content[data-tab="${tab}"] input[type="checkbox"]`).forEach(cb => { cb.checked = false; });
  }

  async _onSave(event) {
    if (!game.user?.isGM) {
      ui.notifications.warn('Only the GM can change world compendium settings.');
      return;
    }

    const enabledCompendia = {};
    this.element.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
      const packId = cb.dataset.packId;
      if (packId) enabledCompendia[packId] = true;
    });

    await game.settings.set('ld-axyum', 'enabledCompendia', enabledCompendia);
    ui.notifications.info('Compendium settings saved! Reloading content...');

    if (game.ldAxyum?.compendiumLoader) {
      game.ldAxyum.AxyumApp?.invalidateContentCache?.();
      await game.ldAxyum.compendiumLoader.clearCache().catch(err => {
        logger.warn('Failed to reload compendia:', err);
        ui.notifications.warn('Failed to reload some compendia. Check console for details.');
      });
      ui.notifications.success('Compendia reloaded! Your next character will use these sources.');
    }

    this.close();
  }

  _onCancel() {
    this.close();
  }
}
