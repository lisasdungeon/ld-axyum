# LD Axyum

LD Axyum is a multi-system character creation and management module for Foundry VTT. It provides guided character wizards for D&D 5e and Pathfinder 2e, an integrated D&D 5e character sheet, compendium content loading, and a GM hub for choosing a system and launching its wizard.

## Requirements

- Foundry VTT 13 or newer, verified on 14
- D&D 5e system 5.1.0 or newer, and/or Pathfinder 2e system 8.0.0 or newer

## Features

- Twelve-page D&D 5e character creation wizard, plus a dedicated Pathfinder 2e wizard covering ancestry, heritage, background, class, key ability, ability boosts, skills, feats, spells, and equipment
- Character sheet creation and editing flow (D&D 5e)
- Automatic hit point, armor class, proficiency, spell, and equipment calculations for both systems
- Compendium and homebrew content loading
- GM hub for picking a system and launching its wizard
- Lazy template loading with event-driven initialization

## Installation

1. Place the module in Foundry's `Data/modules/ld-axyum` directory.
2. Start Foundry and enable **LD Axyum**.
3. Open the Actors Directory and choose **New Character (Axyum)** to launch the wizard for the world's active system, or open the **LD Axyum GM Hub** (scene control button) to pick a system directly.

## Usage

Use **New Character (Axyum)** to move through the wizard for whichever system the current world runs. For D&D 5e: choose a role, class, race, background, abilities, skills, equipment, spells, details, biography, and feats, then review the summary and create the actor. For Pathfinder 2e: choose an ancestry, heritage, background, class, key ability, ability boosts, skills, feats, spells, and equipment, then review the summary and create the actor.

The GM Hub (crown-icon scene control button) lets a GM launch any installed system's wizard directly, independent of the current world's active system.

The public API is available through:

```javascript
game.ldAxyum.open();
game.ldAxyum.openCreate();
game.ldAxyum.openEdit(actor);
```

The character lifecycle hooks are:

```javascript
Hooks.on('axyum.beforeCharacterCreate', (characterData) => {});
Hooks.on('axyum.characterCreated', (actor, characterData) => {});
Hooks.on('axyum.validatePage', (pageIndex, characterData) => {});
Hooks.on('axyum.buildActorUpdate', (characterData, updates) => {});
```

## Project

- GitHub: https://github.com/ld-free-unreleased/ld-axyum
- Discord: MystryssLysa
- Contact: Lisasdungeon@gmail.com

## License

LD Proprietary License. See [LICENSE-LD-PROPRIETARY.md](LICENSE-LD-PROPRIETARY.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).
