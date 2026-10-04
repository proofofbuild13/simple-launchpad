# Startup assistant repair

The `/agent` workflow had several connected failures. Clarification answers replaced the original brief; draft edits discarded parts of the scope and budget; builder matching used case-sensitive PostgreSQL array overlap; shortlist queries depended on a foreign-key relationship that does not exist; and failed AI evaluations could be counted as completed. The mobile status action was also unsupported by the server. Read errors, overlapping requests and stale responses could leave the page showing the wrong session or an empty chat.

## Corrected behavior

1. A startup describes its goal. The assistant keeps the original brief and clarification answers together, asks a useful question when needed, and prepares a complete project preview with requirements, deliverables, timeline, budget and currency. Follow-up edits preserve the other draft fields.
2. The startup reviews the draft and explicitly confirms **Post project**. One transaction creates the project and links it to the conversation. Retrying a completed post returns the same project. The migration also supplies the missing engagement enum and project column required by this workflow on clean database installs.
3. Builder matching compares normalized skill names, including common variations such as React/ReactJS and Node.js/NodeJS. The assistant presents available candidates and requires the startup to select and confirm invitations. **Invite more** offers additional candidates, excluding builders already invited.
4. Invitation records, notifications and thread state are committed together. Repeated requests reuse existing invitations. A failure rolls back the entire action.
5. The assistant recovers pending evaluations when the startup returns to the chat and responds to new submissions while the page is open. Each server batch handles up to five submissions concurrently. The client continues for at most three batches while progress is made; it stops on errors and offers **Refresh evaluations** for failures or remaining work.
6. Completed evaluations populate the shortlist through separate evaluation, submission and builder-profile queries. Failed attempts remain retryable and do not receive a successful score. Status counts come from the project records.
7. Questions about a posted project receive advice based on the project, recent conversation and current status. The assistant can help clarify scope, delivery risks, milestones, hiring and product decisions. Chat messages do not automatically post, invite, hire or transfer money.

Startup ownership is checked before project actions or evaluation calls. The evaluator also accepts an authenticated project owner directly, while rejecting other startup and builder accounts. Archived conversations remain readable; starting a replacement conversation is safe to retry.

The client waits for account roles to load, reports database and provider failures, blocks overlapping foreground actions, and discards callbacks from an older conversation. Background statistics merge only the fields they own, so they cannot restore an old draft or invitation confirmation. Workflow stages cannot regress. Cached evaluation summary repairs avoid unnecessary submission updates, preventing recursive UPDATE webhook calls.

## Rollout

These changes are local and have not been applied to the hosted platform.

1. Apply `supabase/migrations/20261003130000_fix_startup_agent.sql` using the project's normal migration process before deploying the updated functions. It defines the service-only atomic actions `post_agent_project`, `invite_agent_builders`, `reset_agent_thread` and `update_agent_thread`.
2. Deploy both `founder-agent` and `evaluate-submission` from `supabase/functions`, retaining the authentication settings in `supabase/config.toml`.
3. Confirm that Supabase supplies its URL, service key and anonymous/publishable key, and that the server has `LOVABLE_API_KEY`. Optional `FOUNDER_AGENT_MODEL` and `SUBMISSION_EVALUATION_MODEL` overrides allow the platform to use another gateway-supported model. Posting, invitations, status and previously completed evaluations do not depend on a new AI request.
4. Deploy the updated frontend and exercise the full workflow with a startup and builder account in staging. Check any configured submission webhook separately; catch-up while the assistant is open does not require that webhook.

Existing projects, invitations, messages and evaluation history are preserved. Historical duplicate invitations are not removed by this repair.

## Validation

- `npm test`: 62 frontend tests pass, including 20 tests for the assistant page and sidebar history.
- `node --test supabase/tests/founder-agent.test.mjs`: 29 handler regressions cover conversation context, startup/project ownership, posting and invitation retries, matching, shortlist hydration, evaluation recovery, concurrent state updates and database/provider failures.
- `node --test supabase/tests/evaluate-submission.test.mjs`: 11 handler regressions cover direct owner access, unauthorized calls, failed evaluation retries, provider errors, malformed scores and the summary UPDATE webhook.
- `supabase/tests/startup-agent-sql.test.mjs`: 10 tests execute the actual migration in isolated PostgreSQL via PGlite, checking publication, invitation rollback, retry safety, archived resets, partial state updates and service-only permissions. Set `PGLITE_RUNTIME_DIR` as described in `supabase/tests/escrow.test.mjs` before running it.
- Application TypeScript checking and the production Vite build pass.

Provider requests are mocked in handler tests; live gateway access, deployed credentials and simultaneous staging PostgreSQL transactions have not been verified. The evaluation remains a business assessment of supplied submission information. It does not inspect linked repositories, run submitted code or verify demos, and the assistant now describes that limitation accurately.
