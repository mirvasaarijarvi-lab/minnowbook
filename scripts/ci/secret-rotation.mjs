#!/usr/bin/env node
/**
 * Guided secret rotation.
 *
 * Walks through replacing a credential safely: what it affects, the ordered
 * steps for that credential's kind, and what to verify afterwards.
 *
 * This tool never reads, prints, stores or transports a secret value. It only
 * reports whether a name is present in the environment, so a missing or
 * not-yet-loaded credential is visible without exposing anything.
 *
 * Usage:
 *   node scripts/ci/secret-rotation.mjs --list
 *   node scripts/ci/secret-rotation.mjs --plan STRIPE_SECRET_KEY
 *   node scripts/ci/secret-rotation.mjs --plan STRIPE_SECRET_KEY --compromised
 *   node scripts/ci/secret-rotation.mjs --check
 *   node scripts/ci/secret-rotation.mjs --list --json
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const INVENTORY_PATH = join(HERE, "secret-inventory.json");

/** Credential names that must never be echoed, even partially. */
const VALUE_LIKE = /^(sk_|rk_|re_|sb_|eyJ|lovc_|ghp_|github_pat_)/;

export function loadInventory(path = INVENTORY_PATH) {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw.secrets) || raw.secrets.length === 0) {
    throw new Error("secret inventory is empty");
  }
  for (const secret of raw.secrets) {
    for (const field of ["name", "label", "kind", "owner", "blastRadius"]) {
      if (!secret[field]) {
        throw new Error(`inventory entry is missing ${field}`);
      }
    }
    if (!Array.isArray(secret.steps) || secret.steps.length === 0) {
      throw new Error(`inventory entry ${secret.name} has no steps`);
    }
    if (typeof secret.rotationDays !== "number" || secret.rotationDays <= 0) {
      throw new Error(`inventory entry ${secret.name} has no rotation cadence`);
    }
  }
  return raw;
}

export function listSecrets(inventory = loadInventory()) {
  return inventory.secrets.map((s) => ({
    name: s.name,
    label: s.label,
    kind: s.kind,
    owner: s.owner,
    rotationDays: s.rotationDays,
  }));
}

export function findSecret(name, inventory = loadInventory()) {
  const wanted = String(name ?? "").trim();
  if (!wanted) return null;
  const upper = wanted.toUpperCase();
  return (
    inventory.secrets.find((s) => s.name.toUpperCase() === upper) ??
    inventory.secrets.find((s) => s.name.toUpperCase().includes(upper)) ??
    null
  );
}

/**
 * Build the ordered rotation plan for one credential.
 *
 * @param {string} name
 * @param {{ compromised?: boolean, inventory?: object }} [options]
 */
export function buildPlan(name, options = {}) {
  const inventory = options.inventory ?? loadInventory();
  const secret = findSecret(name, inventory);
  if (!secret) {
    const known = listSecrets(inventory)
      .map((s) => s.name)
      .join(", ");
    throw new Error(`unknown credential "${name}". Known: ${known}`);
  }

  const compromised = Boolean(options.compromised);
  const before = [...(inventory.universalSteps?.before ?? [])];
  const after = [...(inventory.universalSteps?.after ?? [])];

  if (compromised) {
    before.unshift(
      "Assume the old value is in someone else's hands: rotate first, investigate second.",
    );
    if (!secret.revokesOldValue) {
      after.unshift(
        `Revoke the old ${secret.label} at the provider as soon as the new value is confirmed working. Rotating alone does not disable it.`,
      );
    }
    after.push(
      "Review access made with the old value over the exposure window, and note in the incident record what you ruled out.",
    );
  }

  const warnings = [];
  if (secret.requiresRepublish) {
    warnings.push(
      "Live traffic keeps using the old value until you republish. Plan the republish as part of the rotation, not later.",
    );
  }
  if (!secret.revokesOldValue) {
    warnings.push(
      "Creating the new value does not disable the old one. Revoke it explicitly at the provider once the new value works.",
    );
  }
  if (secret.notAccessible) {
    warnings.push(
      "This value cannot be read back anywhere. If you did not save it during rotation, rotate again rather than guessing.",
    );
  }
  if (secret.kind === "shared") {
    warnings.push(
      "Both sides must hold the same value. Update the app and the provider in one sitting to avoid rejected callbacks.",
    );
  }

  return {
    name: secret.name,
    label: secret.label,
    kind: secret.kind,
    owner: secret.owner,
    rotationDays: secret.rotationDays,
    blastRadius: secret.blastRadius,
    compromised,
    warnings,
    steps: [...before, ...secret.steps, ...after],
    verify: secret.verify ?? [],
  };
}

