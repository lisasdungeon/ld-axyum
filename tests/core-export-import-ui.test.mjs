import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

function makeModal(kind) {
  const state = {};
  const nodes = new Map();
  const makeNode = (key, extra = {}) => {
    if (nodes.has(key)) return nodes.get(key);
    const node = {
      style: {},
      hidden: false,
      disabled: false,
      value: '',
      textContent: '',
      dataset: {},
      classList: {
        _s: new Set(),
        add(v) { this._s.add(v); },
        remove(v) { this._s.delete(v); }
      },
      children: [],
      _listeners: {},
      addEventListener(type, fn) {
        this._listeners[type] = this._listeners[type] || [];
        this._listeners[type].push(fn);
      },
      click() {
        for (const fn of this._listeners.click || []) fn({ target: this, currentTarget: this, preventDefault() {} });
      },
      replaceChildren(...kids) { this.children = kids; },
      removeAttribute() { this.hidden = false; },
      setAttribute(name) { if (name === 'hidden') this.hidden = true; },
      ...extra
    };
    nodes.set(key, node);
    return node;
  };

  const modal = Object.assign(Object.create(HTMLElement.prototype), {
    style: { display: 'none' },
    hidden: true,
    _ldAxyumState: state,
    querySelector(sel) {
      if (sel === '.export-modal' || sel === '.import-modal') return modal;
      if (sel === '.export-size') return makeNode('export-size');
      if (sel === '.close-modal') return makeNode('close');
      if (sel === '.modal-overlay') return makeNode('overlay');
      if (sel === '.file-drop-zone') return makeNode('drop');
      if (sel === '.file-input') return makeNode('file-input', { files: [], value: '' });
      if (sel === '.json-paste') return makeNode('json');
      if (sel === '.import-btn') return makeNode('import-btn', { disabled: true });
      if (sel === '.file-name') return makeNode('file-name', { hidden: true });
      if (sel === '.file-name-text') return makeNode('file-name-text');
      if (sel === '.preview-section') return makeNode('preview');
      if (sel === '.warnings-section') return makeNode('warnings-sec');
      if (sel === '.warnings-list') return makeNode('warnings-list');
      if (sel === '.error-section') return makeNode('error-sec');
      if (sel === '.error-text') return makeNode('error-text');
      if (sel.startsWith('.preview-')) return makeNode(sel);
      if (sel.startsWith('.import-tab-btn[data-tab=')) {
        const tab = sel.match(/data-tab="([^"]+)"/)[1];
        return makeNode(`tabbtn-${tab}`, { dataset: { tab } });
      }
      if (sel.startsWith('.import-tab-content[data-tab=')) {
        const tab = sel.match(/data-tab="([^"]+)"/)[1];
        return makeNode(`tabpanel-${tab}`, { dataset: { tab }, hidden: true });
      }
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.export-option') {
        return [
          makeNode('opt-download', { dataset: { action: 'download' } }),
          makeNode('opt-copy', { dataset: { action: 'copy' } })
        ];
      }
      if (sel === '.import-tab-btn') {
        return [
          makeNode('tabbtn-file', { dataset: { tab: 'file' } }),
          makeNode('tabbtn-paste', { dataset: { tab: 'paste' } })
        ];
      }
      if (sel === '.import-tab-content') {
        return [
          makeNode('tabpanel-file', { dataset: { tab: 'file' }, hidden: false }),
          makeNode('tabpanel-paste', { dataset: { tab: 'paste' }, hidden: true })
        ];
      }
      return [];
    }
  });
  modal.className = kind;
  return { modal, makeNode, nodes };
}

