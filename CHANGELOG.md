# Changelog

## 1.0.6 - 2026-08-29

- Added a dedicated Pathfinder 2e character creation wizard (ancestry, heritage, background, class, key ability, ability boosts, skills, feats, spells, equipment) alongside the existing D&D 5e wizard, selectable from the GM Hub.
- Fixed the GM Hub's system-card, sheet-preview, and use-sheet buttons: they read `event.currentTarget`, which under ApplicationV2's delegated action dispatch is the hub's root element rather than the clicked card, so every card failed with an "undefined is not available yet" warning. They now read the action target Foundry actually passes.
- Fixed `SystemRegistry.isFoundrySystemAvailable` reporting a system as unavailable even while its world was actively running it. `game.systems` (the full installed-package collection) isn't reliably populated once a world has loaded; the active system id (`game.system.id`) is now checked first.
- Fixed pf2e cantrips never appearing and 1st-rank spell lists including every rank. pf2e stores cantrips as rank/level-1 items tagged with a `cantrip` trait rather than a literal rank 0; rank is now derived from that trait.
- Added portrait art to pf2e ancestry, heritage, background, class, feat, spell, and equipment selection cards, sourced from the compendium items' own `img` field.
- Added a "Ancient Remnants" copper/bronze stylesheet for the pf2e wizard; it previously shipped with no dedicated styling.
- Added a console warning identifying why the active-system wizard resolution fell back to the D&D 5e wizard, for future debugging.

## 1.0.5 - 2026-08-28

- Rebuilds Foundry v14's cached scene controls on ready and when scene-button visibility changes.

## 1.0.4

- Race compendium loading no longer reads `senses.darkvision`. DnD5e 5.3 stores that value on `senses.ranges.darkvision`, and the old getter logs a deprecation warning (or throws in strict compatibility mode) for every species document.

## 1.0.3

- Added a client setting to show or hide the left scene control button.

## 1.0.2

- Stopped overwriting Foundry's Handlebars `localize` helper (and other helpers that already exist). Replacing `localize` blanks core UI templates.
- The shared localize helper now also skips registration when Foundry already provided `localize` or `format`.
- Download URL uses `releases/latest/download/module.zip`.
- Character wizard cache invalidation uses the live app class so subclass cache slots stay consistent.

## Unreleased

- Gap fix pass: Foundry 13/14 compatibility standardized; sole Lisa's Dungeon authorship retained.
- Lazy-load / single-entry startup where applicable; optional features attach on ready.
- Coverage and flake hardening for automated suites.

- Compliance pass: sole author Lisa's Dungeon with Discord MystryssLysa, email Lisasdungeon@gmail.com, and Patreon LisasDungeon.
- Enforced the 500 LOC file cap for styles, templates, and tests.
- Removed non-Lisa branding references from package metadata and docs.

## [1.0.1] - 2026-07-30

- Fixed the GM Hub launching the wrong character wizard for a selected game system instead of using that system's own registered wizard class.
- Fixed a misleading notification claiming a default sheet had been set when the feature was not yet implemented.
- Fixed character import crashing on valid minimal data missing optional hit points, proficiencies, or class sections.
- Fixed a validation error losing its attached details due to an incorrect Error constructor usage.
- Removed an unused cross-module registry hook that had no effect on the module's functionality.
- Removed roughly 2,900 lines of unreferenced code (a quantum-portal integration cluster and an unwired recommendation/tooltip/new-player-guide subsystem) that shipped in the module but were never loaded.
- Replaced emoji glyphs in the character export modal with the module's existing icon set.

## [1.0.0] - 2026-07-24

- Released as LD Axyum under Lisa's Dungeon.
- Removed the logo component, logo variants, logo styles, and logo template references.
- Updated module identifiers, localization namespaces, runtime APIs, selectors, paths, and release metadata.
- Preserved lazy loading, event-driven initialization, GM hub behavior, and system adapters.
- Updated Foundry VTT compatibility metadata for versions 13 and 14.
- Added the LD proprietary license and release documentation.
