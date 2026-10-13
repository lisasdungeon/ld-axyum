import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

test('system configs expose lazy loaders for heavy modules', async () => {
  const previous = installFoundryMock();
  try {
    const { dnd5eConfig } = await import('../systems/dnd5e/config.js');
    assert.equal(dnd5eConfig.wizardClass, null);
    const DndWizard = await dnd5eConfig.loadWizardClass();
    assert.equal(typeof DndWizard, 'function');

    const { pf2eConfig } = await import('../systems/pf2e/config.js');
    assert.equal(pf2eConfig.wizardClass, null);
    const Pf2eWizard = await pf2eConfig.loadWizardClass();
    assert.equal(typeof Pf2eWizard, 'function');
    const Rules = await pf2eConfig.loadRulesEngine();
    assert.equal(typeof Rules, 'function');
    const Model = await pf2eConfig.loadCharacterModel();
    assert.equal(typeof Model, 'function');
    const Adapter = await pf2eConfig.loadActorAdapter();
    assert.equal(typeof Adapter, 'function');
  } finally {
    restoreFoundryMock(previous);
  }
});
