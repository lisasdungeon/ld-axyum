/**
 * Parse dnd5e / PHB class system.startingEquipment into selectable packages.
 * Structure (from dnd-players-handbook):
 *  - Top-level OR with AND children → Package A / B
 *  - Top-level AND → single "Starting Gear" package
 *  - Nested OR → in-package choice groups
 */

function itemIdFromKey(key) {
  if (!key || typeof key !== 'string') return null;
  const parts = key.split('.');
  return parts[parts.length - 1] || null;
}

function prettyItemName(key) {
  const id = itemIdFromKey(key) || '';
  // phbwepGreataxe00 → Greataxe, phbagExplorersPa → Explorers Pack
  let raw = id.replace(/^phb(wep|arm|bag|amo|afc|tool)?/i, '');
  raw = raw.replace(/0+$/, '');
  raw = raw.replace(/([a-z])([A-Z])/g, '$1 $2');
  return raw.trim() || id || 'Item';
}

export function resolveEquipmentEntry(entry, equipmentIndex = []) {
  const key = entry?.key || '';
  const id = itemIdFromKey(key);
  const fromCache = equipmentIndex.find((e) => e.id === id)
    || equipmentIndex.find((e) => key && String(e.packName) && key.includes(e.id));

  const name = fromCache?.name || prettyItemName(key);
  const count = entry?.count > 0 ? entry.count : 1;
  return {
    id: id || entry?._id || key,
    key,
    name,
    count,
    type: fromCache?.type || entry?.type || 'item',
    price: fromCache?.price ?? null,
    rarity: fromCache?.rarity || null,
    weight: fromCache?.weight ?? null,
    description: fromCache?.description || '',
    img: fromCache?.img || null,
    requiresProficiency: !!entry?.requiresProficiency
  };
}

function collectLinked(entries, groupId, equipmentIndex) {
  return entries
    .filter((e) => e.group === groupId && (e.type === 'linked' || e.type === 'focus' || e.type === 'weapon' || e.type === 'armor'))
    .sort((a, b) => (a.sort || 0) - (b.sort || 0))
    .map((e) => {
      if (e.type === 'focus') {
        return {
          id: e._id || `focus-${e.key || 'focus'}`,
          key: e.key || 'focus',
          name: `Focus (${e.key || 'holy'})`,
          count: 1,
          type: 'focus',
          description: 'Spellcasting focus',
          requiresProficiency: false
        };
      }
      return resolveEquipmentEntry(e, equipmentIndex);
    });
}

function buildChoiceGroups(entries, parentGroupId, equipmentIndex) {
  const ors = entries.filter((e) => e.type === 'OR' && e.group === parentGroupId);
  return ors.map((orNode, idx) => {
    const options = entries
      .filter((e) => e.group === orNode._id && e.type === 'linked')
      .sort((a, b) => (a.sort || 0) - (b.sort || 0))
      .map((e) => resolveEquipmentEntry(e, equipmentIndex));
    return {
      id: orNode._id || `choice-${idx}`,
      label: `Choice ${idx + 1}`,
      options
    };
  });
}

function buildPackageFromAnd(andNode, entries, equipmentIndex, label) {
  const items = collectLinked(entries, andNode._id, equipmentIndex);
  const choices = buildChoiceGroups(entries, andNode._id, equipmentIndex);
  // Also include linked items whose group is the AND's parent when AND is nested? handled by collectLinked on andNode._id
  return {
    id: andNode._id,
    label,
    items,
    choices
  };
}

/**
 * @param {Array} startingEquipment - class.system.startingEquipment
 * @param {Array} equipmentIndex - loaded equipment options for name/info lookup
 * @returns {{ packages: Array, mode: 'packages'|'single'|'empty' }}
 */
export function buildStartingPackages(startingEquipment, equipmentIndex = []) {
  const entries = Array.isArray(startingEquipment) ? startingEquipment : [];
  if (!entries.length) return { packages: [], mode: 'empty' };

  const topOr = entries.filter((e) => e.type === 'OR' && !e.group);
  const topAnd = entries.filter((e) => e.type === 'AND' && !e.group);

  if (topOr.length === 1) {
    const orRoot = topOr[0];
    const andChildren = entries
      .filter((e) => e.type === 'AND' && e.group === orRoot._id)
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));

    if (andChildren.length >= 2) {
      const packages = andChildren.map((andNode, i) =>
        buildPackageFromAnd(andNode, entries, equipmentIndex, `Package ${String.fromCharCode(65 + i)}`)
      );
      return { packages, mode: 'packages' };
    }

    // OR of linked items directly
    const options = entries
      .filter((e) => e.group === orRoot._id && e.type === 'linked')
      .map((e) => resolveEquipmentEntry(e, equipmentIndex));
    if (options.length) {
      return {
        mode: 'packages',
        packages: options.map((opt, i) => ({
          id: opt.id || `opt-${i}`,
          label: `Option ${String.fromCharCode(65 + i)}`,
          items: [{ ...opt }],
          choices: []
        }))
      };
    }
  }

  if (topAnd.length >= 1) {
    const packages = topAnd.map((andNode, i) =>
      buildPackageFromAnd(
        andNode,
        entries,
        equipmentIndex,
        topAnd.length === 1 ? 'Starting Gear' : `Package ${String.fromCharCode(65 + i)}`
      )
    );
    return { packages, mode: packages.length > 1 ? 'packages' : 'single' };
  }

  // Fallback: treat all linked entries as one flat package
  const linked = entries.filter((e) => e.type === 'linked').map((e) => resolveEquipmentEntry(e, equipmentIndex));
  if (!linked.length) return { packages: [], mode: 'empty' };
  return {
    mode: 'single',
    packages: [{ id: 'flat', label: 'Starting Gear', items: linked, choices: [] }]
  };
}

export function resolveSelectedPackageItems(pkg, choiceSelections = {}) {
  if (!pkg) return [];
  const items = [...(pkg.items || [])];
  for (const choice of pkg.choices || []) {
    const selectedId = choiceSelections[choice.id];
    const picked = (choice.options || []).find((o) => o.id === selectedId) || choice.options?.[0];
    if (picked) items.push(picked);
  }
  return items;
}
