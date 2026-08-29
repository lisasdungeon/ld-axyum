/**
 * System Registry - Manages available game systems for LD Axyum
 * Handles system discovery, loading, and metadata
 */

export class SystemRegistry {
  constructor() {
    this.systems = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the system registry
   */
  async initialize() {
    if (this.initialized) return;

    // Register built-in systems
    await this._registerBuiltInSystems();

    this.initialized = true;
  }

  /**
   * Get all available systems
   * @returns {Array} Array of system metadata
   */
  async getAvailableSystems() {
    await this.initialize();

    return Array.from(this.systems.values()).map(system => ({
      id: system.id,
      name: system.name,
      description: system.description,
      icon: system.icon,
      color: system.color,
      underglow: system.underglow,
      version: system.version,
      available: system.available
    }));
  }

  /**
   * Get a specific system by ID
   * @param {string} systemId - The system ID
   * @returns {Object|null} System configuration or null
   */
  async getSystem(systemId) {
    await this.initialize();
    return this.systems.get(systemId) || null;
  }

  /**
   * Register built-in systems
   * @private
   */
  async _registerBuiltInSystems() {
    const systemIds = ['dnd5e', 'coc7', 'bitd', 'cyberpunk2020', 'pf2e'];

    for (const systemId of systemIds) {
      try {
        // Dynamically import system config
        const configModule = await import(`../systems/${systemId}/config.js`);
        const config = configModule[`${systemId}Config`] || Object.values(configModule).find(value => value?.id === systemId);

        if (config) {
          // Check if required Foundry system is available
          const foundrySystemAvailable = config.requiredFoundrySystem ?
            this.isFoundrySystemAvailable(config.requiredFoundrySystem) : true;

          this.systems.set(systemId, {
            ...config,
            available: Boolean(config.available && foundrySystemAvailable)
          });
        }
      } catch (error) {
        console.warn(`LD Axyum | Failed to load system config for ${systemId}:`, error);
        // Register with basic info if config fails to load
        this.systems.set(systemId, {
          id: systemId,
          name: `${systemId.toUpperCase()} (Loading...)`,
          description: 'System configuration loading...',
          available: false
        });
      }
    }
  }

  /**
   * Check if a Foundry system is available
   * @param {string} systemId - Foundry system ID
   * @returns {boolean} Whether the system is available
   */
  isFoundrySystemAvailable(systemId) {
    // The current world is definitionally running an installed system, so this is
    // the reliable check in an active session. game.systems (the full installed-package
    // collection) is populated on the Setup screen but is not consistently available
    // once a world has loaded, so it's only a secondary fallback.
    if (game?.system?.id === systemId) return true;

    const systems = game?.systems;
    if (!systems || typeof systems.get !== 'function') return false;
    return !!systems.get(systemId);
  }
}
