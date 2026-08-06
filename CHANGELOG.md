# Changelog

## Unreleased

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
