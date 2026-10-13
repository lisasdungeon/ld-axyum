# Homebrew Content Guide
**LD Axyum D&D 5e Character Creation System**  
Comprehensive guide for using custom homebrew content (classes, races, spells, feats, equipment) in character creation.
---
## Table of Contents
1. Overview
2. Supported Content Types
3. Creating Homebrew Content
4. Content Validation
5. Integration with Character Creation
6. Advanced Configuration
7. Troubleshooting
---
## Overview
LD Axyum integrates seamlessly with Foundry VTT's homebrew content system. When you enable homebrew modules, custom content from those modules is automatically detected, validated, and merged with official D&D 5e Player's Handbook content.
### Key Features
- **Automatic Detection**: Homebrew content is automatically discovered from enabled modules
- **Source Attribution**: All homebrew content is clearly tagged with its source module
- **Deduplication**: Duplicate content (same name) prioritizes official content
- **Validation**: All homebrew content is validated before integration
- **Seamless Integration**: Homebrew appears naturally alongside official content in character creation
---
## Supported Content Types
LD Axyum supports the following homebrew content types:
### 1. Classes
**Required Fields:**
- `name` (string) - Unique class name
- `hitDice` (string) - Hit die (e.g., 'd8', 'd10')
**Optional Fields:**
- `abilities` (array) - Class abilities by level
- `spellcasting` (object) - Spellcasting rules
- `source` (string) - Attribution (auto-generated from module name)
**Example:**
```json
{
  "name": "Mystic",
  "hitDice": "d8",
  "abilities": [
    { "level": 1, "name": "Psion's Aptitude", "description": "..." }
  ],
  "source": "MYSTIC OVERHAUL"
}
```
### 2. Races
**Required Fields:**
- `name` (string) - Unique race name
**Optional Fields:**
- `abilityBoosts` (object) - Ability score increases
- `size` (string) - Creature size (Small, Medium, etc.)
- `speed` (number) - Movement speed in feet
- `traits` (array) - Racial traits
- `source` (string) - Attribution
**Example:**
```json
{
  "name": "Genasi (Custom)",
  "abilityBoosts": {
    "str": 2,
    "con": 1
  },
  "size": "Medium",
  "speed": 30,
  "traits": [
    { "name": "Elemental Affinity", "description": "..." }
  ],
  "source": "ELEMENTAL ORIGINS"
}
```
### 3. Spells
**Required Fields:**
- `name` (string) - Unique spell name
- `level` (number) - Spell level (0-9)
**Optional Fields:**
- `school` (string) - Spell school (Abjuration, Evocation, etc.)
- `castingTime` (string) - Time to cast
- `range` (string) - Spell range
- `components` (object) - V, S, M components
- `duration` (string) - Spell duration
- `concentration` (boolean) - Requires concentration
- `source` (string) - Attribution
**Example:**
```json
{
  "name": "Prismatic Blade",
  "level": 5,
  "school": "Evocation",
  "castingTime": "1 action",
  "range": "Self",
  "components": {
    "v": true,
    "s": true
  },
  "duration": "1 minute",
  "concentration": true,
  "source": "SPELLSMITH'S COMPENDIUM"
}
```
### 4. Feats
**Required Fields:**
- `name` (string) - Unique feat name
**Optional Fields:**
- `prerequisites` (array) - Ability or level prerequisites
- `minimumLevel` (number) - Character level requirement
- `description` (string) - Feat description
- `benefits` (object) - Mechanical benefits
- `source` (string) - Attribution
**Example:**
```json
{
  "name": "Blade Dancer",
  "prerequisites": [
    { "ability": "dex", "minimumScore": 13 }
  ],
  "minimumLevel": 4,
  "description": "You learn to dance with blades...",
  "benefits": {
    "acBonus": 1,
    "damageBonus": "1d4"
  },
  "source": "MARTIAL TRADITIONS"
}
```
### 5. Equipment
**Required Fields:**
- `name` (string) - Unique item name
**Optional Fields:**
- `type` (string) - Equipment type (weapon, armor, adventuring-gear, etc.)
- `rarity` (string) - Item rarity (Common, Uncommon, Rare, etc.)
- `weight` (number) - Weight in pounds
- `cost` (string) - Purchase cost
- `properties` (object) - Item properties and bonuses
- `source` (string) - Attribution
**Example:**
```json
{
  "name": "Arcane Focus Staff",
  "type": "weapon",
  "rarity": "Uncommon",
  "weight": 4,
  "cost": "25 gp",
  "properties": {
    "spellAttackBonus": 1
  },
  "source": "ARCANE ARTIFICER'S FORGE"
}
```
---
## Creating Homebrew Content
### Step 1: Create a Foundry VTT Module
Homebrew content is packaged as Foundry VTT modules. You can create a custom module by:
1. Creating a folder in your Foundry modules directory
2. Creating a `module.json` manifest file
3. Adding your custom content packs
**Example `module.json`:**
```json
{
  "id": "my-custom-content",
  "title": "My Custom Content",
  "description": "Custom classes and spells for D&D 5e",
  "version": "1.0.0",
  "compatibility": {
    "minimum": "12.0",
    "verified": "12.3"
  },
  "packs": [
    {
      "label": "Custom Classes",
      "type": "Item",
      "name": "custom-classes",
      "path": "packs/custom-classes.db"
    }
  ]
}
```
### Step 2: Create Content Packs
LD Axyum looks for Foundry compendium packs (`.db` files) within your module. Pack names should follow the pattern: `{module-id}.{content-type}`
**Valid pack names:**
- `my-custom-content.classes`
- `my-custom-content.races`
- `my-custom-content.spells`
- `my-custom-content.feats`
- `my-custom-content.equipment`
### Step 3: Add Items to Your Packs
Use the Foundry VTT UI or JSON to add items to your compendium packs. Each item must have:
- A unique name
- Required fields for its content type (see Supported Content Types)
- Proper JSON structure
---
## Content Validation
All homebrew content is automatically validated when LD Axyum loads. The validation process checks:
### Validation Checks
| Content Type | Validation Rules |
|---|---|
| **Classes** | Name required, hitDice required (d6-d12) |
| **Races** | Name required |
| **Spells** | Name required, level required (0-9) |
| **Feats** | Name required |
| **Equipment** | Name required |
### Handling Validation Errors
If validation errors occur:
1. **Check the browser console** (F12 Developer Tools) for detailed error messages
2. **Review required fields** for each content type
3. **Verify JSON syntax** - use a JSON validator if needed
4. **Check for duplicate names** - LD Axyum uses names to identify items
**Example Error Message:**
```
Homebrew Validation Error:
- Class "Mystic" missing required field: hitDice
- Spell "Arcane Bolt" invalid level: 10 (must be 0-9)
```
---
## Integration with Character Creation
### Enabling Homebrew Content
Homebrew content from enabled modules is automatically integrated into character creation. No additional configuration needed.
### Using Homebrew in Character Creation
1. **Classes Page**: Homebrew classes appear alongside official classes
   - Source badge shows module name (e.g., "MYSTIC OVERHAUL")
   - Homebrew classes may have different progression than official classes
