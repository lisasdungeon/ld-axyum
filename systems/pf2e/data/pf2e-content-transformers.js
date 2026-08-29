/**
 * PF2e content transformers - turn raw Foundry item index/document entries
 * into the plain objects the wizard consumes. Independent of
 * core/content-transformers.js (dnd5e-shaped).
 *
 * PF2e ancestry/heritage boost & flaw data is commonly stored as an object
 * keyed by slot index (e.g. `{0: {value: ['cha']}, 1: {value: ['free']}}`)
 * rather than a flat array. These helpers accept either shape defensively —
 * verify against real compendium data during wizard testing and simplify
 * once confirmed.
 */

function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Normalize a boosts/flaws field into a flat array of ability keys ('free' allowed). */
function normalizeBoostList(field) {
  if (!field) return [];
  if (Array.isArray(field)) return field.filter(Boolean);
  if (typeof field === 'object') {
    return Object.values(field)
      .flatMap((slot) => (Array.isArray(slot?.value) ? slot.value : (slot?.value ? [slot.value] : [])))
      .filter(Boolean);
  }
  return [];
}

export function AncestryTransformer(item, packName, metadata = null) {
  const sys = item.system || {};
  return {
    id: item.id,
    packName,
    name: item.name,
    img: item.img,
    hp: Number(sys.hp) || 0,
    size: sys.size || 'med',
    speed: Number(sys.speed) || 25,
    boosts: normalizeBoostList(sys.boosts),
    flaws: normalizeBoostList(sys.flaws),
    traits: sys.traits?.value || sys.traits || [],
    description: stripHtml(sys.description?.value || sys.description)
  };
}

export function HeritageTransformer(item, packName) {
  const sys = item.system || {};
  return {
    id: item.id,
    packName,
    name: item.name,
    img: item.img,
    ancestryId: sys.ancestry?.slug || sys.ancestry?.value || sys.ancestry || null,
    traits: sys.traits?.value || sys.traits || [],
    description: stripHtml(sys.description?.value || sys.description)
  };
}

export function BackgroundTransformer(item, packName) {
  const sys = item.system || {};
  const boosts = normalizeBoostList(sys.boosts);
  return {
    id: item.id,
    packName,
    name: item.name,
    img: item.img,
    boosts,
    trainedSkill: sys.trainedSkills?.value?.[0] || sys.trainedSkill || '',
    loreSkill: sys.trainedLore || '',
    description: stripHtml(sys.description?.value || sys.description)
  };
}

export function ClassTransformer(item, packName) {
  const sys = item.system || {};
  return {
    id: item.id,
    packName,
    name: item.name,
    img: item.img,
    hpPerLevel: Number(sys.hp) || 8,
    keyAbility: sys.keyAbility?.value?.[0] || (Array.isArray(sys.keyAbility) ? sys.keyAbility[0] : sys.keyAbility) || '',
    keyAbilityOptions: sys.keyAbility?.value || (Array.isArray(sys.keyAbility) ? sys.keyAbility : []),
    classDC: sys.classDC?.rank ?? 'trained',
    spellcasting: sys.spellcasting || null,
    description: stripHtml(sys.description?.value || sys.description)
  };
}

const FEAT_CATEGORIES = ['ancestry', 'class', 'skill', 'general', 'bonus'];

export function FeatTransformer(item, packName) {
  const sys = item.system || {};
  const rawCategory = String(sys.category || '').toLowerCase();
  const category = FEAT_CATEGORIES.includes(rawCategory) ? rawCategory : 'bonus';
  return {
    id: item.id,
    packName,
    name: item.name,
    img: item.img,
    category,
    level: Number(sys.level?.value ?? sys.level) || 1,
    traits: sys.traits?.value || sys.traits || [],
    prerequisites: (sys.prerequisites?.value || []).map((p) => p?.value || p).filter(Boolean),
    description: stripHtml(sys.description?.value || sys.description)
  };
}

export function SpellTransformer(item, packName) {
  const sys = item.system || {};
  const traits = sys.traits?.value || sys.traits || [];
  // pf2e stores cantrips as rank/level 1 items tagged with a "cantrip" trait —
  // there is no literal rank 0 in the source data, so it has to be derived here.
  const isCantrip = traits.includes('cantrip');
  const numericRank = Number(sys.rank?.value ?? sys.level?.value ?? sys.rank ?? sys.level) || 0;
  return {
    id: item.id,
    packName,
    name: item.name,
    img: item.img,
    rank: isCantrip ? 0 : numericRank,
    traits,
    traditions: sys.traits?.traditions || [],
    description: stripHtml(sys.description?.value || sys.description)
  };
}

export function EquipmentTransformer(item, packName) {
  const sys = item.system || {};
  return {
    id: item.id,
    packName,
    name: item.name,
    img: item.img,
    type: item.type,
    bulk: sys.bulk?.value ?? sys.bulk ?? 0,
    price: sys.price?.value ?? sys.price ?? { gp: 0 },
    category: sys.category || sys.group || '',
    dexCap: Number.isFinite(sys.dexCap?.value) ? sys.dexCap.value : (Number.isFinite(sys.dexCap) ? sys.dexCap : null),
    description: stripHtml(sys.description?.value || sys.description)
  };
}
