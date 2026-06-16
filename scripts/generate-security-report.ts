#!/usr/bin/env bunx tsx
/**
 * Generates a human-readable Markdown security findings report from
 * `.security/findings.json`. Highlights connector_security_scan findings
 * with their status and ignore reason.
 *
 * Output: .security/report.md (also prints summary to stdout)
 *
 * Wired into the pre-deploy step alongside check-security-findings.ts.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

type Status = "resolved" | "ignored" | "open";

interface Finding {
  id: string;
  scanner: string;
  title?: string;
  severity?: string;
  status: Status;
  reason?: string;
  resolvedAt?: string;
}

interface Manifest {
  findings: Finding[];
}

const MANIFEST_PATH = resolve(process.cwd(), ".security/findings.json");
const REPORT_PATH = resolve(process.cwd(), ".security/report.md");

if (!existsSync(MANIFEST_PATH)) {
  console.error(`✗ Missing ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
const findings = Array.isArray(manifest.findings) ? manifest.findings : [];

const statusBadge = (s: Status) =>
  s === "resolved" ? "✅ Resolved" : s === "ignored" ? "⚠️ Ignored" : "❌ Open";

function renderTable(rows: Finding[]): string {
  if (rows.length === 0) {
    return "_No findings reported._\n";
  }
  const header =
    "| ID | Title | Severity | Status | Reason / Resolution |\n" +
    "|----|-------|----------|--------|---------------------|\n";
  const body = rows
    .map((f) => {
      const reason = (f.reason ?? (f.status === "resolved" ? "Fixed" : "—"))
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ");
      return `| \`${f.id}\` | ${f.title ?? "—"} | ${f.severity ?? "—"} | ${statusBadge(f.status)} | ${reason} |`;
    })
    .join("\n");
  return header + body + "\n";
}

const byScanner = new Map<string, Finding[]>();
for (const f of findings) {
  const list = byScanner.get(f.scanner) ?? [];
  list.push(f);
  byScanner.set(f.scanner, list);
}

const now = new Date().toISOString();
const total = findings.length;
const resolved = findings.filter((f) => f.status === "resolved").length;
const ignored = findings.filter((f) => f.status === "ignored").length;
const open = findings.filter((f) => f.status === "open").length;

const connectorFindings = byScanner.get("connector_security_scan") ?? [];

let md = `# Pre-Deploy Security Findings Report\n\n`;
md += `_Generated: ${now}_\n\n`;
md += `## Summary\n\n`;
md += `- **Total findings:** ${total}\n`;
md += `- **Resolved:** ${resolved}\n`;
md += `- **Ignored (with reason):** ${ignored}\n`;
md += `- **Open:** ${open}\n\n`;

md += `## Connector Security Scan\n\n`;
md += `Findings reported by \`connector_security_scan\` (${connectorFindings.length}):\n\n`;
md += renderTable(connectorFindings);
md += `\n`;

if (ignored > 0) {
  md += `### Ignored connector findings — reasons\n\n`;
  const ignoredConnector = connectorFindings.filter((f) => f.status === "ignored");
  if (ignoredConnector.length === 0) {
    md += `_None._\n\n`;
  } else {
    for (const f of ignoredConnector) {
      md += `- **${f.id}** — ${f.title ?? "(no title)"}\n  - Reason: ${f.reason ?? "(missing reason)"}\n`;
    }
    md += `\n`;
  }
}

const otherScanners = [...byScanner.entries()].filter(
  ([s]) => s !== "connector_security_scan",
);
if (otherScanners.length > 0) {
  md += `## Other Scanners\n\n`;
  for (const [scanner, rows] of otherScanners) {
    md += `### ${scanner} (${rows.length})\n\n`;
    md += renderTable(rows);
    md += `\n`;
  }
}

md += `---\n\n`;
md += `Manifest: \`.security/findings.json\`. Run \`bun run check:security\` to enforce the gate.\n`;

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, md, "utf8");

console.log(`✓ Wrote security report → ${REPORT_PATH}`);
console.log(
  `  ${total} total · ${resolved} resolved · ${ignored} ignored · ${open} open · ${connectorFindings.length} connector_security_scan`,
);
