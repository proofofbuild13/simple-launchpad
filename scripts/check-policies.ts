#!/usr/bin/env bunx tsx
/**
 * Runs .security/policy-checks.sql against the Supabase Postgres database
 * and exits non-zero if any assertion fails.
 *
 * CI usage:
 *   DATABASE_URL=postgres://... bun run check:policies
 *
 * Works with either:
 *   - DATABASE_URL  (preferred for CI)
 *   - PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT (sandbox-managed)
 *
 * Requires `psql` on the PATH. In CI runners that don't have it, install
 * postgresql-client first (apt-get install -y postgresql-client).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const SQL = resolve(process.cwd(), ".security/policy-checks.sql");
const RED = "\x1b[31m", GREEN = "\x1b[32m", DIM = "\x1b[2m", RESET = "\x1b[0m";

if (!existsSync(SQL)) {
  console.error(`${RED}✗ Missing ${SQL}${RESET}`);
  process.exit(1);
}

const which = spawnSync("which", ["psql"], { encoding: "utf8" });
if (which.status !== 0) {
  console.error(`${RED}✗ 'psql' not found on PATH. Install postgresql-client in CI.${RESET}`);
  process.exit(1);
}

const hasUrl = !!process.env.DATABASE_URL;
const hasPg  = !!process.env.PGHOST;
if (!hasUrl && !hasPg) {
  console.error(
    `${RED}✗ No DB connection configured.${RESET}\n` +
    `  Set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE.\n` +
    `  Get the connection string from the Supabase dashboard:\n` +
    `  Settings → Database → Connection string (URI), use the pooler.`
  );
  process.exit(1);
}

console.log(`${DIM}Running policy checks: ${SQL}${RESET}`);

const args = ["-v", "ON_ERROR_STOP=1", "-X", "-q", "-f", SQL];
if (hasUrl) args.unshift(process.env.DATABASE_URL!);

const res = spawnSync("psql", args, { stdio: "inherit", env: process.env });

if (res.status !== 0) {
  console.error(`\n${RED}✗ Policy checks FAILED (exit ${res.status}).${RESET}`);
  console.error(`  Re-apply the security migration and re-run.`);
  process.exit(res.status ?? 1);
}

console.log(`${GREEN}✓ All policy checks passed.${RESET}`);
