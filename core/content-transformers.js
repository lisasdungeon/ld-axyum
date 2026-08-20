/**
 * Content Transformers - Transform loaded items into wizard formats
 */

import { extractSource, isHomebrewSource } from './content-loader.js';

function stripHtml(value, max = 180) {
  return String(value || '')
    .replace(/@UUID\[[^\]]*\]\{[^}]*\}/gi, '')
    .replace(/@UUID\[[^\]]*\]/gi, '')
    .replace(/@Compendium\[[^\]]*\]\{[^}]*\}/gi, '')
    .replace(/@Compendium\[[^\]]*\]/gi, '')
    .replace(/@Embed\[[^\]]*\]\{[^}]*\}/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function formatSkillList(skills) {
  if (!skills) return [];
  if (Array.isArray(skills)) {
    return skills.map((s) => {
      if (typeof s === 'string') return s;
      return s?.label || s?.name || (typeof s?.value === 'string' ? s.value : '') || '';
    }).filter(Boolean);
  }
  if (typeof skills === 'object') {
    return Object.keys(skills).map((k) => k.replace(/([a-z])([A-Z])/g, '$1 $2'));
  }
  return [];
}

const SKILL_ABBR_MAP = {
  acr: 'Acrobatics', ani: 'Animal Handling', arc: 'Arcana', ath: 'Athletics',
  dec: 'Deception', his: 'History', ins: 'Insight', itm: 'Intimidation',
  inv: 'Investigation', med: 'Medicine', nat: 'Nature', prc: 'Perception',
  prf: 'Performance', per: 'Persuasion', rel: 'Religion', slt: 'Sleight of Hand',
  ste: 'Stealth', sur: 'Survival'
};

/** Modern (PHB 2024) background items grant skills via Trait advancement, not system.skills. */
function skillsFromTraitAdvancement(advancement) {
  const out = [];
  for (const adv of advancement || []) {
    if (adv?.type !== 'Trait') continue;
    for (const grant of adv?.configuration?.grants || []) {
      const gs = String(grant);
      if (gs.startsWith('skills:')) {
        const abbr = gs.replace('skills:', '');
        out.push(SKILL_ABBR_MAP[abbr] || abbr);
      }
    }
  }
  return out;
}

function baseFields(doc, packName, metadata, type) {
  const source = extractSource(packName, metadata, doc.system);
  return {
    id: doc.id,
    packName,
    name: doc.name,
    type,
    source,
    isHomebrew: isHomebrewSource(packName, source),
    img: doc.img || null,
    description: stripHtml(doc.system?.description?.value || doc.system?.description?.chat || '')
  };
}

function formatSaves(saves) {
  if (!saves) return [];
  if (Array.isArray(saves)) {
    return saves.map((s) => String(s).toUpperCase()).filter(Boolean);
  }
  if (typeof saves === 'object') {
    return Object.entries(saves)
      .filter(([, v]) => !!v)
      .map(([k]) => String(k).toUpperCase());
  }
  return [];
}

function formatSize(size) {
  const map = {
    tiny: 'Tiny', sm: 'Small', small: 'Small', med: 'Medium', medium: 'Medium',
    lg: 'Large', large: 'Large', huge: 'Huge', grg: 'Gargantuan'
  };
  if (Array.isArray(size)) {
    return size.map((s) => map[String(s).toLowerCase()] || String(s)).join(' / ');
  }
  return map[String(size || 'med').toLowerCase()] || String(size || 'Medium');
}

function extractDarkvision(traits, movement, topLevelSenses) {
  const senses = topLevelSenses || traits?.senses || movement?.senses || {};
  const own = Object.getOwnPropertyDescriptor(senses, 'darkvision');
  const dv = senses.ranges?.darkvision
    ?? senses.value?.darkvision
    ?? (own && 'value' in own ? own.value : undefined)
    ?? traits?.darkvision;
  if (dv == null || dv === false) return null;
  const n = Number(dv);
  return Number.isFinite(n) && n > 0 ? `${n} ft darkvision` : 'Darkvision';
}

/** Modern (PHB 2024) species items grant size via a Size advancement, not system.traits.size. */
function sizeFromAdvancement(advancement) {
  const sizeAdv = (advancement || []).find((a) => a?.type === 'Size');
  return sizeAdv?.configuration?.sizes || [];
}

