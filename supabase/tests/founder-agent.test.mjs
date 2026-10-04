/**
 * Executes the actual Founder Agent edge handler with isolated in-memory
 * Supabase and HTTP boundaries. No deployed credentials or AI calls are used.
 * Run: node --test supabase/tests/founder-agent.test.mjs
 *
 * These tests cover handler behavior. Atomic SQL behavior is verified separately
 * against the migration; this mock is not a substitute for PostgreSQL locking.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const sourcePath = fileURLToPath(new URL('../functions/founder-agent/index.ts', import.meta.url));
const source = (await readFile(sourcePath, 'utf8')).replace(
  /import\s*\{\s*createClient\s*\}\s*from\s*["']npm:@supabase\/supabase-js@2["'];?/,
  'const createClient = __createClient;',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

const founderId = '00000000-0000-4000-8000-000000000001';
const threadId = '00000000-0000-4000-8000-000000000002';
const projectId = '00000000-0000-4000-8000-000000000003';
const builderId = '00000000-0000-4000-8000-000000000004';
const submissionId = '00000000-0000-4000-8000-000000000005';
const secondBuilderId = '00000000-0000-4000-8000-000000000006';
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const draft = (patch = {}) => ({
  title: 'Clinic appointment portal', category: 'Web',
  short_description: 'A React portal for clinic appointments and patient reminders.',
  description: 'A clinic needs an appointment portal for patients and reception staff. Patients should find open slots and book or cancel their visits. Staff need a daily schedule and reminders to reduce missed appointments. The deliverable is a working React application with a Supabase backend and setup instructions.',
  requirements: 'React frontend\nSupabase database\nPatient authentication\nAppointment scheduling',
  deliverables: 'Deployed application\nSource code\nSetup documentation',
  skills: ['React', 'Supabase'], difficulty: 'mid', duration: '4 weeks',
  budget: 2500, currency: 'USD', ...patch,
});
const parsed = (patch = {}) => ({ ...draft(), clarification_needed: false, clarification_question: '', ...patch });
const activeThread = (patch = {}) => ({
  id: threadId, founder_id: founderId, project_id: null, status: 'active', current_stage: 0,
  stats: {}, created_at: '2026-10-03T01:00:00.000Z', updated_at: '2026-10-03T01:00:00.000Z', ...patch,
});
const project = (patch = {}) => ({
  id: projectId, founder_id: founderId, title: draft().title, tags: ['React', 'Supabase'],
  status: 'open_for_submissions', visibility: 'public', ...patch,
});
const builder = (id = builderId, patch = {}) => ({
  id, full_name: id === builderId ? 'Asha Builder' : 'Ben Builder', username: 'builder',
  skills: ['React', 'Supabase'], experience_level: 'senior', rating: 4.5, available: true, ...patch,
});
const submission = (patch = {}) => ({
  id: submissionId, project_id: projectId, builder_id: builderId, title: 'Clinic demo',
  status: 'submitted', ...patch,
});
const evaluation = (patch = {}) => ({
  id: randomUUID(), submission_id: submissionId, project_id: projectId,
  total_score: 85, startup_grade: 'A', recommendation: 'fundable', error: null,
  summary_verdict: 'Useful patient experience.', strengths: ['Clear deliverable'], gaps: [], ...patch,
});

class Query {
  constructor(state, table) {
    this.state = state; this.table = table; this.operation = 'select'; this.filters = [];
    this.columns = '*'; this.options = {}; this.ordering = []; this.cardinality = 'many';
  }
  select(columns = '*', options = {}) { this.columns = columns; this.options = options; return this; }
  insert(rows) { this.operation = 'insert'; this.payload = clone(rows); return this; }
  update(patch) { this.operation = 'update'; this.payload = clone(patch); return this; }
  upsert(rows, options = {}) { this.operation = 'upsert'; this.payload = clone(rows); this.upsertOptions = options; return this; }
  delete() { this.operation = 'delete'; return this; }
  eq(column, value) { this.filters.push((row) => row[column] === value); return this; }
  neq(column, value) { this.filters.push((row) => row[column] !== value); return this; }
  is(column, value) { this.filters.push((row) => (row[column] ?? null) === value); return this; }
  in(column, values) { this.filters.push((row) => values.includes(row[column])); return this; }
  overlaps(column, values) { this.filters.push((row) => (row[column] ?? []).some((item) => values.includes(item))); return this; }
  contains(column, values) { this.filters.push((row) => values.every((item) => (row[column] ?? []).includes(item))); return this; }
  not(column, operator, value) {
    if (operator === 'in') {
      const values = String(value).replace(/^\(|\)$/g, '').split(',');
      this.filters.push((row) => !values.includes(row[column]));
    } else if (operator === 'is') this.filters.push((row) => (row[column] ?? null) !== value);
    else throw new Error(`Unsupported mock operator: not ${operator}`);
    return this;
  }
  order(column, options = {}) { this.ordering.push({ column, ...options }); return this; }
  limit(limit) { this.rowLimit = limit; return this; }
  range(start, end) { this.rowStart = start; this.rowLimit = end - start + 1; return this; }
  single() { this.cardinality = 'one'; return this; }
  maybeSingle() { this.cardinality = 'maybe'; return this; }
  then(resolve, reject) { return (this.result ??= this.execute()).then(resolve, reject); }
  async execute() {
    const trace = { table: this.table, operation: this.operation, columns: this.columns, payload: clone(this.payload) };
    this.state.queries.push(trace);
    if (this.table === 'agent_threads' && this.operation === 'update' && this.payload.stats) this.state.beforeStatsWrite?.();
    const forcedError = this.state.failures.find((failure) =>
      failure.table === this.table && failure.operation === this.operation && (!failure.match || failure.match(trace)));
    if (forcedError) {
      if (forcedError.once) this.state.failures.splice(this.state.failures.indexOf(forcedError), 1);
      return { data: null, count: null, error: { message: forcedError.message, code: 'XX000' } };
    }
    // The production schema has no FK from submissions.builder_id to builder_profiles.
    if (['submissions', 'ai_submission_evaluations'].includes(this.table) && /builder_profiles[!(]/.test(this.columns)) {
      return { data: null, error: { message: 'Could not find a relationship between submissions and builder_profiles', code: 'PGRST200' } };
    }
    const tableRows = this.state.tables[this.table] ??= [];
    let rows = tableRows.filter((row) => this.filters.every((predicate) => predicate(row)));
    if (this.operation === 'insert' || this.operation === 'upsert') {
      rows = [];
      for (const value of Array.isArray(this.payload) ? this.payload : [this.payload]) {
        const keys = this.upsertOptions?.onConflict?.split(',') ?? ['id'];
        const existing = this.operation === 'upsert' && tableRows.find((row) => keys.every((key) => row[key] === value[key]));
        if (existing) {
          if (!this.upsertOptions?.ignoreDuplicates) { Object.assign(existing, clone(value)); rows.push(existing); }
        } else {
          const row = { id: randomUUID(), created_at: new Date().toISOString(), ...clone(value) };
          tableRows.push(row); rows.push(row);
        }
      }
    } else if (this.operation === 'update') rows.forEach((row) => Object.assign(row, clone(this.payload)));
    else if (this.operation === 'delete') this.state.tables[this.table] = tableRows.filter((row) => !rows.includes(row));
    const count = rows.length;
    for (const sort of [...this.ordering].reverse()) rows.sort((a, b) => {
      const aValue = a[sort.column]; const bValue = b[sort.column];
      if (aValue == null || bValue == null) return aValue == null ? (sort.nullsFirst ? -1 : 1) : (sort.nullsFirst ? 1 : -1);
      const direction = sort.ascending === false ? -1 : 1;
      return aValue < bValue ? -direction : aValue > bValue ? direction : 0;
    });
    rows = rows.slice(this.rowStart ?? 0, this.rowLimit == null ? undefined : (this.rowStart ?? 0) + this.rowLimit);
    if (this.cardinality === 'one' && rows.length !== 1) return { data: null, count, error: { message: 'Expected one row', code: 'PGRST116' } };
    if (this.cardinality === 'maybe' && rows.length > 1) return { data: null, count, error: { message: 'Multiple rows', code: 'PGRST116' } };
    return { data: this.options.head ? null : clone(this.cardinality === 'many' ? rows : rows[0] ?? null), count, error: null };
  }
}

function createHarness({ tables = {}, ai = [], role = 'startup', apiKey = 'test-ai-key', authenticated = true, evaluate } = {}) {
  const state = {
    tables: {
      agent_threads: [activeThread()], agent_messages: [], projects: [], project_invitations: [],
      builder_profiles: [], submissions: [], ai_submission_evaluations: [], notifications: [],
      user_roles: [{ id: randomUUID(), user_id: founderId, role }], ...clone(tables),
    },
    queries: [], failures: [], aiCalls: [], evaluationCalls: [], rpcCalls: [],
  };
  const env = {
    SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key', LOVABLE_API_KEY: apiKey,
  };
  let handler;
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: founderId } : null }, error: null }) },
    from: (table) => new Query(state, table),
    rpc: async (name, args) => {
      state.rpcCalls.push({ name, args: clone(args) });
      if (name === 'has_role') return { data: args._role === role, error: null };
      const thread = state.tables.agent_threads.find((row) => row.id === args._thread_id && row.founder_id === args._founder_id);
      if (!thread) return { data: null, error: { message: 'Thread not found' } };
      const operationError = (table, operation) => state.failures.find((entry) => entry.table === table && entry.operation === operation);
      const rpcFailure = operationError(name, 'rpc');
      if (rpcFailure) return { data: null, error: { message: rpcFailure.message } };
      if (name === 'update_agent_thread') {
        const writeFailure = operationError('agent_threads', 'update');
        if (writeFailure) return { data: null, error: { message: writeFailure.message } };
        state.beforeStatsWrite?.();
        thread.stats = { ...thread.stats, ...clone(args._stats_patch ?? {}) };
        if (args._stage != null) thread.current_stage = Math.max(thread.current_stage, args._stage);
        thread.updated_at = new Date().toISOString();
        return { data: clone(thread), error: null };
      }
      if (name === 'post_agent_project') {
        if (thread.project_id) {
          const existing = state.tables.projects.find((row) => row.id === thread.project_id);
          return { data: { project_id: thread.project_id, title: existing?.title, already_posted: true }, error: null };
        }
        const writeFailure = operationError('projects', 'insert') || operationError('agent_threads', 'update');
        if (writeFailure) return { data: null, error: { message: writeFailure.message } };
        const value = thread.stats.project_draft;
        if (!value) return { data: null, error: { message: 'No draft to post' } };
        const posted = {
          id: randomUUID(), founder_id: args._founder_id, title: value.title,
          category: value.category,
          short_description: value.short_description, description: value.description,
          requirements: value.requirements, deliverables: value.deliverables,
          difficulty: value.difficulty, timeline: value.duration, tags: value.skills,
          budget: value.budget ?? null, currency: value.currency ?? 'USD',
          engagement_type: 'project_hire', visibility: 'public', status: 'open_for_submissions',
        };
        state.tables.projects.push(posted);
        thread.project_id = posted.id; thread.stats.project_draft = null; thread.current_stage = 3;
        return { data: { project_id: posted.id, title: posted.title, already_posted: false }, error: null };
      }
      if (name === 'invite_agent_builders') {
        const writeFailure = operationError('project_invitations', 'insert') || operationError('project_invitations', 'upsert') || operationError('notifications', 'insert') || operationError('agent_threads', 'update');
        if (writeFailure) return { data: null, error: { message: writeFailure.message } };
        const existing = state.tables.project_invitations.filter((row) => row.project_id === thread.project_id);
        const ids = [...new Set(args._builder_ids)].filter((id) => state.tables.builder_profiles.some((row) => row.id === id));
        const newIds = ids.filter((id) => !existing.some((row) => row.builder_id === id));
        for (const id of newIds) {
          state.tables.project_invitations.push({ id: randomUUID(), project_id: thread.project_id, founder_id: args._founder_id, builder_id: id, status: 'sent' });
          state.tables.notifications.push({ id: randomUUID(), user_id: id, type: 'project_invitation' });
        }
        const total = existing.length + newIds.length;
        thread.stats.invited = total; thread.stats.awaiting = null; thread.current_stage = 5;
        return { data: { invited: newIds.length, builder_ids: newIds, invited_total: total, already_invited: ids.length - newIds.length }, error: null };
      }
      if (name === 'reset_agent_thread') {
        const writeFailure = operationError('agent_threads', 'insert') || operationError('agent_threads', 'update');
        if (writeFailure) return { data: null, error: { message: writeFailure.message } };
        const newThread = activeThread({ id: randomUUID() });
        thread.status = 'archived'; state.tables.agent_threads.push(newThread);
        return { data: { thread_id: newThread.id }, error: null };
      }
      throw new Error(`Unimplemented RPC in test harness: ${name}`);
    },
  };
  vm.runInNewContext(compiled, {
    __createClient: () => client,
    Deno: { env: { get: (name) => env[name] }, serve: (value) => { handler = value; } },
    Request, Response, Headers, URL, AbortSignal, AbortController, setTimeout, clearTimeout,
    crypto: globalThis.crypto, TextEncoder,
    console: { error() {}, log() {}, warn() {} },
    fetch: async (url, options) => {
      if (String(url).includes('ai.gateway.lovable.dev')) {
        const payload = JSON.parse(options.body); state.aiCalls.push(payload);
        assert.ok(ai.length, 'The handler made an unexpected AI request');
        const next = ai.shift();
        if (next instanceof Response) return next;
        return new Response(JSON.stringify({ choices: [{ message: { content: typeof next === 'string' ? next : JSON.stringify(next) } }] }), { status: 200 });
      }
      if (String(url).includes('/evaluate-submission')) {
        const payload = JSON.parse(options.body); state.evaluationCalls.push(payload);
        return evaluate ? await evaluate(payload, state) : new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      throw new Error(`Unexpected HTTP request: ${url}`);
    },
  }, { filename: sourcePath });
  return {
    state,
    fail: (table, operation = 'select', message = 'Database unavailable', options = {}) => state.failures.push({ table, operation, message, ...options }),
    async request(body, options = {}) {
      const response = await handler(new Request('https://test.supabase.co/functions/v1/founder-agent', {
        method: options.method ?? 'POST',
        headers: { 'Content-Type': 'application/json', ...(options.auth === false ? {} : { Authorization: 'Bearer user-token' }) },
        ...((options.method ?? 'POST') === 'POST' ? { body: JSON.stringify({ thread_id: threadId, ...body }) } : {}),
      }));
      return { status: response.status, body: response.status === 200 && options.method === 'OPTIONS' ? await response.text() : await response.json() };
    },
  };
}

test('preflight succeeds and requests without authentication are rejected', async () => {
  const h = createHarness();
  assert.equal((await h.request({}, { method: 'OPTIONS' })).status, 200);
  assert.equal((await h.request({ intent: 'refresh_stats' }, { auth: false })).status, 401);
  assert.equal(h.state.queries.length, 0);
});

test('only startup users may use the founder agent', async () => {
  const h = createHarness({ role: 'builder' });
  const result = await h.request({ intent: 'chat', message: 'Build a React clinic portal.' });
  assert.equal(result.status, 403);
  assert.equal(h.state.aiCalls.length, 0);
  assert.equal(h.state.tables.agent_messages.length, 0);
});

test('a founder cannot access another founder thread', async () => {
  const h = createHarness({ tables: { agent_threads: [activeThread({ founder_id: 'other-founder' })] } });
  assert.equal((await h.request({ intent: 'refresh_stats' })).status, 404);
});

test('an owned thread linked to another startup project is rejected before matching or evaluation', async () => {
  const h = createHarness({ tables: {
    agent_threads: [activeThread({ project_id: projectId })],
    projects: [project({ founder_id: 'another-startup' })],
    builder_profiles: [builder()], submissions: [submission()],
  } });
  for (const request of [
    { intent: 'broaden_match' },
    { intent: 'evaluate_new_submission', submission_id: submissionId },
  ]) {
    const result = await h.request(request);
    assert.equal(result.status, 404, JSON.stringify(result.body));
  }
  assert.equal(h.state.evaluationCalls.length, 0);
  assert.equal(h.state.aiCalls.length, 0);
  assert.equal(h.state.tables.agent_messages.length, 0);
  assert.ok(!h.state.queries.some((query) => ['builder_profiles', 'submissions', 'ai_submission_evaluations'].includes(query.table)));
});

test('archived threads cannot be changed or resumed by a stale browser request', async () => {
  const h = createHarness({ tables: { agent_threads: [activeThread({ status: 'archived', stats: { project_draft: draft() } })] } });
  const result = await h.request({ intent: 'approve_post' });
  assert.ok([400, 403, 409].includes(result.status), JSON.stringify(result.body));
  assert.equal(h.state.tables.projects.length, 0);
  assert.equal(h.state.tables.agent_messages.length, 0);
  assert.equal(h.state.aiCalls.length, 0);
});

test('clarification answers retain the original project brief for parsing and drafting', async () => {
  const h = createHarness({ ai: [
    parsed({ clarification_needed: true, clarification_question: 'What should patients be able to do?' }),
    parsed(), draft(),
  ] });
  assert.equal((await h.request({ intent: 'chat', message: 'I need a clinic appointment portal.' })).status, 200);
  assert.equal((await h.request({ intent: 'chat', message: 'Patients book and cancel appointments using React and Supabase.' })).status, 200);
  const secondParse = JSON.stringify(h.state.aiCalls[1].messages);
  assert.match(secondParse, /clinic appointment portal/);
  assert.match(secondParse, /Patients book and cancel/);
  assert.match(JSON.stringify(h.state.aiCalls[2].messages), /clinic appointment portal/);
  assert.equal(h.state.tables.agent_threads[0].stats.project_draft.title, draft().title);
});

test('draft refinement sends the existing full brief together with the correction', async () => {
  const h = createHarness({
    tables: { agent_threads: [activeThread({ current_stage: 2, stats: { project_draft: draft(), awaiting: 'post_project' } })] },
    ai: [{ ...draft({ duration: '6 weeks' }), changes_summary: 'Changed the timeline to six weeks.' }],
  });
  assert.equal((await h.request({ intent: 'chat', message: 'Make the timeline six weeks.' })).status, 200);
  const prompt = JSON.stringify(h.state.aiCalls[0].messages);
  assert.match(prompt, /Clinic appointment portal/);
  assert.match(prompt, /Make the timeline six weeks/);
  assert.equal(h.state.tables.agent_threads[0].stats.project_draft.duration, '6 weeks');
  assert.equal(h.state.tables.agent_threads[0].stats.project_draft.budget, 2500);
});

test('malformed AI output is reported without storing a broken draft', async () => {
  const h = createHarness({ ai: ['not a JSON document'] });
  const result = await h.request({ intent: 'chat', message: 'Build a React clinic appointment portal.' });
  assert.ok(result.status >= 400);
  assert.equal(h.state.tables.agent_threads[0].stats.project_draft, undefined);
  assert.equal(h.state.tables.projects.length, 0);
});

test('AI rate limits are preserved for actionable frontend error handling', async () => {
  const h = createHarness({ ai: [new Response('Rate limited', { status: 429 })] });
  const result = await h.request({ intent: 'chat', message: 'Build a React clinic appointment portal.' });
  assert.equal(result.status, 429);
  assert.equal(result.body.error, 'rate_limited');
});

test('posting uses the authoritative draft through the atomic publication RPC', async () => {
  const h = createHarness({ tables: {
    agent_threads: [activeThread({ stats: { project_draft: draft({ budget: 5000, currency: 'INR' }), awaiting: 'post_project' } })],
    builder_profiles: [builder()],
  } });
  const result = await h.request({ intent: 'approve_post', founder_id: 'attacker-id', project_draft: draft({ title: 'Unreviewed replacement draft' }) });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.deepEqual(h.state.rpcCalls.find((call) => call.name === 'post_agent_project')?.args, { _thread_id: threadId, _founder_id: founderId });
  assert.ok(!h.state.queries.some((query) => query.table === 'projects' && query.operation === 'insert'));
  const posted = h.state.tables.projects[0];
  assert.equal(posted.founder_id, founderId);
  assert.equal(posted.title, draft().title);
  assert.equal(posted.category, 'Web');
  assert.ok(posted.description.length >= 100);
  assert.equal(posted.budget, 5000);
  assert.equal(posted.currency, 'INR');
  assert.equal(posted.engagement_type, 'project_hire');
  assert.equal(h.state.tables.agent_threads[0].project_id, posted.id);
});

test('repeating project approval returns the same project without publishing twice', async () => {
  const h = createHarness({ tables: { agent_threads: [activeThread({ stats: { project_draft: draft(), awaiting: 'post_project' } })] } });
  const first = await h.request({ intent: 'approve_post' });
  const retry = await h.request({ intent: 'approve_post' });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(retry.status, 200, JSON.stringify(retry.body));
  assert.equal(retry.body.project_id, first.body.project_id);
  assert.equal(h.state.tables.projects.length, 1);
});

test('publication retries after a lost assistant message reuse the already-published project', async () => {
  const h = createHarness({ tables: { agent_threads: [activeThread({ stats: { project_draft: draft(), awaiting: 'post_project' } })] } });
  h.fail('agent_messages', 'insert', 'Assistant message could not be saved', { once: true, match: (query) => query.payload.role === 'assistant' });
  const failedReply = await h.request({ intent: 'approve_post' });
  assert.ok(failedReply.status >= 400);
  assert.equal(h.state.tables.projects.length, 1);
  const postedId = h.state.tables.projects[0].id;
  const retry = await h.request({ intent: 'approve_post' });
  assert.equal(retry.status, 200, JSON.stringify(retry.body));
  assert.equal(retry.body.project_id, postedId);
  assert.equal(h.state.tables.projects.length, 1);
});

test('project insert errors retain a retryable draft and never report publication', async () => {
  const h = createHarness({ tables: { agent_threads: [activeThread({ stats: { project_draft: draft(), awaiting: 'post_project' } })] } });
  h.fail('projects', 'insert', 'Insert rejected');
  const result = await h.request({ intent: 'approve_post' });
  assert.ok(result.status >= 400);
  assert.equal(h.state.tables.projects.length, 0);
  assert.equal(h.state.tables.agent_threads[0].stats.project_draft.title, draft().title);
  assert.ok(!h.state.tables.agent_messages.some((message) => message.parts?.some((part) => part.type === 'project_posted')));
});

test('repeated invitations do not create duplicate invitations, notifications, or inflated counts', async () => {
  const h = createHarness({ tables: {
    agent_threads: [activeThread({ project_id: projectId })], projects: [project()], builder_profiles: [builder(), builder(secondBuilderId)],
  } });
  const first = await h.request({ intent: 'send_invites', builder_ids: [builderId, builderId, secondBuilderId] });
  const retry = await h.request({ intent: 'send_invites', builder_ids: [builderId, secondBuilderId] });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(retry.status, 200, JSON.stringify(retry.body));
  assert.equal(h.state.tables.project_invitations.length, 2);
  assert.equal(h.state.tables.notifications.length, 2);
  assert.equal(h.state.tables.agent_threads[0].stats.invited, 2);
});

test('invitation write failures never report invitations as sent', async () => {
  const h = createHarness({ tables: {
    agent_threads: [activeThread({ project_id: projectId })], projects: [project()], builder_profiles: [builder()],
  } });
  h.fail('project_invitations', 'insert', 'Invitation insert rejected');
  h.fail('project_invitations', 'upsert', 'Invitation insert rejected');
  const result = await h.request({ intent: 'send_invites', builder_ids: [builderId] });
  assert.ok(result.status >= 400);
  assert.equal(h.state.tables.project_invitations.length, 0);
  assert.equal(h.state.tables.notifications.length, 0);
  assert.ok(!h.state.tables.agent_messages.some((message) => message.parts?.some((part) => part.type === 'invites_sent')));
});

test('broaden matching excludes builders already invited to the project', async () => {
  const h = createHarness({ tables: {
    agent_threads: [activeThread({ project_id: projectId })], projects: [project()],
    builder_profiles: [builder(), builder(secondBuilderId)],
    project_invitations: [{ id: randomUUID(), project_id: projectId, founder_id: founderId, builder_id: builderId, status: 'sent' }],
  } });
  const result = await h.request({ intent: 'broaden_match' });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  const displayed = h.state.tables.agent_messages.flatMap((message) => message.parts ?? []).find((part) => part.type === 'builders').builders;
  assert.deepEqual(displayed.map((row) => row.id), [secondBuilderId]);
});

test('the invite-more chat command offers new candidates instead of making an unrelated AI call', async () => {
  const h = createHarness({ tables: {
    agent_threads: [activeThread({ project_id: projectId })], projects: [project()],
    builder_profiles: [builder(), builder(secondBuilderId)],
    project_invitations: [{ id: randomUUID(), project_id: projectId, founder_id: founderId, builder_id: builderId, status: 'sent' }],
  } });
  const result = await h.request({ intent: 'chat', message: 'Send more invites' });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(h.state.aiCalls.length, 0);
  const displayed = h.state.tables.agent_messages.flatMap((message) => message.parts ?? []).find((part) => part.type === 'builders').builders;
  assert.deepEqual(displayed.map((row) => row.id), [secondBuilderId]);
});

test('evaluation rejects a submission from another project before calling the evaluator', async () => {
  const h = createHarness({ tables: {
    agent_threads: [activeThread({ project_id: projectId })], projects: [project()],
    submissions: [submission({ project_id: 'another-project' })],
  } });
  const result = await h.request({ intent: 'evaluate_new_submission', submission_id: submissionId });
  assert.ok([403, 404].includes(result.status), JSON.stringify(result.body));
  assert.equal(h.state.evaluationCalls.length, 0);
  assert.equal(h.state.tables.agent_messages.length, 0);
});

test('failed stored evaluations are retried and successful results use the builder profile', async () => {
  const h = createHarness({ tables: {
    agent_threads: [activeThread({ project_id: projectId })], projects: [project()],
    submissions: [submission()], builder_profiles: [builder()],
    ai_submission_evaluations: [evaluation({ error: 'AI gateway unavailable', total_score: 0, recommendation: null })],
  }, evaluate: async (_payload, state) => {
    state.tables.ai_submission_evaluations = [evaluation()];
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } });
  const result = await h.request({ intent: 'evaluate_new_submission', submission_id: submissionId });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(h.state.evaluationCalls.length, 1);
  assert.match(h.state.tables.agent_messages.at(-1).content, /Asha Builder/);
  assert.match(h.state.tables.agent_messages.at(-1).content, /85/);
});

test('an evaluator failure is returned to the caller and never creates a success ping', async () => {
  const h = createHarness({ tables: {
    agent_threads: [activeThread({ project_id: projectId })], projects: [project()], submissions: [submission()],
  }, evaluate: async () => new Response(JSON.stringify({ error: 'AI unavailable' }), { status: 503 }) });
  const result = await h.request({ intent: 'evaluate_new_submission', submission_id: submissionId });
  assert.ok(result.status >= 400);
  assert.equal(h.state.tables.agent_messages.length, 0);
});

test('an evaluator HTTP success with a stored AI failure remains a failed evaluation', async () => {
  const h = createHarness({ tables: {
    agent_threads: [activeThread({ project_id: projectId })], projects: [project()], submissions: [submission()],
  }, evaluate: async (_payload, state) => {
    state.tables.ai_submission_evaluations = [evaluation({ error: 'AI credits exhausted', total_score: 0, recommendation: null })];
    return new Response(JSON.stringify({ id: state.tables.ai_submission_evaluations[0].id, error: 'AI credits exhausted' }), { status: 200 });
  } });
  const result = await h.request({ intent: 'evaluate_new_submission', submission_id: submissionId });
  assert.ok(result.status >= 400);
  assert.ok(!h.state.tables.agent_messages.some((message) => message.parts?.some((part) => part.type === 'evaluation_pinged')));
});

test('catch-up evaluates at most five pending submissions and counts successful evaluations only', async () => {
  const pending = Array.from({ length: 8 }, (_, index) => submission({ id: randomUUID(), created_at: `2026-10-03T01:00:0${index}.000Z` }));
  const h = createHarness({ tables: {
    agent_threads: [activeThread({ project_id: projectId })], projects: [project()], submissions: pending,
    ai_submission_evaluations: [evaluation({ submission_id: pending[0].id, error: 'Previous AI failure', recommendation: null, total_score: 0 })],
  }, evaluate: async (payload, state) => {
    state.tables.ai_submission_evaluations = state.tables.ai_submission_evaluations.filter((row) => row.submission_id !== payload.submission_id);
    state.tables.ai_submission_evaluations.push(evaluation({ submission_id: payload.submission_id }));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } });
  const result = await h.request({ intent: 'sync_evaluations' });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(h.state.evaluationCalls.length, 5);
  assert.equal(new Set(h.state.evaluationCalls.map((row) => row.submission_id)).size, 5);
  assert.equal(h.state.tables.agent_threads[0].stats.evaluated, 5);
  assert.equal(h.state.tables.agent_threads[0].stats.submissions, 8);
});

test('shortlists hydrate submissions and builder profiles without an unsupported FK join', async () => {
  const failedSubmission = '00000000-0000-4000-8000-000000000007';
  const h = createHarness({ tables: {
    agent_threads: [activeThread({ project_id: projectId })], projects: [project()],
    submissions: [submission(), submission({ id: failedSubmission, builder_id: secondBuilderId })],
    builder_profiles: [builder(), builder(secondBuilderId)],
    ai_submission_evaluations: [evaluation(), evaluation({ submission_id: failedSubmission, error: 'AI failed', total_score: 99 })],
  } });
  const result = await h.request({ intent: 'fetch_shortlist' });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.shortlist.length, 1);
  assert.equal(result.body.shortlist[0].submission_id, submissionId);
  assert.equal(result.body.shortlist[0].submissions.builder_profiles.full_name, 'Asha Builder');
  assert.equal(h.state.tables.agent_threads[0].stats.evaluated, 1);
});

test('failed shortlist reads are reported instead of silently showing an empty shortlist', async () => {
  const h = createHarness({ tables: { agent_threads: [activeThread({ project_id: projectId })], projects: [project()] } });
  h.fail('ai_submission_evaluations');
  const result = await h.request({ intent: 'fetch_shortlist' });
  assert.ok(result.status >= 400);
  assert.equal(h.state.tables.agent_messages.length, 0);
});

test('statistics remain usable without an AI API key and ignore failed evaluations', async () => {
  const h = createHarness({ apiKey: null, tables: {
    agent_threads: [activeThread({ project_id: projectId })], projects: [project()], submissions: [submission()],
    project_invitations: [{ id: randomUUID(), project_id: projectId, founder_id: founderId, builder_id: builderId, status: 'sent' }],
    ai_submission_evaluations: [evaluation({ error: 'AI failed', recommendation: null, total_score: 0 })],
  } });
  const result = await h.request({ intent: 'refresh_stats' });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.stats.submissions, 1);
  assert.equal(result.body.stats.invited, 1);
  assert.equal(result.body.stats.evaluated, 0);
  assert.equal(h.state.aiCalls.length, 0);
});

test('a background counter refresh preserves invitation state changed after its initial read', async () => {
  const h = createHarness({ tables: {
    agent_threads: [activeThread({ project_id: projectId, current_stage: 6, stats: { awaiting: 'send_invites', matched: 2 } })],
    projects: [project()], submissions: [submission()],
  } });
  h.state.beforeStatsWrite = () => {
    h.state.beforeStatsWrite = undefined;
    // Another request completed its invitation transaction after this request
    // read the old thread but before this counter refresh writes back.
    h.state.tables.agent_threads[0].stats.awaiting = null;
    h.state.tables.agent_threads[0].current_stage = 7;
  };
  const result = await h.request({ intent: 'refresh_stats' });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(h.state.tables.agent_threads[0].stats.awaiting, null);
  assert.equal(h.state.tables.agent_threads[0].current_stage, 7);
  assert.equal(h.state.tables.agent_threads[0].stats.submissions, 1);
  const patch = h.state.rpcCalls.find((call) => call.name === 'update_agent_thread')?.args._stats_patch;
  assert.ok(patch, 'Counter refresh must use the atomic partial-update RPC');
  assert.equal(Object.hasOwn(patch, 'awaiting'), false);
  assert.equal(Object.hasOwn(patch, 'project_draft'), false);
});

test('a reviewed draft can be posted when the chat AI API key is unavailable', async () => {
  const h = createHarness({ apiKey: null, tables: {
    agent_threads: [activeThread({ stats: { project_draft: draft(), awaiting: 'post_project' } })],
  } });
  const result = await h.request({ intent: 'approve_post' });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(h.state.tables.projects.length, 1);
  assert.equal(h.state.aiCalls.length, 0);
});

test('message write failures stop processing instead of losing the conversation silently', async () => {
  const h = createHarness({ ai: [parsed(), draft()] });
  h.fail('agent_messages', 'insert', 'Message storage unavailable');
  const result = await h.request({ intent: 'chat', message: 'Build a React appointment portal using Supabase.' });
  assert.ok(result.status >= 400);
  assert.equal(h.state.aiCalls.length, 0);
});

test('reset failures are reported instead of returning success without a new thread', async () => {
  const h = createHarness();
  h.fail('agent_threads', 'insert', 'Thread insert rejected');
  const result = await h.request({ intent: 'reset' });
  assert.ok(result.status >= 400);
  assert.notEqual(result.body.ok, true);
});
