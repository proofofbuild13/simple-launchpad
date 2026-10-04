// Test the actual atomic agent actions in isolated PostgreSQL.
// Reuse the PGlite setup documented in escrow.test.mjs, then run:
// $env:PGLITE_RUNTIME_DIR = Join-Path $env:TEMP 'launchpad-escrow-pglite'
// node --test supabase/tests/startup-agent-sql.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, beforeEach, test } from 'node:test';

const require = createRequire(join(process.env.PGLITE_RUNTIME_DIR || process.cwd(), 'package.json'));
const { PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href);
const db = new PGlite();
const founderId = '10000000-0000-4000-8000-000000000001';
const builderId = '10000000-0000-4000-8000-000000000002';
const otherId = '10000000-0000-4000-8000-000000000003';
const threadId = '20000000-0000-4000-8000-000000000001';
const draft = { title: 'Clinic appointment portal', category: 'Web', short_description: 'A clinic scheduling portal.',
  description: 'Patients need to book visits with a clinic. The portal provides available slots and reminders.',
  requirements: 'Patient sign in\nScheduling', deliverables: 'Deployed demo\nSource code', skills: ['React'], difficulty: 'mid', duration: '4 weeks', budget: 2500, currency: 'INR' };

async function migration(file) { return readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8'); }
function table(sql, name) {
  const result = sql.match(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? (?:public\\.)?${name} \\([\\s\\S]*?\\r?\\n\\);`));
  assert.ok(result, `Original schema exists for ${name}`);
  return result[0];
}
function fn(sql, name) {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  assert.notEqual(start, -1);
  const remaining = sql.slice(start);
  const delimiter = remaining.match(/AS (\$[a-z_]*\$)/i)[1];
  const body = remaining.indexOf(delimiter);
  return remaining.slice(0, remaining.indexOf(delimiter, body + delimiter.length) + delimiter.length + 1);
}
async function one(sql, values = []) { return (await db.query(sql, values)).rows[0]; }
async function service(sql, values = []) {
  await db.exec('SET ROLE service_role');
  try { return await one(sql, values); } finally { await db.exec('RESET ROLE'); }
}
async function post(id = threadId, founder = founderId) {
  return (await service('SELECT public.post_agent_project($1,$2) AS result', [id, founder])).result;
}
async function invite(ids = [builderId]) {
  return (await service('SELECT public.invite_agent_builders($1,$2,$3::uuid[]) AS result', [threadId, founderId, ids])).result;
}

before(async () => {
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TYPE public.app_role AS ENUM ('startup','builder','admin','super_admin');`);
  const base = await migration('20260509110425_9c21d086-d461-48d5-b265-334de4af1f51.sql');
  for (const name of ['user_roles', 'builder_profiles', 'projects', 'notifications']) await db.exec(table(base, name));
  await db.exec(fn(base, 'has_role'));
  await db.exec(fn(base, 'touch_updated_at'));
  await db.exec("ALTER TABLE public.projects ADD COLUMN currency text NOT NULL DEFAULT 'USD'");
  const agents = await migration('20260629163518_55e50de6-b060-40cd-b609-7fd9f1932cce.sql');
  for (const name of ['agent_threads', 'agent_messages']) await db.exec(table(agents, name));
  await db.exec(table(await migration('20260518160000_platform_updates.sql'), 'project_invitations'));
  await db.exec('GRANT USAGE ON SCHEMA public TO authenticated,anon,service_role');
  const repair = await migration('20261003130000_fix_startup_agent.sql');
  await db.exec(repair);
  await db.exec(repair); // Applying the repair twice must be safe.
});
beforeEach(async () => {
  await db.exec('RESET ROLE; TRUNCATE auth.users, user_roles, builder_profiles, projects, notifications, agent_threads, agent_messages, project_invitations RESTART IDENTITY CASCADE');
  for (const id of [founderId, builderId, otherId]) await db.query('INSERT INTO auth.users VALUES ($1)', [id]);
  await db.query("INSERT INTO public.user_roles (user_id,role) VALUES ($1,'startup'),($2,'builder'),($3,'startup')", [founderId,builderId,otherId]);
  await db.query("INSERT INTO public.builder_profiles (id,full_name,skills,available) VALUES ($1,'Builder',ARRAY['React'],true)", [builderId]);
  await db.query("INSERT INTO public.agent_threads (id,founder_id,status,stats) VALUES ($1,$2,'active',$3)", [threadId,founderId,{ project_draft: draft, awaiting: 'post_project' }]);
});
after(async () => { await db.close(); });

test('posting preserves the approved brief and records the thread/project link atomically', async () => {
  const result = await post();
  assert.ok(result.project_id);
  const project = await one('SELECT * FROM public.projects WHERE id=$1', [result.project_id]);
  assert.equal(project.founder_id, founderId);
  assert.equal(project.budget, '2500');
  assert.equal(project.currency, 'INR');
  assert.equal(project.category, 'Web');
  assert.equal(project.status, 'open_for_submissions');
  assert.equal(project.engagement_type, 'project_hire');
  const thread = await one('SELECT * FROM public.agent_threads WHERE id=$1', [threadId]);
  assert.equal(thread.project_id, project.id);
  assert.equal(thread.stats.project_draft, null);
});

test('posting the same approved draft twice produces one project', async () => {
  const first = await post();
  const second = await post();
  assert.equal(second.project_id, first.project_id);
  assert.equal((await one('SELECT count(*)::int AS count FROM public.projects')).count, 1);
});