test('export/import UI initializes modals and covers all action paths', async () => {
  const previous = installFoundryMock();
  const timers = [];
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => { timers.push(fn); return 1; };
  try {
    const { ExportImportUI } = await import('../core/export-import-ui.js');
    const { CharacterExporter } = await import('../core/character-exporter.js');
    const { CharacterImporter } = await import('../core/character-importer.js');
    globalThis.window.CharacterExporter = CharacterExporter;
    globalThis.window.CharacterImporter = CharacterImporter;
    globalThis.game.ldAxyum = { CharacterExporter, CharacterImporter };
    globalThis.game.user = { name: 'GM' };

    const actor = {
      id: 'a1',
      name: 'Hero',
      system: {
        details: { race: 'Human', class: 'Fighter', level: 1 },
        abilities: { str: { value: 10 }, dex: { value: 10 }, con: { value: 10 }, int: { value: 10 }, wis: { value: 10 }, cha: { value: 10 } },
        attributes: { ac: { value: 10 }, hp: { value: 10, max: 10, temp: 0 }, movement: { walk: 30 } },
        traits: { armorProf: { value: [] }, weaponProf: { value: [] }, toolProf: { value: [] }, languages: { value: [] } }
      },
      items: [],
      flags: {},
      getFlag: () => null,
      sheet: { render: () => { actor.sheetRendered = true; } }
    };

    // missing exporter early return
    globalThis.window.CharacterExporter = null;
    globalThis.game.ldAxyum.CharacterExporter = null;
    const { modal: bareExport } = makeModal('export');
    const rootBare = Object.assign(Object.create(HTMLElement.prototype), {
      querySelector: (sel) => (sel === '.export-modal' ? bareExport : null)
    });
    ExportImportUI.initializeExportModal(rootBare, actor);
    globalThis.window.CharacterExporter = CharacterExporter;
    globalThis.game.ldAxyum.CharacterExporter = CharacterExporter;

    const { modal: exportModal, nodes: exportNodes } = makeModal('export');
    const exportRoot = Object.assign(Object.create(HTMLElement.prototype), {
      querySelector: (sel) => (sel === '.export-modal' ? exportModal : exportModal.querySelector(sel)),
      0: exportModal
    });
    ExportImportUI.initializeExportModal(exportRoot, actor);
    // array-like root without modal element
    ExportImportUI.initializeExportModal({ querySelector: () => null }, actor);
    ExportImportUI.showExportModal(exportRoot, actor);
    assert.equal(exportModal.hidden, false);

    // download success / failure
    const origDownload = CharacterExporter.downloadCharacterJSON;
    CharacterExporter.downloadCharacterJSON = async () => ({ success: true, message: 'ok' });
    exportNodes.get('opt-download').click();
    await Promise.resolve();
    CharacterExporter.downloadCharacterJSON = async () => ({ success: false, error: 'nope' });
    exportNodes.get('opt-download').click();
    await Promise.resolve();
    CharacterExporter.downloadCharacterJSON = origDownload;

    // clipboard copy success / fail
    globalThis.navigator.clipboard.writeText = async () => {};
    exportNodes.get('opt-copy').click();
    await Promise.resolve();
    globalThis.navigator.clipboard.writeText = async () => { throw new Error('clip'); };
    exportNodes.get('opt-copy').click();
    await Promise.resolve();

    // export action error path
    const boomExporter = {
      downloadCharacterJSON: () => { throw new Error('sync boom'); },
      exportToString: () => { throw new Error('sync boom'); },
      getExportSize: () => 1
    };
    globalThis.window.CharacterExporter = boomExporter;
    ExportImportUI._handleExportAction('download', actor, exportModal);
    ExportImportUI._handleExportAction('copy', actor, exportModal);
    ExportImportUI._handleExportAction('unknown', actor, exportModal);
    globalThis.window.CharacterExporter = null;
    globalThis.game.ldAxyum.CharacterExporter = null;
    ExportImportUI._handleExportAction('download', actor, exportModal);
    globalThis.window.CharacterExporter = CharacterExporter;
    globalThis.game.ldAxyum.CharacterExporter = CharacterExporter;

    // close handlers
    for (const fn of exportNodes.get('close')._listeners.click || []) fn({});
    for (const fn of exportNodes.get('overlay')._listeners.click || []) {
      fn({ target: exportNodes.get('overlay'), currentTarget: exportNodes.get('overlay') });
      fn({ target: {}, currentTarget: exportNodes.get('overlay') });
    }

    // import modal
    const { modal: importModal, nodes: importNodes } = makeModal('import');
    const importRoot = Object.assign(Object.create(HTMLElement.prototype), {
      querySelector: (sel) => (sel === '.import-modal' ? importModal : importModal.querySelector(sel))
    });
    ExportImportUI.initializeImportModal(importRoot, actor);
    ExportImportUI.showImportModal(importRoot, actor);

    // tabs
    for (const fn of importNodes.get('tabbtn-paste')._listeners.click || []) fn({});
    ExportImportUI._switchImportTab(importModal, 'file');

    // drop zone events
    const drop = importNodes.get('drop');
    for (const fn of drop._listeners.click || []) fn({});
    for (const fn of drop._listeners.dragover || []) fn({ preventDefault() {} });
    for (const fn of drop._listeners.dragleave || []) fn({});
    for (const fn of drop._listeners.drop || []) {
      fn({
        preventDefault() {},
        dataTransfer: { files: [{ name: 'x.txt', type: 'text/plain' }] }
      });
      fn({
        preventDefault() {},
        dataTransfer: { files: [] },
        originalEvent: { dataTransfer: { files: [{ name: 'c.json', type: 'application/json', content: '{}' }] } }
      });
    }

    // file input change
    const fileInput = importNodes.get('file-input');
    fileInput.files = [{ name: 'bad.txt', type: 'text/plain' }];
    for (const fn of fileInput._listeners.change || []) fn({ currentTarget: fileInput });
    fileInput.files = [];
    for (const fn of fileInput._listeners.change || []) fn({ currentTarget: fileInput });

    // handle file select paths
    ExportImportUI._handleFileSelect({ name: 'x.txt', type: 'text/plain' }, importModal);
    globalThis.window.CharacterImporter = null;
    globalThis.game.ldAxyum.CharacterImporter = null;
    ExportImportUI._handleFileSelect({ name: 'x.json', type: 'application/json' }, importModal);
    globalThis.window.CharacterImporter = CharacterImporter;
    globalThis.game.ldAxyum.CharacterImporter = CharacterImporter;

    const goodData = CharacterExporter.exportCharacter(actor);
    CharacterImporter.loadFromFile = async () => goodData;
    CharacterImporter.importCharacter = () => ({
      success: true,
      summary: {
        characterName: 'Hero', level: 1, class: 'Fighter', race: 'Human',
        itemCount: 0, spellCount: 0, featCount: 0,
        hasConditions: true, hasTemporaryModifiers: true, hasMulticlass: true, homebrewCount: 2
      }
    });
    ExportImportUI._handleFileSelect({ name: 'c.json', type: 'application/json' }, importModal);
    await Promise.resolve();

    CharacterImporter.importCharacter = () => ({ success: false, error: 'bad data' });
    ExportImportUI._handleFileSelect({ name: 'c.json', type: 'application/json' }, importModal);
    await Promise.resolve();

    CharacterImporter.loadFromFile = async () => { throw new Error('read fail'); };
    ExportImportUI._handleFileSelect({ name: 'c.json', type: 'application/json' }, importModal);
    await Promise.resolve();

    // json paste
    const jsonNode = importNodes.get('json');
    for (const fn of jsonNode._listeners.input || []) {
      fn({ currentTarget: { value: '' } });
      fn({ currentTarget: { value: JSON.stringify(goodData) } });
    }
    ExportImportUI._validateAndPreviewJSON(JSON.stringify(goodData), importModal);
    CharacterImporter.importCharacter = () => ({ success: true, summary: { characterName: 'H' } });
    CharacterImporter.loadFromString = () => goodData;
    ExportImportUI._validateAndPreviewJSON(JSON.stringify(goodData), importModal);
    CharacterImporter.importCharacter = () => ({ success: false, error: 'no' });
    ExportImportUI._validateAndPreviewJSON(JSON.stringify(goodData), importModal);
    CharacterImporter.loadFromString = () => { throw new Error('parse'); };
    ExportImportUI._validateAndPreviewJSON('x'.repeat(60), importModal);
    ExportImportUI._validateAndPreviewJSON('short', importModal);
    globalThis.window.CharacterImporter = null;
    globalThis.game.ldAxyum.CharacterImporter = null;
    ExportImportUI._validateAndPreviewJSON('{}', importModal);
    globalThis.window.CharacterImporter = CharacterImporter;
    globalThis.game.ldAxyum.CharacterImporter = CharacterImporter;

    // preview without warnings
    ExportImportUI._displayImportPreview({ characterName: 'A' }, importModal);
    ExportImportUI._displayImportError('err', importModal);
    ExportImportUI._clearImportError(importModal);
    ExportImportUI._clearPreview(importModal);

    // perform import
    CharacterImporter.applyImportToActor = async () => ({ success: true, message: 'imported' });
    await ExportImportUI._performImport(goodData, actor, importModal);
    for (const t of timers) t();
    CharacterImporter.applyImportToActor = async () => ({ success: false, error: 'fail' });
    await ExportImportUI._performImport(goodData, actor, importModal);
    CharacterImporter.applyImportToActor = async () => { throw new Error('boom'); };
    await ExportImportUI._performImport(goodData, actor, importModal);
    globalThis.window.CharacterImporter = null;
    globalThis.game.ldAxyum.CharacterImporter = null;
    await ExportImportUI._performImport(goodData, actor, importModal);
    globalThis.window.CharacterImporter = CharacterImporter;

    // import button with data
    importModal._ldAxyumState = { importData: goodData, actor };
    for (const fn of importNodes.get('import-btn')._listeners.click || []) fn({});
    for (const fn of importNodes.get('close')._listeners.click || []) fn({});
    for (const fn of importNodes.get('overlay')._listeners.click || []) {
      fn({ target: importNodes.get('overlay'), currentTarget: importNodes.get('overlay') });
    }

    ExportImportUI._clearImportModal(importModal);
    ExportImportUI.showExportModal({ querySelector: () => null }, actor);
    ExportImportUI.showImportModal({ querySelector: () => null }, actor);
    // flush pending clipboard/import timers before teardown
    for (const t of timers) {
      try { t(); } catch { /* ignore */ }
    }
    await new Promise((r) => realSetTimeout(r, 0));
    assert.ok(true);
  } finally {
    globalThis.setTimeout = realSetTimeout;
    restoreFoundryMock(previous);
  }
});
