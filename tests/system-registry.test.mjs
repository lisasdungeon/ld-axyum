import assert from 'node:assert/strict';
import test from 'node:test';
import { installFoundryMock, restoreFoundryMock } from './foundry-mock.mjs';

test('SystemRegistry lists systems, resolves Foundry availability, and handles import failures', async () => {
  const previous = installFoundryMock();
  try {
    const { SystemRegistry } = await import('../gm-hub/system-registry.js');
    const registry = new SystemRegistry();

    await registry.initialize();
    await registry.initialize(); // already initialized early-return

    const systems = await registry.getAvailableSystems();
    assert.ok(systems.length >= 5);
    const dnd = systems.find((s) => s.id === 'dnd5e');
    assert.equal(dnd.available, true);
    assert.equal(dnd.name, 'Dungeons & Dragons 5th Edition');
    assert.ok(dnd.icon);
    assert.ok(dnd.color);
    assert.ok(dnd.underglow);
    assert.ok(dnd.version);

    const got = await registry.getSystem('dnd5e');
    assert.equal(got.id, 'dnd5e');
    assert.equal(await registry.getSystem('missing'), null);

    // Active world system id match
    assert.equal(registry.isFoundrySystemAvailable('dnd5e'), true);

    // Fallback via game.systems.get when active id differs
    globalThis.game.system = { id: 'other' };
    globalThis.game.systems = {
      get: (id) => (id === 'pf2e' ? { id: 'pf2e' } : null)
    };
    assert.equal(registry.isFoundrySystemAvailable('pf2e'), true);
    assert.equal(registry.isFoundrySystemAvailable('coc7'), false);

    // Missing / non-Map systems collection
    globalThis.game.systems = null;
    assert.equal(registry.isFoundrySystemAvailable('coc7'), false);
    globalThis.game.systems = {};
    assert.equal(registry.isFoundrySystemAvailable('coc7'), false);

    // Import failure path registers placeholder
    const failing = new SystemRegistry();
    const realImport = failing._importSystemConfig.bind(failing);
    failing._importSystemConfig = async (systemId) => {
      if (systemId === 'bitd') throw new Error('config boom');
      return realImport(systemId);
    };
    await failing.initialize();
    const placeholder = await failing.getSystem('bitd');
    assert.equal(placeholder.available, false);
    assert.match(placeholder.name, /BITD/);
    assert.match(placeholder.description, /loading/i);

    // Config module without matching export is skipped (no throw)
    const empty = new SystemRegistry();
    empty._importSystemConfig = async () => ({ unrelated: true });
    await empty.initialize();
    assert.equal(empty.systems.size, 0);

    // Config without requiredFoundrySystem treats Foundry as available
    const noReq = new SystemRegistry();
    noReq._importSystemConfig = async (systemId) => ({
      [`${systemId}Config`]: {
        id: systemId,
        name: systemId,
        available: true
      }
    });
    await noReq.initialize();
    assert.equal((await noReq.getSystem('dnd5e')).available, true);
  } finally {
    restoreFoundryMock(previous);
  }
});
