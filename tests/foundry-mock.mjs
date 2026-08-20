/** Shared Foundry VTT globals for Node unit tests. */

export function installFoundryMock(overrides = {}) {
  const previous = {
    foundry: globalThis.foundry,
    game: globalThis.game,
    ui: globalThis.ui,
    Hooks: globalThis.Hooks,
    Handlebars: globalThis.Handlebars,
    Actor: globalThis.Actor,
    document: globalThis.document,
    window: globalThis.window,
    fetch: globalThis.fetch,
    HTMLElement: globalThis.HTMLElement,
    navigator: globalThis.navigator,
    FileReader: globalThis.FileReader,
    setTimeout: globalThis.setTimeout
  };

  class ApplicationV2 {
    constructor(options = {}) {
      this.options = options;
      this.element = null;
      this.rendered = false;
      this.position = { ...(options.position || {}) };
    }
    async _prepareContext() { return {}; }
    async _preRender() {}
    _onRender() {}
    async _onClose() {}
    async render() {
      this.rendered = true;
      return this;
    }
    async close() {
      this.closed = true;
      return this;
    }
    setPosition(pos = {}) {
      this.position = { ...this.position, ...pos };
      return this.position;
    }
    bringToFront() {}
  }

  class ActorSheetV2 extends ApplicationV2 {
    constructor(options = {}) {
      super(options);
      this.document = options.document || null;
    }
  }

  globalThis.HTMLElement = class HTMLElement {
    constructor() {
      this.style = {};
      this.dataset = {};
      this.classList = {
        _set: new Set(),
        add(v) { this._set.add(v); },
        remove(v) { this._set.delete(v); },
        contains(v) { return this._set.has(v); },
        toggle(v) {
          if (this._set.has(v)) this._set.delete(v);
          else this._set.add(v);
        }
      };
      this.children = [];
      this._listeners = {};
    }
    appendChild(c) { this.children.push(c); return c; }
    removeChild() {}
    prepend(c) { this.children.unshift(c); return c; }
    addEventListener(type, fn) {
      this._listeners[type] = this._listeners[type] || [];
      this._listeners[type].push(fn);
    }
    removeEventListener() {}
    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest() { return null; }
    setAttribute() {}
    getAttribute() { return null; }
    contains() { return true; }
  };

  const helpers = new Map();
  const partials = new Map();
  globalThis.Handlebars = {
    registerHelper(name, fn) { helpers.set(name, fn); },
    registerPartial(name, text) { partials.set(name, text); },
    helpers,
    partials
  };

  const hookOnce = new Map();
  const hookOn = new Map();
  globalThis.Hooks = {
    once(name, cb) {
      hookOnce.set(name, cb);
      globalThis.__hooksOnce = Object.fromEntries(hookOnce);
    },
    on(name, cb) {
      const list = hookOn.get(name) || [];
      list.push(cb);
      hookOn.set(name, list);
      globalThis.__hooksOn = Object.fromEntries(hookOn);
    },
    callAll(name, ...args) {
      for (const cb of hookOn.get(name) || []) cb(...args);
    },
    _once: hookOnce,
    _on: hookOn
  };

  const settings = new Map();
  globalThis.game = {
    system: { id: 'dnd5e' },
    user: { isGM: true, name: 'GM' },
    i18n: { localize: (k) => k },
    modules: {
      get: (id) => (id === 'ld-axyum' ? { version: '1.0.1', id } : null)
    },
    settings: {
      register: () => {},
      get: (_m, key) => settings.get(key),
      set: async (_m, key, value) => { settings.set(key, value); }
    },
    packs: Object.assign([], {
      size: 0,
      values() { return this[Symbol.iterator](); },
      get: () => null
    }),
    items: Object.assign([], { get: () => null }),
    folders: [],
    actors: { contents: [] },
    ldAxyum: null,
    ...overrides.game
  };
  globalThis.__settingsStore = settings;

  globalThis.ui = {
    notifications: {
      info: () => {},
      warn: () => {},
      warning: () => {},
      error: () => {},
      notify: () => {}
    },
    windows: {},
    ...overrides.ui
  };

  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2,
        HandlebarsApplicationMixin: (Base) => class extends Base {}
      },
      sheets: { ActorSheetV2 },
      apps: {
        DocumentSheetConfig: {
          registerSheet: () => { globalThis.__sheetRegistered = true; }
        }
      },
      instances: {
        values: () => [].values()
      }
    },
    utils: {
      mergeObject: (a, b) => ({ ...a, ...b }),
      deepClone: (v) => structuredClone(v),
      randomID: () => `id-${Math.random().toString(36).slice(2, 8)}`
    },
    ...overrides.foundry
  };

  class Actor {
    constructor() {
      this.id = 'actor-1';
      this.items = [];
    }
    static async create(data) {
      return {
        id: 'actor-1',
        name: data.name,
        type: data.type,
        system: data.system || {},
        items: [],
        flags: data.flags || {},
        update: async (patch) => patch,
        createEmbeddedDocuments: async (_type, docs) => docs,
        getFlag: () => null,
        setFlag: async () => {}
      };
    }
  }
  globalThis.Actor = Actor;

  globalThis.document = {
    createElement: (tag) => {
      const el = new HTMLElement();
      el.tagName = String(tag).toUpperCase();
      el.id = '';
      el.className = '';
      el.innerHTML = '';
      el.hidden = false;
      el.style = { display: '' };
      el.textContent = '';
      el.dataset = {};
      el.replaceChildren = (...nodes) => { el.children = nodes; };
      el.querySelector = () => null;
      el.querySelectorAll = () => [];
      el.closest = () => null;
      el.prepend = (c) => el.appendChild(c);
      el.appendChild = (c) => { el.children.push(c); return c; };
      el.addEventListener = (type, fn) => {
        el._listeners = el._listeners || {};
        el._listeners[type] = el._listeners[type] || [];
        el._listeners[type].push(fn);
      };
      return el;
    },
    createTextNode: (text) => ({ textContent: String(text), nodeType: 3 }),
    body: { appendChild() {}, removeChild() {} },
    head: { appendChild() {} },
    querySelectorAll: () => [],
    getElementById: () => null
  };

  globalThis.window = globalThis;
  try {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        clipboard: {
          writeText: async () => {},
          readText: async () => ''
        }
      }
    });
  } catch {
    /* navigator may be non-configurable in some runtimes */
  }
  globalThis.fetch = async () => ({ ok: false, text: async () => '', json: async () => ({}) });
  globalThis.FileReader = class {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this.result = '';
    }
    readAsText(file) {
      this.result = file?.content || file?.text || '{}';
      if (this.onload) this.onload({ target: this });
    }
  };

  return previous;
}

export function restoreFoundryMock(previous) {
  for (const [key, value] of Object.entries(previous)) {
    if (key === 'navigator') continue;
    try {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    } catch {
      /* ignore non-writable globals */
    }
  }
  delete globalThis.__hooksOnce;
  delete globalThis.__hooksOn;
  delete globalThis.__settingsStore;
  delete globalThis.__sheetRegistered;
}