/**
 * Presence-only environment report. Values are never read into the output.
 */
export function checkEnvironment(env = process.env, inventory = loadInventory()) {
  return inventory.secrets
    .filter((s) => s.kind !== "shared")
    .map((s) => {
      const raw = env[s.name];
      return {
        name: s.name,
        present: typeof raw === "string" && raw.trim().length > 0,
        kind: s.kind,
      };
    });
}

/** Guard: a plan must never carry a value-shaped string. */
export function containsSecretValue(text) {
  return String(text)
    .split(/\s+/)
    .some((token) => VALUE_LIKE.test(token) && token.length > 12);
}

function renderPlan(plan) {
  const lines = [];
  lines.push(`Rotating: ${plan.label} (${plan.name})`);
  lines.push(`Owner: ${plan.owner}`);
  lines.push(`Routine cadence: every ${plan.rotationDays} days`);
  lines.push(`What it affects: ${plan.blastRadius}`);
  if (plan.compromised) {
    lines.push("Mode: suspected exposure, treat as an incident");
  }
  if (plan.warnings.length > 0) {
    lines.push("");
    lines.push("Watch out:");
    plan.warnings.forEach((w) => lines.push(`  ! ${w}`));
  }
  lines.push("");
  lines.push("Steps:");
  plan.steps.forEach((step, i) => lines.push(`  ${i + 1}. ${step}`));
  if (plan.verify.length > 0) {
    lines.push("");
    lines.push("Verify afterwards:");
    plan.verify.forEach((v) => lines.push(`  $ ${v}`));
  }
  lines.push("");
  lines.push("Never paste a credential value into chat, a file or a commit.");
  return lines.join("\n");
}

function renderList(rows) {
  const width = Math.max(...rows.map((r) => r.name.length));
  return [
    "Credentials in this project:",
    ...rows.map(
      (r) =>
        `  ${r.name.padEnd(width)}  ${r.kind.padEnd(18)} every ${r.rotationDays}d  ${r.label}`,
    ),
    "",
    "Guided rotation: bun run secrets:rotate -- --plan <NAME> [--compromised]",
  ].join("\n");
}

function renderCheck(rows) {
  return [
    "Credential presence (names only, never values):",
    ...rows.map((r) => `  ${r.present ? "present" : "missing"}  ${r.name}`),
    "",
    "A missing entry is expected when that credential is not needed locally.",
  ].join("\n");
}

function main(argv) {
  const args = argv.slice(2);
  const json = args.includes("--json");
  const compromised = args.includes("--compromised");
  const planIndex = args.findIndex((a) => a === "--plan" || a === "--rotate");

  if (planIndex !== -1) {
    const name = args[planIndex + 1];
    const plan = buildPlan(name, { compromised });
    console.log(json ? JSON.stringify(plan, null, 2) : renderPlan(plan));
    return 0;
  }
  if (args.includes("--check")) {
    const rows = checkEnvironment();
    console.log(json ? JSON.stringify(rows, null, 2) : renderCheck(rows));
    return 0;
  }
  const rows = listSecrets();
  console.log(json ? JSON.stringify(rows, null, 2) : renderList(rows));
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith("secret-rotation.mjs")) {
  try {
    process.exit(main(process.argv));
  } catch (error) {
    console.error(`secret-rotation: ${error.message}`);
    process.exit(1);
  }
}