export const ClassTransformer = {
  transform(doc, packName, metadata = null) {
    const progression = doc.system?.spellcasting?.progression;
    const spellcasting =
      typeof progression === 'string' && progression && progression !== 'none'
        ? progression
        : null;
    const hitDice = doc.system?.hitDice || doc.system?.hp?.denomination || 'd8';
    const saves = formatSaves(doc.system?.saves);
    const primary = doc.system?.primaryAbility;
    let primaryAbility = null;
    if (Array.isArray(primary)) primaryAbility = primary.map((a) => String(a).toUpperCase()).join(', ');
    else if (primary && typeof primary === 'object') {
      primaryAbility = Object.keys(primary).map((a) => a.toUpperCase()).join(', ');
    } else if (primary) primaryAbility = String(primary).toUpperCase();

    return {
      ...baseFields(doc, packName, metadata, 'class'),
      hitDice,
      spellcasting,
      spellcastingLabel: spellcasting
        ? `${String(spellcasting).charAt(0).toUpperCase()}${String(spellcasting).slice(1)} caster`
        : 'Martial',
      saves,
      savesLabel: saves.length ? saves.join(', ') : '—',
      primaryAbility,
      skills: doc.system?.skills || null,
      startingEquipment: Array.isArray(doc.system?.startingEquipment)
        ? doc.system.startingEquipment
        : []
    };
  }
};

export const RaceTransformer = {
  transform(doc, packName, metadata = null) {
    const sizeCodes = sizeFromAdvancement(doc.system?.advancement);
    const sizeRaw = sizeCodes[0] || doc.system?.traits?.size || 'med';
    const sizeLabel = sizeCodes.length ? sizeCodes.map(formatSize).join(' or ') : formatSize(sizeRaw);
    const speed = doc.system?.movement?.walk || 30;
    const darkvision = extractDarkvision(doc.system?.traits, doc.system?.movement, doc.system?.senses);
    return {
      ...baseFields(doc, packName, metadata, 'race'),
      abilityBoosts: doc.system?.advancement || null,
      size: sizeRaw,
      sizeLabel,
      speed,
      speedLabel: `${speed} ft`,
      darkvision,
      traitsLabel: [sizeLabel, `${speed} ft`, darkvision].filter(Boolean).join(' · ')
    };
  }
};

export const BackgroundTransformer = {
  transform(doc, packName, metadata = null) {
    // doc.system.skills only exists on older/SRD-style content; modern (PHB 2024)
    // backgrounds grant skills via a Trait advancement instead.
    const directSkills = formatSkillList(doc.system?.skills);
    const skills = directSkills.length ? directSkills : skillsFromTraitAdvancement(doc.system?.advancement);
    return {
      ...baseFields(doc, packName, metadata, 'background'),
      skills,
      skillsLabel: skills.length ? skills.join(', ') : 'Skill grants vary',
      languages: doc.system?.languages || null,
      equipment: doc.system?.startingEquipment || null
    };
  }
};

export const SpellTransformer = {
  transform(doc, packName, metadata = null) {
    const props = doc.system?.properties;
    const hasProp = (key) => {
      if (!props) return false;
      if (props instanceof Set) return props.has(key);
      if (Array.isArray(props)) return props.includes(key);
      return !!props[key];
    };

    const classList = doc.system?.classes
      || doc.system?.availableIn
      || doc.system?.activation?.condition
      || [];
    let classes = [];
    if (Array.isArray(classList)) {
      classes = classList.map((c) => (typeof c === 'string' ? c : c?.name || c?.value || '')).filter(Boolean);
    } else if (classList && typeof classList === 'object') {
      classes = Object.keys(classList);
    }

    return {
      ...baseFields(doc, packName, metadata, 'spell'),
      level: doc.system?.level ?? 0,
      school: doc.system?.school || 'evo',
      components: doc.system?.components || {},
      ritual: hasProp('ritual'),
      concentration: hasProp('concentration'),
      classes,
      description: stripHtml(doc.system?.description?.value || '', 160)
    };
  }
};

export const EquipmentTransformer = {
  transform(doc, packName, metadata = null) {
    return {
      ...baseFields(doc, packName, metadata, doc.type),
      equipmentType: doc.system?.type?.value || doc.type,
      rarity: doc.system?.rarity || 'common',
      weight: doc.system?.weight?.value ?? doc.system?.weight ?? 0,
      price: doc.system?.price?.value ?? doc.system?.price ?? 0,
      description: stripHtml(doc.system?.description?.value || '', 140)
    };
  }
};

export const FeatTransformer = {
  transform(doc, packName, metadata = null) {
    const req = doc.system?.requirements || doc.system?.prerequisites?.items || null;
    const blurb = stripHtml(doc.system?.description?.value || '', 160);
    return {
      ...baseFields(doc, packName, metadata, 'feat'),
      requirements: req,
      prerequisites: Array.isArray(req) ? req : (req ? [String(req)] : []),
      blurb,
      requiresLevel: doc.system?.prerequisites?.level || null
    };
  }
};
