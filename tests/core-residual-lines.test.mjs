import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

test('residual choice and prepareContext lines hit 100%', async () => {
  const previous = installFoundryMock();
  try {
    const { AxyumActionHandlersChoices } = await import('../core/axyum-action-handlers-choices.js');
    class Base {
      render() { this.rendered = true; }
      _actionEl(_e, t) { return t; }
      _featSlotsAvailable() { return this._slots; }
      _buildStartingEquipmentView() {
        return {
          packages: [{
            id: 'pkgNew',
            choices: [{ id: 'ch1', options: [{ id: 'opt1' }] }]
          }]
        };
      }
    }
    const Cls = AxyumActionHandlersChoices(Base);
    const inst = new Cls();
    inst._slots = 2;
    inst.characterData = {
      feats: ['Alert', 'Tough'],
      chooseASI: false,
      startingPackageId: 'oldPkg',
      startingPackageChoices: { ch1: 'x' },
      selectedEquipmentIds: [],
      proficiencies: { languages: [] }
    };
    // used (2) >= slots (2) — cannot add third feat
    const warns = [];
    globalThis.ui.notifications.warn = (m) => warns.push(m);
    inst.onToggleFeat({}, { dataset: { featName: 'Mobile' }, disabled: false, hasAttribute: () => false });
    assert.equal(inst.characterData.feats.length, 2);
    assert.ok(warns.some((m) => /feat/i.test(String(m))));
    // success path: under slot limit pushes name (list.push)
    inst._slots = 3;
    inst.characterData.chooseASI = false;
    inst.characterData.feats = ['Alert'];
    inst.onToggleFeat({}, { dataset: { featName: 'Tough' }, disabled: false, hasAttribute: () => false });
    assert.ok(inst.characterData.feats.includes('Tough'));
    // also chooseASI counts toward used
    inst.characterData.chooseASI = true;
    inst.characterData.feats = ['Alert'];
    inst._slots = 2;
    inst.onToggleFeat({}, { dataset: { featName: 'Mobile' }, disabled: false, hasAttribute: () => false });
    assert.equal(inst.characterData.feats.length, 1);

    // packageId mismatch resets choices (41-43)
    inst.onSelectPackageChoice({ stopPropagation() {} }, {
      dataset: { packageId: 'pkgNew', choiceId: 'ch1', optionId: 'opt1' }
    });
    assert.equal(inst.characterData.startingPackageId, 'pkgNew');

    const { AxyumApp } = await import('../core/axyum-app.js');
    AxyumApp.invalidateContentCache();
    globalThis.game.ldAxyum = {
      compendiumLoader: {
        cache: { classes: [], races: [], backgrounds: [], spells: [], equipment: [], feats: [] },
        loadAllContent: async () => ({})
      }
    };
    globalThis.game.packs = Object.assign([], { size: 0 });
    const app = new AxyumApp({ mode: 'create' });
    app.render = async () => app;
    // force cache promise rejection path (102)
    AxyumApp.invalidateContentCache();
    const boom = Promise.reject(new Error('cache boom'));
    boom.catch(() => {});
    AxyumApp._cachePromise = boom;
    await app._prepareContext({});
    // seed and hit assignment branch 109-112
    AxyumApp._cachedOptions = {
      classes: [], races: [], backgrounds: [], spells: [], equipment: [], feats: [], abilities: []
    };
    await app._prepareContext({});
    assert.equal(app._contentLoading, false);
  } finally {
    restoreFoundryMock(previous);
  }
});
