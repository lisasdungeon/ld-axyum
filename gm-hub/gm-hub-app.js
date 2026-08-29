/**
 * GM Hub - Main orchestration interface for LD Axyum
 * Allows GMs to select game systems and launch appropriate wizards
 */

import { SystemRegistry } from './system-registry.js';
import { AxyumApp } from '../core/axyum-app.js';
import { forceRender } from '../core/multipath.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function getRootElement(html) {
  return html instanceof HTMLElement ? html : (html?.[0] ?? html?.element ?? html ?? null);
}

function bindHubListeners(root, app) {
  if (!root || root.dataset.ldAxyumListenersBound === 'true') return;
  root.dataset.ldAxyumListenersBound = 'true';

  root.addEventListener('click', (event) => {
    // [data-action] elements (system-card, settings, preview, use-sheet) are already
    // dispatched by ApplicationV2's own static DEFAULT_OPTIONS.actions delegation —
    // handling them again here would double-fire every action. Tab buttons carry no
    // data-action, so they still need this manual fallback.
    const tabButton = event.target.closest?.('.tab-button');
    if (tabButton && root.contains(tabButton)) {
      event.preventDefault();
      app.onSwitchTab({ currentTarget: tabButton, target: tabButton, preventDefault: () => event.preventDefault() });
    }
  });
}

class GmHubApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'gm-hub-app',
    tag: 'div',
    window: {
      title: 'LD Axyum - GM Hub',
      icon: 'fa-solid fa-crown',
      resizable: true,
      minimizable: true
    },
    classes: ['ld-axyum-gm-hub'],
    position: { width: 1200, height: 800 },
    actions: {
      selectSystem: GmHubApp.prototype.onSelectSystem,
      openSettings: GmHubApp.prototype.onOpenSettings,
      switchTab: GmHubApp.prototype.onSwitchTab,
      previewSheet: GmHubApp.prototype.onPreviewSheet,
      useSheet: GmHubApp.prototype.onUseSheet
    }
  };

  static PARTS = {
    main: { template: 'modules/ld-axyum/gm-hub/templates/gm-hub.hbs' }
  };

  constructor(options = {}) {
    super(options);
    this.systemRegistry = new SystemRegistry();
  }

  // ===== CONTEXT PREPARATION =====

  async _prepareContext(options) {
    const systems = await this.systemRegistry.getAvailableSystems();

    return {
      systems: systems.map(system => ({
        ...system,
        cardClass: `system-card-${system.id}`,
        iconClass: system.icon || 'fa-solid fa-dungeon',
        color: system.color || '#6f8faf',
        underglow: system.underglow || '#4a6fa5',
        theme: this._getSystemTheme(system.id)
      }))
    };
  }

  /**
   * Get the theme name for a system
   * @param {string} systemId - System ID
   * @returns {string} Theme name
   * @private
   */
  _getSystemTheme(systemId) {
    const themes = {
      dnd5e: 'Post-Apocalyptic Axyum',
      coc7: 'Cthulhu Wasteland',
      cyberpunk2020: 'Neon Ruins',
      bitd: 'Gothic Decay',
      pf2e: 'Ancient Remnants'
    };
    return themes[systemId] || 'Axyum Theme';
  }

  // ===== EVENT HANDLERS =====

  async onSelectSystem(event, target) {
    const el = target || event.target?.closest?.('[data-action]');
    const systemId = el?.dataset.systemId;
    console.log('GM Hub | System selected:', systemId);

    try {
      const system = await this.systemRegistry.getSystem(systemId);
      if (!system?.available) {
        ui.notifications.warn(`${system?.name || systemId} is not available yet.`);
        return;
      }

      const WizardClass = system.wizardClass || AxyumApp;
      const wizard = new WizardClass({ mode: 'create' });
      await forceRender(wizard);
    } catch (err) {
      console.error('GM Hub | Error launching wizard:', err);
      ui.notifications.error('Failed to launch character creator: ' + err.message);
    }
  }

  async onOpenSettings(event) {
    console.log('GM Hub | Opening settings');
    // TODO: Open settings dialog
  }

  onSwitchTab(event) {
    const target = event.currentTarget;
    const tabName = target.dataset.tab;
    console.log('GM Hub | Switching to tab:', tabName);

    const root = getRootElement(this.element);
    if (!root) return;

    // Update tab buttons
    root.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
    });
    target.classList.add('active');

    // Update tab content
    root.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    root.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
  }

  async onPreviewSheet(event, target) {
    const el = target || event.target?.closest?.('[data-action]');
    const systemId = el?.dataset.systemId;
    console.log('GM Hub | Previewing sheet for:', systemId);

    // TODO: Open sheet preview modal
    ui.notifications.info(`Sheet preview for ${systemId} coming soon!`);
  }

  async onUseSheet(event, target) {
    const el = target || event.target?.closest?.('[data-action]');
    const systemId = el?.dataset.systemId;
    console.log('GM Hub | Setting default sheet for:', systemId);

    // TODO: Set user's preferred sheet for this system
    ui.notifications.info(`Default sheet selection for ${systemId} is coming soon!`);
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    bindHubListeners(getRootElement(this.element), this);
    // Raise z-index after paint (do not re-render — that loops)
    try {
      const el = this.element instanceof HTMLElement ? this.element : null;
      if (el) {
        const apps = document.querySelectorAll('.application, .window-app, .app');
        let maxZ = 100;
        apps.forEach((node) => {
          const z = parseInt(window.getComputedStyle(node).zIndex, 10);
          if (Number.isFinite(z) && z > maxZ) maxZ = z;
        });
        el.style.zIndex = String(maxZ + 1);
      }
    } catch {
      /* ignore */
    }
  }
}

// Update actions after class definition so methods exist on the prototype
GmHubApp.DEFAULT_OPTIONS.actions = {
  selectSystem: GmHubApp.prototype.onSelectSystem,
  openSettings: GmHubApp.prototype.onOpenSettings,
  switchTab: GmHubApp.prototype.onSwitchTab,
  previewSheet: GmHubApp.prototype.onPreviewSheet,
  useSheet: GmHubApp.prototype.onUseSheet
};

export { GmHubApp };
