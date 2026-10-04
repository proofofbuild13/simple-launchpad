/**
 * Runs the actual escrow migration in an isolated PostgreSQL WASM database.
 * No production connection, Docker, or application dependency changes are needed.
 *
 * PowerShell setup/run:
 *   $escrowRuntime = Join-Path $env:TEMP 'launchpad-escrow-pglite'
 *   npm install --prefix $escrowRuntime --no-save --package-lock=false @electric-sql/pglite@0.3.14
 *   $env:PGLITE_RUNTIME_DIR = $escrowRuntime
 *   node --test supabase/tests/escrow.test.mjs
 *
 * Set ESCROW_TEST_BASELINE=1 to reproduce failures against the previous RPCs.
 * PGlite uses one connection; these tests verify sequential retries and atomic
 * rollback, while concurrent transaction contention requires real PostgreSQL.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(join(process.env.PGLITE_RUNTIME_DIR || repoRoot, 'package.json'));
let PGlite;
try {
  ({ PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href));
} catch (error) {
  throw new Error('Install the isolated PGlite runtime and set PGLITE_RUNTIME_DIR as documented at the top of this test file.', { cause: error });
}

const db = new PGlite();
const users = {
  founder: '10000000-0000-4000-8000-000000000001',
  builder: '10000000-0000-4000-8000-000000000002',
  outsider: '10000000-0000-4000-8000-000000000003',
  admin: '10000000-0000-4000-8000-000000000004',
};

async function migration(name) {
  return readFile(join(repoRoot, 'supabase/migrations', name), 'utf8');
}

function tableDefinition(sql, name) {
  const match = sql.match(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? public\\.${name} \\([\\s\\S]*?\\r?\\n\\);`));
  assert.ok(match, `Original table definition exists for ${name}`);
  return match[0];
}

function functionDefinition(sql, name) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.notEqual(start, -1, `Original function exists for ${name}`);
  const remaining = sql.slice(start);
  const delimiter = remaining.match(/AS (\$[a-z_]*\$)/i)?.[1];
  assert.ok(delimiter, `SQL body delimiter exists for ${name}`);
  const body = remaining.indexOf(delimiter);
  return remaining.slice(0, remaining.indexOf(delimiter, body + delimiter.length) + delimiter.length + 1);
}

function policyDefinition(sql, name) {
  const match = sql.match(new RegExp(`CREATE POLICY "?${name}"?[\\s\\S]*?;`));
  assert.ok(match, `Original policy exists for ${name}`);
  return match[0];
}

async function asUser(userId, sql, parameters = []) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId || '']);
  await db.exec('SET ROLE authenticated');
  try {
    return await db.query(sql, parameters);
  } finally {
    await db.exec('RESET ROLE');
  }
}

async function one(sql, parameters = []) {
  return (await db.query(sql, parameters)).rows[0];
}

async function fixture({ balance = 100, escrowAmount = 100, funded = true, status = 'contract_active', milestoneStatus = 'submitted', amount = 33.33, signatures = true } = {}) {
  const projectId = randomUUID();
  const contractId = randomUUID();
  const milestoneId = randomUUID();
  await db.query("INSERT INTO projects (id, founder_id, title, currency) VALUES ($1,$2,'Escrow regression project','INR')", [projectId, users.founder]);
  await db.query(`INSERT INTO contracts (id, project_id, founder_id, builder_id, escrow_amount, escrow_balance, escrow_funded, status, currency)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'INR')`, [contractId, projectId, users.founder, users.builder, escrowAmount, balance, funded, status]);
  await db.query(`INSERT INTO contract_milestones (id, contract_id, title, amount, status, currency)
    VALUES ($1,$2,'Deliver working prototype',$3,$4,'INR')`, [milestoneId, contractId, amount, milestoneStatus]);
  if (signatures) {
    await db.query("INSERT INTO contract_signatures (contract_id, signed_by, role) VALUES ($1,$2,'founder'),($1,$3,'builder')", [contractId, users.founder, users.builder]);
  }
  let disputeId;
  if (milestoneStatus === 'dispute') {
    disputeId = randomUUID();
    await db.query("INSERT INTO disputes (id,contract_id,milestone_id,raised_by,reason,status) VALUES ($1,$2,$3,$4,'Review deliverable','open')", [disputeId, contractId, milestoneId, users.founder]);
  }
  return { projectId, contractId, milestoneId, disputeId };
}

async function financialSnapshot(contractId) {
  return one(`SELECT
    (SELECT jsonb_build_object('status', status, 'balance', escrow_balance, 'funded', escrow_funded) FROM contracts WHERE id = $1) AS contract,
    (SELECT jsonb_agg(jsonb_build_object('id', id, 'status', status, 'amount', amount) ORDER BY id) FROM contract_milestones WHERE contract_id = $1) AS milestones,
    (SELECT count(*)::int FROM escrow_ledger WHERE contract_id = $1) AS ledger_count,
    (SELECT count(*)::int FROM payment_records WHERE contract_id = $1) AS payment_count,
    (SELECT count(*)::int FROM commission_invoices ci JOIN payment_records pr ON pr.id = ci.payment_record_id WHERE pr.contract_id = $1) AS invoice_count,
    (SELECT count(*)::int FROM notifications) AS notification_count`, [contractId]);
}

before(async () => {
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA auth, public TO authenticated, anon, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon, service_role;
    CREATE TYPE public.app_role AS ENUM ('admin','startup','builder','super_admin');`);

  // Use the real relevant table definitions; omit unrelated application tables
  // and Supabase infrastructure. auth.uid reads the simulated JWT subject.
  const base = await migration('20260509110425_9c21d086-d461-48d5-b265-334de4af1f51.sql');
  for (const name of ['user_roles', 'projects', 'submissions', 'offers', 'contracts', 'notifications']) {
    await db.exec(tableDefinition(base, name));
  }
  await db.exec(functionDefinition(base, 'has_role'));
  await db.exec(functionDefinition(base, 'touch_updated_at'));
  await db.exec('ALTER TABLE contracts ENABLE ROW LEVEL SECURITY');
  for (const policy of ['contracts_select_parties', 'contracts_insert_founder', 'contracts_update_parties']) {
    await db.exec(policyDefinition(base, policy));
  }
  const workspace = await migration('20260510102841_e0d86cd1-65f4-414a-b292-6eecba951245.sql');
  for (const name of ['contract_signatures', 'contract_milestones', 'disputes']) {
    await db.exec(tableDefinition(workspace, name));
  }
  // Exercise the real affected RLS policies as an authenticated client as
  // well as each RPC's authorization; unrelated app policies are omitted.
  await db.exec('ALTER TABLE contract_signatures ENABLE ROW LEVEL SECURITY');
  for (const policy of ['cs_select_parties', 'cs_insert_self']) {
    await db.exec(policyDefinition(workspace, policy));
  }
  await db.exec('ALTER TABLE contract_milestones ENABLE ROW LEVEL SECURITY');
  for (const policy of ['cm_select_parties', 'cm_insert_founder', 'cm_update_parties']) {
    await db.exec(policyDefinition(workspace, policy));
  }
  const payments = await migration('20260513033644_4af13b5a-7cab-4252-89f4-66c638f73fe3.sql');
  await db.exec('CREATE SEQUENCE public.commission_invoice_seq');
  for (const name of ['payment_records', 'commission_invoices', 'commission_payments']) {
    await db.exec(tableDefinition(payments, name));
  }
  await db.exec('ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY');
  for (const policy of ['pr_select_parties', 'pr_insert_founder', 'pr_update_parties']) {
    await db.exec(policyDefinition(payments, policy));
  }
  await db.exec('ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY');
  for (const policy of ['cp_select_parties', 'cp_insert_founder', 'cp_update_admin']) {
    await db.exec(policyDefinition(payments, policy));
  }
  const escrow = await migration('20260607163751_3ed37197-2c2e-437b-afd0-922a4aec4a5f.sql');
  for (const name of ['escrow_ledger', 'platform_settings']) {
    await db.exec(tableDefinition(escrow, name));
  }
  await db.exec(tableDefinition(await migration('20260514161556_01d715d6-f33e-4c7d-bb23-f830c28f96d7.sql'), 'admin_audit_logs'));
  await db.exec(tableDefinition(await migration('20260516054521_223bb807-a108-4a29-8c6f-8907c3ae90d2.sql'), 'payment_methods'));
  await db.exec(`ALTER TABLE contracts
    ADD COLUMN ip_assignment boolean DEFAULT true,
    ADD COLUMN nda_included boolean DEFAULT false,
    ADD COLUMN start_date date,
    ADD COLUMN escrow_funded boolean DEFAULT false,
    ADD COLUMN escrow_balance numeric NOT NULL DEFAULT 0,
    ADD COLUMN escrow_provider text DEFAULT 'manual',
    ADD COLUMN escrow_funded_at timestamptz,
    ADD COLUMN escrow_transaction_ref text;
    ALTER TABLE offers ADD COLUMN start_date date;
    ALTER TABLE projects ADD COLUMN max_hires integer DEFAULT 1, ADD COLUMN hire_locked boolean DEFAULT false;`);
  for (const name of ['contracts', 'contract_milestones', 'offers', 'projects', 'payment_records', 'commission_invoices', 'commission_payments']) {
    await db.exec(`ALTER TABLE ${name} ADD COLUMN currency text NOT NULL DEFAULT 'USD'`);
  }
  await db.exec('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated');
  await db.exec(await migration('20260615162252_116246a3-f205-4739-be38-9ada2fef0420.sql'));
  await db.exec(await migration('20260623161226_0050cb50-0238-43b0-bd39-fd604d158843.sql'));
  await db.exec(functionDefinition(await migration('20260515163229_2ee65ff5-ec14-4d26-b3cc-fe9d024d10cc.sql'), 'verify_commission_payment'));
  if (process.env.ESCROW_TEST_BASELINE !== '1') {
    await db.exec(await readFile(resolve(repoRoot, process.env.ESCROW_MIGRATION || 'supabase/migrations/20261003120000_fix_escrow_workflow.sql'), 'utf8'));
  }
});

beforeEach(async () => {
  await db.exec(`RESET ROLE;
    TRUNCATE auth.users, user_roles, projects, offers, submissions, contracts, contract_milestones,
      contract_signatures, notifications, escrow_ledger, payment_records, commission_invoices,
      commission_payments, disputes, admin_audit_logs, payment_methods RESTART IDENTITY CASCADE;
    DELETE FROM platform_settings; INSERT INTO platform_settings (key,value) VALUES ('commission_rate','0.15');`);
  for (const id of Object.values(users)) await db.query('INSERT INTO auth.users (id) VALUES ($1)', [id]);
  await db.query("INSERT INTO user_roles (user_id,role) VALUES ($1,'startup'),($2,'builder'),($3,'admin')", [users.founder, users.builder, users.admin]);
  await db.query("INSERT INTO payment_methods (user_id,method_type,upi_id,is_default,verified) VALUES ($1,'upi','builder@example',true,true)", [users.builder]);
});

after(async () => { await db.close(); });

test('startup approves a submitted milestone and releases its full amount atomically', async () => {
  const { contractId, milestoneId } = await fixture();
  const result = await asUser(users.founder, 'SELECT release_escrow_for_milestone($1) AS ledger_id', [milestoneId]);
  assert.ok(result.rows[0].ledger_id);
  assert.deepEqual(await financialSnapshot(contractId), {
    contract: { status: 'contract_active', balance: 66.67, funded: true },
    milestones: [{ id: milestoneId, status: 'escrow_released', amount: 33.33 }],
    ledger_count: 1, payment_count: 1, invoice_count: 1, notification_count: 2,
  });
  assert.deepEqual(await one('SELECT amount::text, balance_after::text FROM escrow_ledger WHERE milestone_id = $1', [milestoneId]), { amount: '33.33', balance_after: '66.67' });
  assert.deepEqual(await one('SELECT declared_amount::text, confirmed_amount::text, payment_method, status, currency FROM payment_records WHERE milestone_id = $1', [milestoneId]), {
    declared_amount: '33.33', confirmed_amount: '33.33', payment_method: 'escrow', status: 'confirmed', currency: 'INR',
  });
  assert.deepEqual(await one('SELECT base_amount::text, commission_amount::text, commission_rate::text, currency FROM commission_invoices'), {
    base_amount: '33.33', commission_amount: '5.00', commission_rate: '0.15', currency: 'INR',
  });
});

test('an already approved milestone remains releasable', async () => {
  const { milestoneId } = await fixture({ milestoneStatus: 'approved' });
  await asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]);
  assert.equal((await one('SELECT status FROM contract_milestones WHERE id = $1', [milestoneId])).status, 'escrow_released');
});

test('a retry cannot debit escrow or create a second payment/invoice', async () => {
  const { contractId, milestoneId } = await fixture({ milestoneStatus: 'approved' });
  await asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]);
  const previous = await financialSnapshot(contractId);
  await assert.rejects(asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]));
  assert.deepEqual(await financialSnapshot(contractId), previous);
});

test('insufficient balance leaves submitted work and all financial records unchanged', async () => {
  const { contractId, milestoneId } = await fixture({ balance: 10 });
  const previous = await financialSnapshot(contractId);
  await assert.rejects(asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]), /[Ii]nsufficient/);
  assert.deepEqual(await financialSnapshot(contractId), previous);
});

test('invoice insertion failure rolls back the debit, approval, ledger and payment', async () => {
  const { contractId, milestoneId } = await fixture();
  const previous = await financialSnapshot(contractId);
  await db.exec(`CREATE FUNCTION reject_test_invoice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Regression invoice failure'; END; $$;
    CREATE TRIGGER reject_test_invoice BEFORE INSERT ON commission_invoices FOR EACH ROW EXECUTE FUNCTION reject_test_invoice();`);
  try {
    await assert.rejects(asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]), /Regression invoice failure/);
    assert.deepEqual(await financialSnapshot(contractId), previous);
  } finally {
    await db.exec('DROP TRIGGER reject_test_invoice ON commission_invoices; DROP FUNCTION reject_test_invoice()');
  }
});

test('only the startup can fund or release, including when the JWT subject is missing', async () => {
  const funded = await fixture({ milestoneStatus: 'approved' });
  const unfunded = await fixture({ funded: false, balance: 0, status: 'partially_signed', amount: 100 });
  for (const uid of [null, users.builder, users.outsider]) {
    await assert.rejects(asUser(uid, 'SELECT release_escrow_for_milestone($1)', [funded.milestoneId]));
    await assert.rejects(asUser(uid, "SELECT fund_escrow($1,100,'proof')", [unfunded.contractId]));
  }
  assert.equal((await financialSnapshot(funded.contractId)).ledger_count, 0);
  assert.equal((await financialSnapshot(unfunded.contractId)).contract.funded, false);
});

test('funding uses the current milestone total and stores the deposit proof', async () => {
  const { contractId } = await fixture({ funded: false, balance: 0, status: 'partially_signed', escrowAmount: 100, amount: 150 });
  await asUser(users.founder, "SELECT fund_escrow($1,150,'BANK-123','https://example.com/escrow-proof.png')", [contractId]);
  assert.deepEqual(await one('SELECT escrow_amount::text, escrow_balance::text, escrow_funded, status, escrow_transaction_ref, escrow_screenshot_url FROM contracts WHERE id = $1', [contractId]), {
    escrow_amount: '150', escrow_balance: '150', escrow_funded: true, status: 'contract_active', escrow_transaction_ref: 'BANK-123', escrow_screenshot_url: 'https://example.com/escrow-proof.png',
  });
  assert.deepEqual(await one('SELECT entry_type, amount::text, balance_after::text FROM escrow_ledger WHERE contract_id = $1', [contractId]), { entry_type: 'funded', amount: '150', balance_after: '150' });
});

test('a stale higher contract total does not prevent funding edited milestones', async () => {
  const { contractId } = await fixture({ funded: false, balance: 0, status: 'partially_signed', escrowAmount: 200, amount: 100 });
  await asUser(users.founder, "SELECT fund_escrow($1,100,'BANK-456')", [contractId]);
  assert.equal((await one('SELECT escrow_balance::text FROM contracts WHERE id = $1', [contractId])).escrow_balance, '100');
});

test('underpayment, overpayment, null and non-finite deposits cannot activate a contract', async () => {
  const { contractId } = await fixture({ funded: false, balance: 0, status: 'partially_signed', escrowAmount: 1, amount: 100 });
  const previous = await financialSnapshot(contractId);
  for (const amount of ['99', '101', null, 'NaN', 'Infinity', '-1', '0']) {
    await assert.rejects(asUser(users.founder, "SELECT fund_escrow($1,$2::numeric,'BANK-789')", [contractId, amount]));
    assert.deepEqual(await financialSnapshot(contractId), previous);
  }
});

test('both contract parties must sign before funding or releasing', async () => {
  const { contractId, milestoneId } = await fixture({ signatures: false, funded: false, balance: 0, status: 'sent_for_signing', escrowAmount: 33.33, milestoneStatus: 'approved' });
  await db.query("INSERT INTO contract_signatures (contract_id, signed_by, role) VALUES ($1,$2,'founder')", [contractId, users.founder]);
  await assert.rejects(asUser(users.founder, "SELECT fund_escrow($1,33.33,'BANK-000')", [contractId]));
  await db.query("UPDATE contracts SET escrow_funded = true, escrow_balance = 100, status = 'contract_active' WHERE id = $1", [contractId]);
  await assert.rejects(asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]));
});

test('unfunded, cancelled, in-progress and mismatched-currency releases are rejected', async () => {
  const variants = [
    { funded: false }, { status: 'cancelled' }, { milestoneStatus: 'in_progress' },
  ];
  for (const variant of variants) {
    const { milestoneId } = await fixture({ milestoneStatus: 'approved', ...variant });
    await assert.rejects(asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]));
  }
  const { milestoneId } = await fixture({ milestoneStatus: 'approved' });
  await db.query("UPDATE contract_milestones SET currency = 'USD' WHERE id = $1", [milestoneId]);
  await assert.rejects(asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]));
});

test('offer acceptance preserves the full compensation across rounded milestones and currencies', async () => {
  for (const duration of ['3 months', '6 months', '12 months']) {
    const projectId = randomUUID();
    const offerId = randomUUID();
    await db.query("INSERT INTO projects (id, founder_id, title, currency) VALUES ($1,$2,'New builder project','INR')", [projectId, users.founder]);
    await db.query("INSERT INTO offers (id, project_id, founder_id, builder_id, compensation, duration, currency) VALUES ($1,$2,$3,$4,100,$5,'INR')", [offerId, projectId, users.founder, users.builder, duration]);
    const result = await asUser(users.builder, 'SELECT create_contract_from_offer($1) AS contract_id', [offerId]);
    const contractId = result.rows[0].contract_id;
    assert.deepEqual(await one(`SELECT sum(amount)::text AS total, count(*)::int AS count, bool_and(currency='INR') AS matching_currency FROM contract_milestones WHERE contract_id = $1`, [contractId]), {
      total: '100.00', count: Number.parseInt(duration, 10), matching_currency: true,
    });
    assert.equal((await one('SELECT currency FROM contracts WHERE id = $1', [contractId])).currency, 'INR');
    assert.equal((await asUser(users.builder, 'SELECT create_contract_from_offer($1) AS contract_id', [offerId])).rows[0].contract_id, contractId);
  }
});

test('admin cannot resolve a milestone belonging to another contract', async () => {
  const first = await fixture({ milestoneStatus: 'dispute' });
  const second = await fixture({ milestoneStatus: 'dispute' });
  for (const direction of ['release_to_builder', 'refund_to_founder']) {
    await assert.rejects(asUser(users.admin, 'SELECT admin_resolve_escrow($1,$2,$3)', [first.contractId, second.milestoneId, direction]));
  }
  assert.equal((await financialSnapshot(first.contractId)).contract.balance, 100);
  assert.equal((await financialSnapshot(second.contractId)).contract.balance, 100);
});

test('admin release creates the regular payment and invoice and rejects replay', async () => {
  const { contractId, milestoneId } = await fixture({ milestoneStatus: 'dispute' });
  await asUser(users.admin, "SELECT admin_resolve_escrow($1,$2,'release_to_builder')", [contractId, milestoneId]);
  const previous = await financialSnapshot(contractId);
  assert.equal(previous.contract.balance, 66.67);
  assert.equal(previous.payment_count, 1);
  assert.equal(previous.invoice_count, 1);
  assert.equal(previous.ledger_count, 1);
  await assert.rejects(asUser(users.admin, "SELECT admin_resolve_escrow($1,$2,'release_to_builder')", [contractId, milestoneId]));
  assert.deepEqual(await financialSnapshot(contractId), previous);
});

test('admin refund debits only its milestone and cannot be repeated', async () => {
  const { contractId, milestoneId } = await fixture({ milestoneStatus: 'dispute' });
  await asUser(users.admin, "SELECT admin_resolve_escrow($1,$2,'refund_to_founder')", [contractId, milestoneId]);
  const previous = await financialSnapshot(contractId);
  assert.equal(previous.contract.balance, 66.67);
  assert.equal(previous.milestones[0].status, 'cancelled');
  assert.equal(previous.payment_count, 0);
  assert.equal(previous.invoice_count, 0);
  assert.equal(previous.ledger_count, 1);
  await assert.rejects(asUser(users.admin, "SELECT admin_resolve_escrow($1,$2,'refund_to_founder')", [contractId, milestoneId]));
  assert.deepEqual(await financialSnapshot(contractId), previous);
});

test('an authenticated client cannot call the private release helper', async () => {
  const { contractId, milestoneId } = await fixture();
  await assert.rejects(asUser(users.founder, 'SELECT record_escrow_release($1,$2,false)', [contractId, milestoneId]), /permission denied/);
  assert.equal((await financialSnapshot(contractId)).ledger_count, 0);
});

test('a builder cannot impersonate the startup signature or sign a contract draft', async () => {
  const signing = await fixture({ signatures: false, funded: false, balance: 0, status: 'sent_for_signing' });
  await assert.rejects(asUser(users.builder, "INSERT INTO contract_signatures (contract_id,signed_by,role) VALUES ($1,$2,'founder')", [signing.contractId, users.builder]), /row-level security/);
  const draft = await fixture({ signatures: false, funded: false, balance: 0, status: 'contract_drafted' });
  await assert.rejects(asUser(users.builder, "INSERT INTO contract_signatures (contract_id,signed_by,role) VALUES ($1,$2,'builder')", [draft.contractId, users.builder]), /row-level security/);
  assert.equal((await one('SELECT count(*)::int AS count FROM contract_signatures')).count, 0);
});

test('authentic signatures, funding, builder submission and startup release complete the workflow', async () => {
  const { contractId, milestoneId } = await fixture({ signatures: false, funded: false, balance: 0, status: 'contract_drafted', escrowAmount: 33.33, milestoneStatus: 'in_progress' });
  await asUser(users.founder, "UPDATE contracts SET status='sent_for_signing' WHERE id=$1", [contractId]);
  await asUser(users.founder, "INSERT INTO contract_signatures (contract_id,signed_by,role) VALUES ($1,$2,'founder')", [contractId, users.founder]);
  assert.equal((await one('SELECT status FROM contracts WHERE id=$1', [contractId])).status, 'partially_signed');
  await asUser(users.builder, "INSERT INTO contract_signatures (contract_id,signed_by,role) VALUES ($1,$2,'builder')", [contractId, users.builder]);
  await asUser(users.founder, "SELECT fund_escrow($1,33.33,'BANK-ALL')", [contractId]);
  await asUser(users.builder, "UPDATE contract_milestones SET status='submitted' WHERE id=$1", [milestoneId]);
  await asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]);
  assert.deepEqual(await one('SELECT escrow_balance::text, status FROM contracts WHERE id=$1', [contractId]), { escrow_balance: '0.00', status: 'contract_active' });
  assert.equal((await financialSnapshot(contractId)).payment_count, 1);
});

test('direct clients cannot manufacture balances or rewrite signed milestone finances', async () => {
  const { contractId, milestoneId } = await fixture({ milestoneStatus: 'in_progress' });
  const previous = await financialSnapshot(contractId);
  for (const uid of [users.founder, users.builder]) {
    await assert.rejects(asUser(uid, 'UPDATE contracts SET escrow_balance=1000 WHERE id=$1', [contractId]));
    await assert.rejects(asUser(uid, 'UPDATE contract_milestones SET amount=1 WHERE id=$1', [milestoneId]));
    await assert.rejects(asUser(uid, "UPDATE contract_milestones SET status='escrow_released' WHERE id=$1", [milestoneId]));
    const deletion = await asUser(uid, 'DELETE FROM contract_milestones WHERE id=$1 RETURNING id', [milestoneId]);
    assert.equal(deletion.rows.length, 0);
    await assert.rejects(asUser(uid, "INSERT INTO contract_milestones (contract_id,title,amount) VALUES ($1,'Unauthorized milestone',1)", [contractId]));
  }
  assert.deepEqual(await financialSnapshot(contractId), previous);
  await asUser(users.builder, "UPDATE contract_milestones SET status='submitted' WHERE id=$1", [milestoneId]);
  await asUser(users.founder, "UPDATE contract_milestones SET status='revision_requested' WHERE id=$1", [milestoneId]);
  assert.equal((await one('SELECT status FROM contract_milestones WHERE id=$1', [milestoneId])).status, 'revision_requested');
});

test('a repeated deposit is rejected and cancelled milestones are excluded from funding', async () => {
  const { contractId } = await fixture({ funded: false, balance: 0, status: 'partially_signed', amount: 100 });
  await db.query("INSERT INTO contract_milestones (contract_id,title,amount,status,currency) VALUES ($1,'Cancelled work',50,'cancelled','INR')", [contractId]);
  await asUser(users.founder, "SELECT fund_escrow($1,100,'BANK-EXACT')", [contractId]);
  const previous = await financialSnapshot(contractId);
  await assert.rejects(asUser(users.founder, "SELECT fund_escrow($1,100,'BANK-RETRY')", [contractId]));
  assert.deepEqual(await financialSnapshot(contractId), previous);
});

test('historical payment evidence prevents a second release even if status was reset', async () => {
  const { contractId, milestoneId } = await fixture();
  await asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]);
  await db.query("UPDATE contract_milestones SET status='submitted' WHERE id=$1", [milestoneId]);
  const previous = await financialSnapshot(contractId);
  await assert.rejects(asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]), /already has a payment or escrow movement/);
  assert.deepEqual(await financialSnapshot(contractId), previous);
});

test('an escrow payment cannot be confirmed again by the builder', async () => {
  const { contractId, milestoneId } = await fixture();
  await asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]);
  const { id: paymentId } = await one('SELECT id FROM payment_records WHERE milestone_id=$1', [milestoneId]);
  const previous = await financialSnapshot(contractId);
  await assert.rejects(asUser(users.builder, 'SELECT confirm_payment_record($1,33.33)', [paymentId]), /[Ee]scrow/);
  assert.deepEqual(await financialSnapshot(contractId), previous);
});

test('dispute resolution refunds once and cannot be replayed', async () => {
  const { contractId, milestoneId, disputeId } = await fixture({ milestoneStatus: 'dispute' });
  await asUser(users.admin, "SELECT resolve_dispute($1,'refund_to_founder','Refund agreed')", [disputeId]);
  const previous = await financialSnapshot(contractId);
  assert.equal(previous.contract.balance, 66.67);
  assert.deepEqual(await one('SELECT status,resolution FROM disputes WHERE id=$1', [disputeId]), { status: 'resolved_founder', resolution: 'Refund agreed' });
  assert.equal((await one('SELECT entry_type FROM escrow_ledger WHERE milestone_id=$1', [milestoneId])).entry_type, 'refunded');
  await assert.rejects(asUser(users.admin, "SELECT resolve_dispute($1,'refund_to_founder','Retry')", [disputeId]), /already resolved/);
  assert.deepEqual(await financialSnapshot(contractId), previous);
});

test('direct payment confirmation preserves currency and issues a single separate fee invoice', async () => {
  const { contractId, milestoneId } = await fixture({ amount: 20, milestoneStatus: 'approved' });
  const paymentId = randomUUID();
  await db.query(`INSERT INTO payment_records (id,milestone_id,contract_id,startup_id,builder_id,declared_amount,payment_method,transaction_ref,currency)
    VALUES ($1,$2,$3,$4,$5,20,'bank','DIRECT-123','INR')`, [paymentId, milestoneId, contractId, users.founder, users.builder]);
  const result = await asUser(users.builder, "SELECT confirm_payment_record($1,20,'https://example.com/direct-proof.png') AS invoice_id", [paymentId]);
  assert.ok(result.rows[0].invoice_id);
  assert.deepEqual(await one('SELECT confirmed_amount::text,status,screenshot_url FROM payment_records WHERE id=$1', [paymentId]), {
    confirmed_amount: '20', status: 'confirmed', screenshot_url: 'https://example.com/direct-proof.png',
  });
  assert.deepEqual(await one('SELECT base_amount::text,commission_amount::text,currency FROM commission_invoices WHERE payment_record_id=$1', [paymentId]), {
    base_amount: '20', commission_amount: '3.00', currency: 'INR',
  });
  const previous = await financialSnapshot(contractId);
  await assert.rejects(asUser(users.builder, 'SELECT confirm_payment_record($1,20)', [paymentId]));
  assert.deepEqual(await financialSnapshot(contractId), previous);
});

test('direct payment confirmation rejects unauthorized and invalid amounts without opening a dispute', async () => {
  const { contractId, milestoneId } = await fixture({ amount: 20, milestoneStatus: 'approved' });
  const paymentId = randomUUID();
  await db.query(`INSERT INTO payment_records (id,milestone_id,contract_id,startup_id,builder_id,declared_amount,payment_method,transaction_ref,currency)
    VALUES ($1,$2,$3,$4,$5,20,'bank','DIRECT-INVALID','INR')`, [paymentId, milestoneId, contractId, users.founder, users.builder]);
  const previous = await financialSnapshot(contractId);
  for (const uid of [null, users.founder, users.outsider]) {
    await assert.rejects(asUser(uid, 'SELECT confirm_payment_record($1,20)', [paymentId]));
  }
  for (const amount of [null, '-1', 'NaN', 'Infinity']) {
    await assert.rejects(asUser(users.builder, 'SELECT confirm_payment_record($1,$2::numeric)', [paymentId, amount]));
  }
  assert.equal((await one('SELECT count(*)::int AS count FROM disputes')).count, 0);
  assert.deepEqual(await financialSnapshot(contractId), previous);
  assert.equal((await one('SELECT status FROM payment_records WHERE id=$1', [paymentId])).status, 'declared');
});

test('legacy active contracts can release while preserving the original lifecycle state', async () => {
  const { contractId, milestoneId } = await fixture({ status: 'active' });
  await asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]);
  assert.equal((await financialSnapshot(contractId)).contract.balance, 66.67);
  assert.equal((await financialSnapshot(contractId)).contract.status, 'active');
});

test('a builder payment destination is required on the server for funding and release', async () => {
  const funded = await fixture();
  const unfunded = await fixture({ funded: false, balance: 0, status: 'partially_signed' });
  await db.exec('DELETE FROM payment_methods');
  const previous = await financialSnapshot(funded.contractId);
  await assert.rejects(asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [funded.milestoneId]), /payment (details|method)/);
  await assert.rejects(asUser(users.founder, "SELECT fund_escrow($1,33.33,'NO-PAYOUT')", [unfunded.contractId]), /payment (details|method)/);
  assert.deepEqual(await financialSnapshot(funded.contractId), previous);
  assert.equal((await financialSnapshot(unfunded.contractId)).contract.funded, false);
});

test('client contract inserts cannot fake funded escrow or an active lifecycle', async () => {
  const { projectId } = await fixture();
  const sql = `INSERT INTO contracts (project_id,founder_id,builder_id,status,escrow_funded,escrow_balance)
    VALUES ($1,$2,$3,$4,$5,$6)`;
  for (const [status, funded, balance] of [['contract_drafted', true, 100], ['contract_drafted', false, 100], ['contract_active', false, 0], ['active', false, 0]]) {
    await assert.rejects(asUser(users.founder, sql, [projectId, users.founder, users.builder, status, funded, balance]));
  }
  await asUser(users.founder, sql, [projectId, users.founder, users.builder, 'contract_drafted', false, 0]);
  assert.equal((await one('SELECT count(*)::int AS count FROM contracts')).count, 2);
});

test('refunding the final disputed milestone completes a contract with settled work', async () => {
  const { contractId, milestoneId } = await fixture({ balance: 33.33, milestoneStatus: 'dispute' });
  await db.query("INSERT INTO contract_milestones (contract_id,title,amount,status,currency) VALUES ($1,'Previously settled work',66.67,'fully_settled','INR')", [contractId]);
  await asUser(users.admin, "SELECT admin_resolve_escrow($1,$2,'refund_to_founder')", [contractId, milestoneId]);
  assert.deepEqual(await one('SELECT status,escrow_balance::text FROM contracts WHERE id=$1', [contractId]), {
    status: 'contract_completed', escrow_balance: '0.00',
  });
});

test('refunding every milestone closes the contract as cancelled', async () => {
  const { contractId, milestoneId } = await fixture({ balance: 33.33, milestoneStatus: 'dispute' });
  await asUser(users.admin, "SELECT admin_resolve_escrow($1,$2,'refund_to_founder')", [contractId, milestoneId]);
  assert.deepEqual(await one('SELECT status,escrow_balance::text FROM contracts WHERE id=$1', [contractId]), {
    status: 'cancelled', escrow_balance: '0.00',
  });
});

test('the migration repairs untouched generated drafts while preserving signed, funded and customized contracts', { skip: process.env.ESCROW_TEST_BASELINE === '1' }, async () => {
  const previousCreate = functionDefinition(await migration('20260615162252_116246a3-f205-4739-be38-9ada2fef0420.sql'), 'create_contract_from_offer');
  const newMigration = await readFile(resolve(repoRoot, process.env.ESCROW_MIGRATION || 'supabase/migrations/20261003120000_fix_escrow_workflow.sql'), 'utf8');
  await db.exec(previousCreate);
  const contracts = {};
  try {
    for (const kind of ['untouched', 'signed', 'funded', 'customized']) {
      const projectId = randomUUID();
      const offerId = randomUUID();
      await db.query("INSERT INTO projects (id,founder_id,title,currency) VALUES ($1,$2,'Legacy project','INR')", [projectId, users.founder]);
      await db.query("INSERT INTO offers (id,project_id,founder_id,builder_id,compensation,duration,currency) VALUES ($1,$2,$3,$4,100,'6 months','INR')", [offerId, projectId, users.founder, users.builder]);
      contracts[kind] = (await asUser(users.builder, 'SELECT create_contract_from_offer($1) AS id', [offerId])).rows[0].id;
    }
    await db.query("INSERT INTO contract_signatures (contract_id,signed_by,role) VALUES ($1,$2,'founder')", [contracts.signed, users.founder]);
    await db.query("UPDATE contracts SET escrow_funded=true,escrow_balance=100,status='contract_active' WHERE id=$1", [contracts.funded]);
    await db.query('UPDATE contract_milestones SET amount=16.60 WHERE contract_id=$1 AND order_index=0', [contracts.customized]);
    const saved = {};
    for (const kind of ['signed', 'funded', 'customized']) {
      saved[kind] = {
        finances: await financialSnapshot(contracts[kind]),
        currencies: await one('SELECT currency FROM contracts WHERE id=$1', [contracts[kind]]),
      };
    }
    assert.equal((await one('SELECT sum(amount)::text AS total FROM contract_milestones WHERE contract_id=$1', [contracts.untouched])).total, '100.02');
    await db.exec(newMigration);
    assert.deepEqual(await one("SELECT sum(amount)::text AS total,bool_and(currency='INR') AS currency_correct FROM contract_milestones WHERE contract_id=$1", [contracts.untouched]), { total: '100.00', currency_correct: true });
    assert.deepEqual(await one('SELECT amount::text FROM contract_milestones WHERE contract_id=$1 AND order_index=5', [contracts.untouched]), { amount: '16.70' });
    assert.deepEqual(await one('SELECT escrow_amount::text,currency FROM contracts WHERE id=$1', [contracts.untouched]), { escrow_amount: '100.00', currency: 'INR' });
    for (const kind of ['signed', 'funded', 'customized']) {
      assert.deepEqual(await financialSnapshot(contracts[kind]), saved[kind].finances, `${kind} history is preserved`);
      assert.deepEqual(await one('SELECT currency FROM contracts WHERE id=$1', [contracts[kind]]), saved[kind].currencies);
    }
  } finally {
    // Restore all current definitions even if a backfill assertion fails.
    await db.exec(newMigration);
  }
});

test('contract identities and terms sent for signing cannot be rewritten by clients', async () => {
  const { contractId, milestoneId } = await fixture({ signatures: false, funded: false, balance: 0, status: 'sent_for_signing', milestoneStatus: 'in_progress' });
  const previous = await financialSnapshot(contractId);
  await assert.rejects(asUser(users.founder, 'UPDATE contracts SET id=$1 WHERE id=$2', [randomUUID(), contractId]));
  await assert.rejects(asUser(users.founder, 'UPDATE contract_milestones SET id=$1 WHERE id=$2', [randomUUID(), milestoneId]));
  await assert.rejects(asUser(users.founder, "UPDATE contracts SET terms='Changed after signature request' WHERE id=$1", [contractId]));
  await assert.rejects(asUser(users.founder, 'UPDATE contract_milestones SET amount=1 WHERE id=$1', [milestoneId]));
  assert.deepEqual(await financialSnapshot(contractId), previous);
});

test('draft startup edits can synchronize the exact milestone total before sending for signatures', async () => {
  const { contractId, milestoneId } = await fixture({ signatures: false, funded: false, balance: 0, status: 'contract_drafted', milestoneStatus: 'in_progress' });
  await asUser(users.founder, 'UPDATE contract_milestones SET amount=150 WHERE id=$1', [milestoneId]);
  await assert.rejects(asUser(users.founder, 'UPDATE contracts SET escrow_amount=200 WHERE id=$1', [contractId]));
  await asUser(users.founder, 'UPDATE contracts SET escrow_amount=150 WHERE id=$1', [contractId]);
  await asUser(users.founder, "UPDATE contracts SET status='sent_for_signing' WHERE id=$1", [contractId]);
  assert.deepEqual(await one('SELECT escrow_amount::text,status FROM contracts WHERE id=$1', [contractId]), { escrow_amount: '150', status: 'sent_for_signing' });
});

test('clients can declare a valid direct payment but cannot forge escrow or confirmed payment records', async () => {
  const { contractId, milestoneId } = await fixture({ funded: false, balance: 0, status: 'active', amount: 20, milestoneStatus: 'approved' });
  const sql = `INSERT INTO payment_records (milestone_id,contract_id,startup_id,builder_id,declared_amount,payment_method,transaction_ref,currency,status)
    VALUES ($1,$2,$3,$4,$5,$6,'DIRECT-VALID',$7,$8) RETURNING id`;
  for (const [amount, method, currency, status] of [[20, 'escrow', 'INR', 'declared'], [20, 'bank', 'INR', 'confirmed'], [25, 'bank', 'INR', 'declared'], [20, 'bank', 'USD', 'declared']]) {
    await assert.rejects(asUser(users.founder, sql, [milestoneId, contractId, users.founder, users.builder, amount, method, currency, status]));
  }
  const otherContract = await fixture({ funded: false, balance: 0, status: 'active', amount: 20, milestoneStatus: 'approved' });
  await assert.rejects(asUser(users.founder, sql, [otherContract.milestoneId, contractId, users.founder, users.builder, 20, 'bank', 'INR', 'declared']));
  const result = await asUser(users.founder, sql, [milestoneId, contractId, users.founder, users.builder, 20, 'bank', 'INR', 'declared']);
  const paymentId = result.rows[0].id;
  await assert.rejects(asUser(users.founder, 'UPDATE payment_records SET declared_amount=1 WHERE id=$1', [paymentId]));
  await assert.rejects(asUser(users.builder, "UPDATE payment_records SET confirmed_amount=20,status='confirmed' WHERE id=$1", [paymentId]));
  const deletion = await asUser(users.founder, 'DELETE FROM payment_records WHERE id=$1 RETURNING id', [paymentId]);
  assert.equal(deletion.rows.length, 0);
  assert.deepEqual(await one('SELECT declared_amount::text,status FROM payment_records WHERE id=$1', [paymentId]), { declared_amount: '20', status: 'declared' });
});

test('startup fee submission and admin verification settle the final escrow milestone and complete the contract', async () => {
  const { contractId, milestoneId } = await fixture({ balance: 33.33 });
  await asUser(users.founder, 'SELECT release_escrow_for_milestone($1)', [milestoneId]);
  const { invoice_id: invoiceId, payment_id: paymentId, commission_amount: feeAmount } = await one(`
    SELECT ci.id AS invoice_id,pr.id AS payment_id,ci.commission_amount::text
    FROM commission_invoices ci JOIN payment_records pr ON pr.id=ci.payment_record_id
    WHERE pr.milestone_id=$1`, [milestoneId]);
  const result = await asUser(users.founder, `INSERT INTO commission_payments (invoice_id,startup_id,amount,transaction_ref,currency)
    VALUES ($1,$2,$3::numeric,'BANK-PLATFORM-FEE','INR') RETURNING id`, [invoiceId, users.founder, feeAmount]);
  const feeId = result.rows[0].id;
  await asUser(users.admin, "SELECT verify_commission_payment($1,true,'Fee payment verified')", [feeId]);
  assert.deepEqual(await one('SELECT status,escrow_balance::text FROM contracts WHERE id=$1', [contractId]), { status: 'contract_completed', escrow_balance: '0.00' });
  assert.equal((await one('SELECT status FROM contract_milestones WHERE id=$1', [milestoneId])).status, 'fully_settled');
  assert.equal((await one('SELECT status FROM payment_records WHERE id=$1', [paymentId])).status, 'settled');
  assert.equal((await one('SELECT status FROM commission_invoices WHERE id=$1', [invoiceId])).status, 'paid');
  assert.deepEqual(await one('SELECT status,verified_by FROM commission_payments WHERE id=$1', [feeId]), { status: 'admin_verified', verified_by: users.admin });
  assert.equal((await financialSnapshot(contractId)).ledger_count, 1);
});