test('a project post cannot cross startup ownership or run on an archived chat', async () => {
  await assert.rejects(post(threadId, otherId));
  await db.query("UPDATE public.agent_threads SET status='archived' WHERE id=$1", [threadId]);
  await assert.rejects(post());
  assert.equal((await one('SELECT count(*)::int AS count FROM public.projects')).count, 0);
});

test('an invalid approved draft leaves the thread and projects unchanged', async () => {
  await db.query("UPDATE public.agent_threads SET stats=$2 WHERE id=$1", [threadId,{ project_draft: { ...draft, title: '' } }]);
  await assert.rejects(post());
  assert.equal((await one('SELECT project_id FROM public.agent_threads WHERE id=$1', [threadId])).project_id, null);
  assert.equal((await one('SELECT count(*)::int AS count FROM public.projects')).count, 0);
});

test('repeated or duplicate invitation requests create only one invite and notification per builder', async () => {
  await post();
  assert.equal((await invite([builderId,builderId])).invited, 1);
  assert.equal((await invite()).invited, 0);
  assert.equal((await one('SELECT count(*)::int AS count FROM public.project_invitations')).count, 1);
  assert.equal((await one("SELECT count(*)::int AS count FROM public.notifications WHERE type='project_invitation'")).count, 1);
  assert.equal((await one('SELECT stats FROM public.agent_threads WHERE id=$1', [threadId])).stats.invited, 1);
});

test('invitation notification failure rolls back invitations and statistics together', async () => {
  await post();
  const previous = await one('SELECT stats,current_stage FROM public.agent_threads WHERE id=$1', [threadId]);
  await db.exec("CREATE FUNCTION public.fail_agent_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test notification failure'; END $$; CREATE TRIGGER fail_agent_notification BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.fail_agent_notification()");
  try {
    await assert.rejects(invite());
    assert.equal((await one('SELECT count(*)::int AS count FROM public.project_invitations')).count, 0);
    assert.deepEqual(await one('SELECT stats,current_stage FROM public.agent_threads WHERE id=$1', [threadId]), previous);
  } finally {
    await db.exec('DROP TRIGGER fail_agent_notification ON public.notifications; DROP FUNCTION public.fail_agent_notification()');
  }
});

test('reset requests archive once and return the same replacement chat on retries', async () => {
  const first = (await service('SELECT public.reset_agent_thread($1,$2) AS result', [threadId,founderId])).result;
  const second = (await service('SELECT public.reset_agent_thread($1,$2) AS result', [threadId,founderId])).result;
  assert.ok(first.thread_id);
  assert.equal(second.thread_id, first.thread_id);
  assert.equal((await one('SELECT status FROM public.agent_threads WHERE id=$1', [threadId])).status, 'archived');
  assert.equal((await one('SELECT count(*)::int AS count FROM public.agent_threads')).count, 2);
});

test('a historical archived chat can start a replacement once without modifying its old messages', async () => {
  await db.query("UPDATE public.agent_threads SET status='archived' WHERE id=$1", [threadId]);
  await db.query("INSERT INTO public.agent_messages (thread_id,role,content) VALUES ($1,'user','Original brief')", [threadId]);
  const first = (await service('SELECT public.reset_agent_thread($1,$2) AS result', [threadId,founderId])).result;
  const retry = (await service('SELECT public.reset_agent_thread($1,$2) AS result', [threadId,founderId])).result;
  assert.equal(retry.thread_id, first.thread_id);
  assert.equal((await one('SELECT count(*)::int AS count FROM public.agent_threads')).count, 2);
  assert.equal((await one('SELECT content FROM public.agent_messages WHERE thread_id=$1', [threadId])).content, 'Original brief');
});

test('background statistics preserve action state and never move the workflow backwards', async () => {
  await post();
  await invite();
  await db.query('UPDATE public.agent_threads SET current_stage=6 WHERE id=$1', [threadId]);
  const updated = (await service('SELECT public.update_agent_thread($1,$2,$3,5) AS result', [threadId,founderId,{ evaluated: 3, pending: 2 }])).result;
  assert.equal(updated.current_stage, 6);
  assert.equal(updated.stats.awaiting, null);
  assert.equal(updated.stats.invited, 1);
  assert.equal(updated.stats.evaluated, 3);
  assert.equal(updated.stats.pending, 2);
  assert.equal(updated.stats.project_draft, null);
  await assert.rejects(service('SELECT public.update_agent_thread($1,$2,$3,5) AS result', [threadId,otherId,{ evaluated: 99 }]));
});

test('authenticated and anonymous browser callers cannot invoke service-only project actions', async () => {
  for (const role of ['authenticated','anon']) {
    await db.exec(`SET ROLE ${role}`);
    try {
      await assert.rejects(db.query('SELECT public.post_agent_project($1,$2)', [threadId,founderId]), /permission denied/);
      await assert.rejects(db.query('SELECT public.invite_agent_builders($1,$2,$3::uuid[])', [threadId,founderId,[builderId]]), /permission denied/);
      await assert.rejects(db.query('SELECT public.reset_agent_thread($1,$2)', [threadId,founderId]), /permission denied/);
      await assert.rejects(db.query('SELECT public.update_agent_thread($1,$2,$3,5)', [threadId,founderId,{ evaluated: 99 }]), /permission denied/);
    } finally { await db.exec('RESET ROLE'); }
  }
});
