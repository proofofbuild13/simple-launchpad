// Execute the actual Deno edge handler with isolated database/provider doubles.
// Run: node --test supabase/tests/evaluate-submission.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { beforeEach, test } from 'node:test';
import ts from 'typescript';

const submissionId = '30000000-0000-4000-8000-000000000001';
const projectId = '40000000-0000-4000-8000-000000000001';
const source = (await readFile(new URL('../functions/evaluate-submission/index.ts', import.meta.url), 'utf8'))
  .replace(/import \{ createClient \} from "npm:@supabase\/supabase-js@2";/, 'const createClient = globalThis.createClient;');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
let rows, env, aiCalls, aiStatus, aiOutput, handler, requestUser, submissionUpdates;

function query(table) {
  const filters = [];
  let operation = 'select';
  let values;
  const run = () => {
    const matches = (rows[table] ?? []).filter((row) => filters.every(([key, value]) => row[key] === value));
    if (operation === 'update') {
      if (table === 'submissions') submissionUpdates++;
      matches.forEach((row) => Object.assign(row, values));
    }
    if (operation === 'upsert') {
      const existing = (rows[table] ?? []).find((row) => row.submission_id === values.submission_id);
      const scores = ['score_problem_fit', 'score_execution', 'score_ux', 'score_feasibility', 'score_innovation'];
      const row = { id: 'evaluation-1', ...values, total_score: scores.reduce((sum, key) => sum + (values[key] ?? 0), 0) };
      if (existing) Object.assign(existing, row); else rows[table].push(row);
    }
    return { data: matches, error: null };
  };
  const api = {
    select: () => api,
    eq: (key, value) => { filters.push([key, value]); return api; },
    update: (data) => { operation = 'update'; values = data; return api; },
    upsert: (data) => { operation = 'upsert'; values = data; return api; },
    maybeSingle: async () => { const result = run(); return { ...result, data: result.data[0] ?? null }; },
    then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
  };
  return api;
}

beforeEach(() => {
  rows = {
    submissions: [{ id: submissionId, project_id: projectId, title: 'Working prototype', status: 'submitted' }],
    projects: [{ id: projectId, founder_id: 'founder-1', title: 'A startup dashboard' }],
    user_roles: [{ user_id: 'founder-1', role: 'startup' }, { user_id: 'outsider-1', role: 'startup' }, { user_id: 'builder-1', role: 'builder' }],
    ai_submission_evaluations: [],
  };
  env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service', SUPABASE_ANON_KEY: 'test-anon', LOVABLE_API_KEY: 'test-ai' };
  requestUser = { id: 'founder-1' };
  aiCalls = 0;
  submissionUpdates = 0;
  aiStatus = 200;
  aiOutput = { score_problem_fit: 15, score_execution: 15, score_ux: 15, score_feasibility: 15, score_innovation: 15,
    summary_verdict: 'A clear business case with early execution evidence.', strengths: ['Clear audience'], gaps: ['Traction needs validation'], recommendation: 'iterate', startup_grade: 'B' };
  vm.runInNewContext(code, {
    Deno: { env: { get: (key) => env[key] }, serve: (callback) => { handler = callback; } },
    createClient: () => ({ from: query, auth: { getUser: async () => ({ data: { user: requestUser }, error: null }) } }),
    fetch: async () => {
      aiCalls++;
      return new Response(JSON.stringify(aiStatus === 200 ? { choices: [{ message: { content: JSON.stringify(aiOutput) } }] } : { error: 'test provider failure' }), { status: aiStatus });
    },
    Request, Response, AbortSignal, console: { error: () => {} },
  });
});

async function evaluate({ token = 'test-service', body = { submission_id: submissionId }, method = 'POST' } = {}) {
  const response = await handler(new Request('https://example.test/evaluate', {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  }));
  return { status: response.status, body: await response.json() };
}

test('the project startup can evaluate through its authenticated user token', async () => {
  const result = await evaluate({ token: 'user-token' });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(aiCalls, 1);
  assert.equal(rows.submissions[0].ai_score, 75);
});

