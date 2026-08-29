#!/usr/bin/env node
/**
 * Build a Foundry release zip for this module.
 * Ships runtime assets only (no tests, node_modules, coverage, or tooling).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleJson = JSON.parse(fs.readFileSync(path.join(root, "module.json"), "utf8"));
const id = moduleJson.id;
const version = moduleJson.version;
const staging = path.join(root, ".release-temp");
const versionedZip = path.join(root, `${id}-v${version}.zip`);
const moduleZip = path.join(root, "module.zip");
const zipsDir = path.join(root, "zips");

const ignoreNames = new Set([
  ".git", ".github", ".release-temp", ".release-staging", "build-staging",
  "node_modules", "coverage", "coverage-raw", "zips", "tests", "test",
  "package.json", "package-lock.json", "desktop.ini", "module.json.sig",
  ".gitignore", ".DS_Store", "module.zip",
  "Must Follow These Rules For Every Build.md", "pf2e roles", "roles for pf2e",
  "patreon-posts"
]);

// Dev tooling filenames that may live under scripts/
const ignoreFiles = new Set([
  "build-release.mjs", "validate.mjs", "package-release.mjs", "package-release.ps1",
  "find-gaps.mjs", "check-syntax.mjs"
]);

function shouldSkip(name, fullPath) {
  if (ignoreNames.has(name)) return true;
  if (ignoreFiles.has(name)) return true;
  if (name.endsWith(".zip")) return true;
  if (name.startsWith(".") && name !== ".gitkeep") return true;
  return false;
}

function copyRecursive(source, target) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      if (shouldSkip(entry, path.join(source, entry))) continue;
      copyRecursive(path.join(source, entry), path.join(target, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

fs.rmSync(staging, { recursive: true, force: true });
fs.rmSync(versionedZip, { force: true });
fs.rmSync(moduleZip, { force: true });
fs.mkdirSync(staging, { recursive: true });
fs.mkdirSync(zipsDir, { recursive: true });

for (const entry of fs.readdirSync(root)) {
  if (shouldSkip(entry, path.join(root, entry))) continue;
  copyRecursive(path.join(root, entry), path.join(staging, entry));
}

// Foundry expects zip root = module files (no wrapping folder) OR folder named id.
// Community best practice: zip contents at root matching module folder layout.
execFileSync("zip", ["-r", "-X", versionedZip, "."], { cwd: staging, stdio: "inherit" });
fs.copyFileSync(versionedZip, moduleZip);
fs.copyFileSync(versionedZip, path.join(zipsDir, path.basename(versionedZip)));

fs.rmSync(staging, { recursive: true, force: true });
console.log(`Built ${path.basename(versionedZip)} and module.zip`);
