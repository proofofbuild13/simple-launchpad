#!/usr/bin/env bunx tsx
/**
 * Pre-deploy gate: ensures every security finding tracked in
 * `.security/findings.json` is either marked `resolved` or explicitly
 * `ignored` with a reason. Special attention is given to findings from
 * the `connector_security_scan` (e.g. Wiz) scanner — these MUST be
 * accounted for before going live.
 *
 * Exit codes:
 *   0  all findings resolved or properly ignored
 *   1  one or more findings are open / improperly ignored / manifest invalid
 *
 * Usage:
 *   bunx tsx scripts/check-security-findings.ts
 *
 * Wire into deploys via package.json:
 *   "predeploy": "bunx tsx scripts/check-security-findings.ts"
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

type Status = "resolved" | "ignored" | "open";

interface Finding {
  id: string;
  scanner: string;
  title?: string;
  severity?: "low" | "medium" | "high" | "critical" | string;
  status: Status;
  reason?: string;
  resolvedAt?: string;
}

interface Manifest {
  findings: Finding[];
}

const MANIFEST_PATH = resolve(process.cwd(), ".security/findings.json");
const REQUIRED_SCANNERS = ["connector_security_scan"];

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function fail(msg: string): never {
  console.error(`${RED}✗ ${msg}${RESET}`);
  process.exit(1);
}

function info(msg: string) {
  console.log(`${DIM}${msg}${RESET}`);
}

function ok(msg: string) {
  console.log(`${GREEN}✓ ${msg}${RESET}`);
}

function warn(msg: string) {
  console.log(`${YELLOW}! ${msg}${RESET}`);
}

if (!existsSync(MANIFEST_PATH)) {
  fail(
    `Missing security manifest at .security/findings.json. ` +
      `Run the security scanner and record every finding (status: 'resolved' or 'ignored' with a reason).`,
  );
}

let manifest: Manifest;
try {
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  manifest = JSON.parse(raw) as Manifest;
} catch (e) {
  fail(`Could not parse .security/findings.json: ${(e as Error).message}`);
}

if (!manifest || !Array.isArray(manifest.findings)) {
  fail(`Invalid manifest shape — expected { "findings": Finding[] }.`);
}

const errors: string[] = [];
const scannersSeen = new Set<string>();

for (const [i, f] of manifest.findings.entries()) {
  const where = `findings[${i}]${f?.id ? ` (id=${f.id})` : ""}`;

  if (!f || typeof f !== "object") {
    errors.push(`${where}: not an object`);
    continue;
  }
  if (!f.id) errors.push(`${where}: missing 'id'`);
  if (!f.scanner) errors.push(`${where}: missing 'scanner'`);
  if (!f.status) errors.push(`${where}: missing 'status'`);

  if (f.scanner) scannersSeen.add(f.scanner);

  if (f.status === "open") {
    errors.push(
      `${where}: status 'open' — resolve the underlying issue or explicitly ignore it with a reason.`,
    );
  } else if (f.status === "ignored") {
    if (!f.reason || !f.reason.trim()) {
      errors.push(
        `${where}: status 'ignored' requires a non-empty 'reason' explaining why this is safe in context.`,
      );
    }
  } else if (f.status !== "resolved") {
    errors.push(
      `${where}: invalid status '${f.status}'. Must be 'resolved' or 'ignored'.`,
    );
  }
}

info(`Loaded ${manifest.findings.length} finding(s) from ${MANIFEST_PATH}`);

// Surface scanners that are required to have been considered.
for (const required of REQUIRED_SCANNERS) {
  const hasAny = manifest.findings.some((f) => f.scanner === required);
  if (!hasAny) {
    warn(
      `No findings recorded from '${required}'. If this scanner has run and reports zero findings, add a placeholder entry with status 'resolved' and reason 'no findings reported on <date>'. Otherwise run the scanner before deploying.`,
    );
  }
}

if (errors.length > 0) {
  console.error("");
  console.error(`${RED}Pre-deploy security check FAILED:${RESET}`);
  for (const e of errors) console.error(`  ${RED}•${RESET} ${e}`);
  console.error("");
  console.error(
    `Fix the issues above in .security/findings.json, then re-run the script.`,
  );
  process.exit(1);
}

const resolved = manifest.findings.filter((f) => f.status === "resolved").length;
const ignored = manifest.findings.filter((f) => f.status === "ignored").length;
const connector = manifest.findings.filter(
  (f) => f.scanner === "connector_security_scan",
).length;

ok(
  `Security gate passed: ${resolved} resolved, ${ignored} ignored (with reason). ` +
    `connector_security_scan accounted for: ${connector}.`,
);
process.exit(0);
