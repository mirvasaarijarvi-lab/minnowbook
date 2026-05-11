#!/usr/bin/env node
// Lightweight SARIF 2.1.0 health check.
//
// Usage: node validate-sarif.mjs <file.sarif>
//
// Why not ajv + the official schema:
//   The upload step already runs github/codeql-action/upload-sarif which
//   does authoritative schema validation server-side. This pre-flight
//   check exists to catch the failure modes that would silently swallow
//   findings (empty file, wrong version, missing runs[].tool.driver.name,
//   results without ruleId) BEFORE we hit the API and waste a code-
//   scanning slot. Keeping it dependency-free keeps the gate fast and
//   avoids npm install in CI just to validate one JSON file.

import fs from "node:fs";

const [, , filePath] = process.argv;
if (!filePath) {
  console.error("Usage: validate-sarif.mjs <file.sarif>");
  process.exit(2);
}

const errors = [];
const fail = (msg) => errors.push(msg);

if (!fs.existsSync(filePath)) {
  console.error(`::error file=${filePath}::SARIF file does not exist.`);
  process.exit(1);
}
const stat = fs.statSync(filePath);
if (stat.size === 0) {
  console.error(`::error file=${filePath}::SARIF file is empty.`);
  process.exit(1);
}

let doc;
try {
  doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
} catch (e) {
  console.error(`::error file=${filePath}::SARIF file is not valid JSON: ${e.message}`);
  process.exit(1);
}

if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
  fail("Top-level SARIF document must be a JSON object.");
}
if (doc.version !== "2.1.0") {
  fail(`SARIF version must be "2.1.0" (got ${JSON.stringify(doc.version)}).`);
}
if (!Array.isArray(doc.runs) || doc.runs.length === 0) {
  fail("SARIF document must contain a non-empty runs[] array.");
}

if (Array.isArray(doc.runs)) {
  doc.runs.forEach((run, ri) => {
    const at = `runs[${ri}]`;
    if (!run || typeof run !== "object") {
      fail(`${at} must be an object.`);
      return;
    }
    if (!run.tool || typeof run.tool !== "object") {
      fail(`${at}.tool is required.`);
    } else if (!run.tool.driver || typeof run.tool.driver !== "object") {
      fail(`${at}.tool.driver is required.`);
    } else {
      if (typeof run.tool.driver.name !== "string" || run.tool.driver.name.length === 0) {
        fail(`${at}.tool.driver.name is required and must be a non-empty string.`);
      }
      if (run.tool.driver.rules !== undefined && !Array.isArray(run.tool.driver.rules)) {
        fail(`${at}.tool.driver.rules must be an array when present.`);
      }
    }
    if (run.results !== undefined && !Array.isArray(run.results)) {
      fail(`${at}.results must be an array when present.`);
    }
    const ruleIds = new Set(
      Array.isArray(run.tool?.driver?.rules)
        ? run.tool.driver.rules.map((r) => r && r.id).filter((x) => typeof x === "string")
        : []
    );
    if (Array.isArray(run.results)) {
      run.results.forEach((res, xi) => {
        const rat = `${at}.results[${xi}]`;
        if (!res || typeof res !== "object") {
          fail(`${rat} must be an object.`);
          return;
        }
        if (typeof res.ruleId !== "string" || res.ruleId.length === 0) {
          fail(`${rat}.ruleId is required and must be a non-empty string.`);
        } else if (ruleIds.size > 0 && !ruleIds.has(res.ruleId)) {
          fail(`${rat}.ruleId="${res.ruleId}" does not match any rule defined in tool.driver.rules.`);
        }
        if (!res.message || typeof res.message.text !== "string") {
          fail(`${rat}.message.text is required.`);
        }
        if (res.level !== undefined && !["none", "note", "warning", "error"].includes(res.level)) {
          fail(`${rat}.level "${res.level}" is not a valid SARIF level.`);
        }
      });
    }
  });
}

if (errors.length > 0) {
  console.error(`::error file=${filePath}::SARIF health check failed for ${filePath}:`);
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}

const totalResults = doc.runs.reduce((n, r) => n + (Array.isArray(r.results) ? r.results.length : 0), 0);
const totalRules = doc.runs.reduce((n, r) => n + (Array.isArray(r.tool?.driver?.rules) ? r.tool.driver.rules.length : 0), 0);
console.log(`SARIF health check OK: ${filePath} (${doc.runs.length} run(s), ${totalRules} rule(s), ${totalResults} result(s)).`);