2. **Races Page**: Homebrew races appear alphabetically sorted
   - Ability adjustments are calculated automatically
   - Custom racial traits are stored in character data
3. **Spells Page**: Homebrew spells appear in spell lists
   - Spell lists include official + homebrew spells
   - Search and filtering work across all spell types
4. **Feats Page**: Homebrew feats appear in feat selection
   - Level requirements are respected
   - Prerequisites are validated during selection
5. **Equipment Page**: Homebrew equipment appears in equipment lists
   - Weapon properties are preserved
   - Armor class calculations include custom armor
### Source Attribution
All homebrew content displays source information:
- **Official Content**: Marked as "PHB" (Player's Handbook)
- **Homebrew Content**: Shows module name (e.g., "MYSTIC OVERHAUL")
- **Color Coding**: Source badges use different colors for visual distinction
---
## Advanced Configuration
### Module Source Names
LD Axyum automatically extracts module names for source attribution:
| Module ID | Source Display |
|---|---|
| `mystic-overhaul` | MYSTIC OVERHAUL |
| `my-custom-spells` | MY CUSTOM SPELLS |
| `dnd5e-expanded` | DND5E EXPANDED |
To customize the source name, add `displayName` to your module's `module.json`:
```json
{
  "id": "my-custom-content",
  "title": "My Custom Content",
  "displayName": "CUSTOM SOURCE NAME",
  ...
}
```
### Filtering Homebrew Content
You can configure which homebrew modules are loaded:
1. Open LD Axyum settings
2. Go to Homebrew Content section
3. Toggle modules on/off to enable/disable their content
### Content Priority
When deduplication occurs (same item name exists in official + homebrew):
1. **Official content takes priority** (appears first in lists)
2. **Homebrew content is hidden** (not removed, just deprioritized)
3. **Source attribution preserved** for reference
---
## Troubleshooting
### Common Issues
#### 1. Homebrew Content Not Appearing
**Cause**: Module not enabled or content not properly packaged
**Solution**:
- Verify module is enabled in Foundry
- Check module contains valid compendium packs
- Review browser console (F12) for errors
- Verify pack names match pattern: `{module-id}.{type}`
#### 2. Content Appears Twice
**Cause**: Same item in both official and homebrew
**Solution**:
- This is expected behavior with deduplication
- Official version will appear, homebrew hidden
- Rename homebrew item to differentiate if needed
#### 3. Validation Errors
**Cause**: Missing required fields or invalid values
**Solution**:
- Check required fields for content type
- Verify JSON syntax is valid
- Use browser console to see detailed error messages
- Cross-reference this guide for required fields
#### 4. Custom Content Not Merged
**Cause**: Homebrew detection failed or modules not in correct format
**Solution**:
- Verify module has `packs` array in `module.json`
- Verify pack `name` matches expected format
- Check module file paths are accessible
- Reload world or restart Foundry
### Debug Commands
To troubleshoot homebrew loading, use these commands in browser console (F12):
```javascript
// List all detected homebrew packs
const packs = CompendiumLoader.detectHomebrewPacks();
console.log('Detected packs:', packs);
// Load and validate homebrew
const loader = new CompendiumLoader();
const homebrew = await loader.loadHomebrewContent();
console.log('Loaded homebrew:', homebrew);
// Check validation
const validation = loader.validateHomebrewContent(homebrew);
console.log('Validation result:', validation);
```
### Getting Help
For additional help:
1. Check the [LD Axyum README](../README.md)
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details
3. Check browser console (F12) for error messages
4. Enable debug logging in LD Axyum settings
---
## Best Practices
### Content Organization
- **One module per content set**: Create a module for each thematic group of content
- **Consistent naming**: Use clear, descriptive names for items
- **Clear descriptions**: Provide detailed descriptions for complex items
- **Balanced progression**: Ensure homebrew classes have progression similar to official classes
### Quality Standards
- **Test thoroughly**: Create a test character using each homebrew item
- **Balance with official**: Compare homebrew to official content for balance
- **Clear prerequisites**: Specify level and ability requirements clearly
- **Complete metadata**: Include all optional fields for better presentation
### Performance
- **Limit module size**: Keep compendium packs under 1000 items each
- **Lazy load content**: Only include enabled modules in character creation
- **Cache results**: LD Axyum caches homebrew content automatically
- **Monitor console**: Watch for warnings about slow operations
---
## Examples
### Complete Custom Class Example
```json
{
  "name": "Mystic",
  "hitDice": "d8",
  "abilities": [
    {
      "level": 1,
      "name": "Psion's Aptitude",
      "description": "You can cast psion spells..."
    },
    {
      "level": 3,
      "name": "Enhanced Psionics",
      "description": "Your psionic powers grow stronger..."
    }
  ],
  "source": "MYSTIC OVERHAUL",
  "isHomebrew": true
}
```
### Complete Custom Feat Example
```json
{
  "name": "Blade Dancer",
  "prerequisites": [
    {
      "ability": "dexterity",
      "minimumScore": 13
    }
  ],
  "minimumLevel": 4,
  "description": "You learn to dance with blades, gaining the following benefits:",
  "benefits": {
    "acBonus": 1,
    "damageBonus": "+1d4",
    "specialAttack": "Blade Dance action"
  },
  "source": "MARTIAL TRADITIONS",
  "isHomebrew": true
}
```
### Complete Custom Spell Example
```json
{
  "name": "Prismatic Blade",
  "level": 5,
  "school": "Evocation",
  "castingTime": "1 action",
  "range": "Self",
  "components": {
    "verbal": true,
    "somatic": true,
    "material": "A weapon worth at least 50 gp"
  },
  "duration": "Concentration, up to 1 minute",
  "concentration": true,
  "description": "A weapon you hold becomes surrounded by 7 magical colors...",
  "source": "SPELLSMITH'S COMPENDIUM",
  "isHomebrew": true
}
```
---
## Version History
| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2024-Q3 | Initial homebrew system release |
---
**Last Updated**: Q3 2024  
**LD Axyum Version**: 3.1.0+  
**Foundry VTT Requirement**: 12.0+