test('another startup cannot evaluate or read the cached result', async () => {
  requestUser = { id: 'outsider-1' };
  rows.ai_submission_evaluations.push({ id: 'cached', submission_id: submissionId, prompt_version: 2, recommendation: 'fundable', error: null });
  const result = await evaluate({ token: 'user-token' });
  assert.equal(result.status, 403);
  assert.equal(aiCalls, 0);
});

test('a builder cannot use startup evaluation access', async () => {
  requestUser = { id: 'builder-1' };
  const result = await evaluate({ token: 'user-token' });
  assert.equal(result.status, 403);
  assert.equal(aiCalls, 0);
});

test('a failed evaluation at the current prompt version is retried', async () => {
  rows.ai_submission_evaluations.push({ id: 'failed', submission_id: submissionId, prompt_version: 2, error: 'rate_limited', recommendation: null });
  const result = await evaluate();
  assert.equal(result.status, 200);
  assert.equal(aiCalls, 1);
  assert.equal(rows.ai_submission_evaluations.length, 1);
  assert.equal(rows.ai_submission_evaluations[0].error, null);
  assert.equal(rows.ai_submission_evaluations[0].total_score, 75);
});

test('a successful cached evaluation does not require another AI request and repairs the summary', async () => {
  rows.ai_submission_evaluations.push({ id: 'cached', submission_id: submissionId, prompt_version: 2, error: null, recommendation: 'iterate', total_score: 75 });
  delete env.LOVABLE_API_KEY;
  const result = await evaluate();
  assert.equal(result.status, 200);
  assert.equal(result.body.skipped, 'already evaluated');
  assert.equal(aiCalls, 0);
  assert.equal(rows.submissions[0].ai_score, 75);
  assert.equal(submissionUpdates, 1);
});

test('the summary UPDATE webhook stops without another update or AI request', async () => {
  rows.ai_submission_evaluations.push({ id: 'cached', submission_id: submissionId, prompt_version: 2, error: null, recommendation: 'iterate', total_score: 75 });
  Object.assign(rows.submissions[0], { ai_score: 75, ai_recommendation: 'iterate' });
  const result = await evaluate({ body: { type: 'UPDATE', table: 'submissions', record: rows.submissions[0] } });
  assert.equal(result.status, 200);
  assert.equal(result.body.skipped, 'already evaluated');
  assert.equal(aiCalls, 0);
  assert.equal(submissionUpdates, 0);
});

test('provider throttling is reported as a failed retryable evaluation, not success with a zero score', async () => {
  aiStatus = 429;
  const result = await evaluate();
  assert.equal(result.status, 429);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, 'rate_limited');
  assert.equal(rows.ai_submission_evaluations[0].error, 'rate_limited');
  assert.equal(rows.submissions[0].ai_score, undefined);
});

test('invalid model scores are rejected before storing successful evaluation data', async () => {
  aiOutput.score_execution = 999;
  const result = await evaluate();
  assert.equal(result.status, 502);
  assert.equal(result.body.error, 'invalid_ai_response');
  assert.equal(rows.ai_submission_evaluations[0].recommendation, null);
  assert.equal(rows.submissions[0].ai_score, undefined);
});

test('missing provider configuration yields an actionable error without creating a failed score', async () => {
  delete env.LOVABLE_API_KEY;
  const result = await evaluate();
  assert.equal(result.status, 503);
  assert.equal(result.body.error, 'ai_not_configured');
  assert.equal(rows.ai_submission_evaluations.length, 0);
});

test('missing service configuration cannot authorize a Bearer undefined request', async () => {
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  const result = await evaluate({ token: 'undefined' });
  assert.equal(result.status, 503);
  assert.equal(aiCalls, 0);
});

test('invalid submission identifiers and unsupported methods do not run evaluations', async () => {
  assert.equal((await evaluate({ body: { submission_id: 'invalid-id' } })).status, 400);
  assert.equal((await evaluate({ method: 'GET' })).status, 405);
  assert.equal(aiCalls, 0);
});
