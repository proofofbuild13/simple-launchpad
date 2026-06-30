// Founder AI Agent — conversational project posting.
// Intents: chat, approve_post, send_invites, broaden_match,
//          fetch_shortlist, evaluate_new_submission, refresh_stats, reset.
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "google/gemini-3-flash-preview";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ThreadStats = {
  matched?: number;
  invited?: number;
  submissions?: number;
  shortlisted?: number;
  evaluated?: number;
  project_draft?: any;
  awaiting?: "post_project" | "send_invites" | null;
};

async function callAI(systemPrompt: string, userPrompt: string, jsonSchema?: any): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const body: any = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
  if (jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "out", strict: true, schema: jsonSchema },
    };
  }
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify(body),
  });
  if (resp.status === 429) throw new Error("rate_limited");
  if (resp.status === 402) throw new Error("credits_exhausted");
  if (!resp.ok) throw new Error(`gateway_${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (jsonSchema) return typeof content === "string" ? JSON.parse(content) : content;
  return content ?? "";
}

function classifyIntent(msg: string): "shortlist" | "broaden" | "invite_more" | "status" | "chat" {
  const m = msg.toLowerCase();
  if (/(shortlist|top picks?|rank|best builders?|who's best)/.test(m)) return "shortlist";
  if (/(broaden|widen|more builders?|other builders?|expand)/.test(m)) return "broaden";
  if (/(invite more|send more invites?)/.test(m)) return "invite_more";
  if (/(status|progress|how(\s+is|'s)|what'?s happening)/.test(m)) return "status";
  return "chat";
}

function rankBuilders(builders: any[], skills: string[]) {
  return (builders ?? [])
    .map((b: any) => {
      const overlap = (b.skills ?? []).filter((s: string) =>
        skills.some((q) => q.toLowerCase() === String(s).toLowerCase()),
      ).length;
      const expBoost = b.experience_level === "senior" ? 8 : b.experience_level === "mid" ? 4 : 0;
      const ratingBoost = Math.round(Number(b.rating ?? 0) * 2);
      const max = Math.max(skills.length, 1);
      const match_score = Math.min(98, Math.round((overlap / max) * 70 + expBoost + ratingBoost + 15));
      return { ...b, overlap, match_score };
    })
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const intent = String(body?.intent ?? "chat");
  let threadId: string | undefined = body?.thread_id;

  if (!threadId) {
    const { data: existing } = await admin
      .from("agent_threads")
      .select("id")
      .eq("founder_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) threadId = existing.id;
    else {
      const { data: created, error: cErr } = await admin
        .from("agent_threads")
        .insert({ founder_id: user.id, status: "active", current_stage: 0, stats: {} })
        .select("id")
        .single();
      if (cErr) return json({ error: "thread_create_failed", details: cErr.message }, 500);
      threadId = created.id;
    }
  }

  const { data: thread, error: tErr } = await admin
    .from("agent_threads").select("*").eq("id", threadId).eq("founder_id", user.id).maybeSingle();
  if (tErr || !thread) return json({ error: "thread not found" }, 404);

  const stats: ThreadStats = (thread.stats as ThreadStats) || {};

  async function appendMessage(role: string, content: string, parts: any[] = []) {
    await admin.from("agent_messages").insert({ thread_id: threadId, role, content, parts });
  }
  async function updateThread(patch: any) {
    await admin.from("agent_threads").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", threadId);
  }

  // Recompute counts directly from the source tables (single source of truth).
  async function recomputeStats(projectId: string | null, base: ThreadStats): Promise<ThreadStats> {
    const next: ThreadStats = { ...base };
    if (!projectId) return next;
    const [{ count: subCount }, { data: evals }] = await Promise.all([
      admin.from("submissions").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      admin.from("ai_submission_evaluations").select("recommendation").eq("project_id", projectId),
    ]);
    next.submissions = subCount ?? 0;
    next.evaluated = evals?.length ?? 0;
    next.shortlisted = (evals ?? []).filter(
      (e: any) => e.recommendation === "fundable" || e.recommendation === "iterate",
    ).length;
    return next;
  }

  try {
    // ============ chat ============
    if (intent === "chat") {
      const userMsg = String(body?.message ?? "").trim();
      if (!userMsg) return json({ error: "message required" }, 400);
      await appendMessage("user", userMsg);

      // No draft, no project → parse + draft
      if (!stats.project_draft && !thread.project_id) {
        await updateThread({ current_stage: 1 });
        const parseSchema = {
          type: "object", additionalProperties: false,
          properties: {
            title: { type: "string" }, category: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            duration: { type: "string" },
            difficulty: { type: "string", enum: ["junior", "mid", "senior"] },
            short_description: { type: "string" },
            clarification_needed: { type: "boolean" },
            clarification_question: { type: "string" },
          },
          required: ["title", "category", "skills", "duration", "difficulty", "short_description", "clarification_needed", "clarification_question"],
        };
        const parsed = await callAI(
          `You are ProofBuild's project intake agent. Extract structured fields from the founder's brief. If the brief is too vague (no clear deliverable, no tech stack hint, no domain), set clarification_needed=true with a short clarification_question. Otherwise set clarification_needed=false and clarification_question="". Infer reasonable defaults for missing fields.`,
          userMsg, parseSchema,
        );
        if (parsed.clarification_needed) {
          await appendMessage("assistant", parsed.clarification_question, [{ type: "text", text: parsed.clarification_question }]);
          return json({ ok: true, thread_id: threadId });
        }

        await updateThread({ current_stage: 2 });
        const draftSchema = {
          type: "object", additionalProperties: false,
          properties: {
            title: { type: "string" }, category: { type: "string" },
            short_description: { type: "string" }, description: { type: "string" },
            requirements: { type: "string" }, deliverables: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            difficulty: { type: "string" }, duration: { type: "string" },
          },
          required: ["title", "category", "short_description", "description", "requirements", "deliverables", "skills", "difficulty", "duration"],
        };
        const draft = await callAI(
          `You write builder-ready project briefs. Output JSON only.
- description: 3-5 sentences, third person.
- requirements: 4-7 newline-separated lines (no markdown bullets).
- deliverables: 3-5 newline-separated lines.
No invented budgets or company names.`,
          `Parsed brief: ${JSON.stringify(parsed)}\n\nOriginal: ${userMsg}`,
          draftSchema,
        );

        stats.project_draft = draft;
        stats.awaiting = "post_project";
        await updateThread({ current_stage: 2, stats });

        const reply = `Here's the draft for **${draft.title}**. Review it, then I can post it and start matching builders.`;
        await appendMessage("assistant", reply, [
          { type: "text", text: reply },
          { type: "project_preview", project: draft },
        ]);
        return json({ ok: true, thread_id: threadId });
      }

      // Has draft, not posted → refine
      if (stats.project_draft && !thread.project_id) {
        const refineSchema = {
          type: "object", additionalProperties: false,
          properties: {
            title: { type: "string" }, category: { type: "string" },
            short_description: { type: "string" }, description: { type: "string" },
            requirements: { type: "string" }, deliverables: { type: "string" },
            skills: { type: "array", items: { type: "string" } },
            difficulty: { type: "string" }, duration: { type: "string" },
            changes_summary: { type: "string" },
          },
          required: ["title", "category", "short_description", "description", "requirements", "deliverables", "skills", "difficulty", "duration", "changes_summary"],
        };
        const refined = await callAI(
          `Refine an existing project brief based on the founder's edit request. Apply only the requested changes; keep everything else. Output JSON with the full updated brief and a 1-sentence changes_summary.`,
          `Current draft: ${JSON.stringify(stats.project_draft)}\n\nFounder's edit: ${userMsg}`,
          refineSchema,
        );
        const { changes_summary, ...newDraft } = refined as any;
        stats.project_draft = newDraft;
        stats.awaiting = "post_project";
        await updateThread({ stats });

        const reply = `Updated. ${changes_summary} Ready to post when you are.`;
        await appendMessage("assistant", reply, [
          { type: "text", text: reply },
          { type: "project_preview", project: newDraft },
        ]);
        return json({ ok: true, thread_id: threadId });
      }

      // Project already posted → simple intent routing
      const sub = classifyIntent(userMsg);
      if (sub === "shortlist") {
        return await runFetchShortlist();
      }
      if (sub === "broaden") {
        return await runBroaden();
      }
      if (sub === "status") {
        const fresh = await recomputeStats(thread.project_id, stats);
        await updateThread({ stats: fresh });
        const reply = `Status: **${fresh.matched ?? 0}** matched · **${fresh.invited ?? 0}** invited · **${fresh.submissions ?? 0}** submission(s) · **${fresh.shortlisted ?? 0}** in shortlist.`;
        await appendMessage("assistant", reply, [{ type: "text", text: reply }]);
        return json({ ok: true, thread_id: threadId });
      }

      const reply = await callAI(
        `You are ProofBuild's founder agent. A project is already posted. Keep replies under 3 sentences and steer toward: review shortlist, broaden matching, or invite more builders.`,
        userMsg,
      );
      await appendMessage("assistant", reply, [{ type: "text", text: reply }]);
      return json({ ok: true, thread_id: threadId });
    }

    // ============ approve_post ============
    if (intent === "approve_post") {
      const draft = stats.project_draft;
      if (!draft) return json({ error: "no draft to post" }, 400);
      await appendMessage("user", "Post the project.");
      await updateThread({ current_stage: 3 });

      const { data: proj, error: pErr } = await admin
        .from("projects")
        .insert({
          founder_id: user.id,
          title: draft.title,
          category: draft.category ?? null,
          short_description: draft.short_description,
          description: draft.description,
          requirements: draft.requirements,
          deliverables: draft.deliverables,
          difficulty: draft.difficulty ?? "mid",
          timeline: draft.duration ?? null,
          tags: Array.isArray(draft.skills) ? draft.skills : [],
          engagement_type: "project_hire",
          visibility: "public",
          status: "open_for_submissions",
        })
        .select("id, title")
        .single();
      if (pErr) {
        const msg = `Couldn't post the project: ${pErr.message}`;
        await appendMessage("assistant", msg, [{ type: "text", text: msg }]);
        return json({ error: pErr.message }, 500);
      }

      const skills: string[] = Array.isArray(draft.skills) ? draft.skills : [];
      const { data: builders } = await admin
        .from("builder_profiles")
        .select("id, full_name, username, title, skills, experience_level, location, avatar_url, rating, total_projects, available")
        .eq("available", true)
        .overlaps("skills", skills.length ? skills : ["__none__"])
        .limit(20);

      const scored = rankBuilders(builders ?? [], skills);

      stats.project_draft = null as any;
      stats.matched = scored.length;
      stats.awaiting = scored.length ? "send_invites" : null;
      await updateThread({ current_stage: 3, project_id: proj.id, stats });

      const reply = scored.length
        ? `Project posted. I scanned the database and found **${scored.length} matched builders**. Review the top picks below — I can send invitations.`
        : `Project posted. No exact skill matches in the database. Want me to broaden the search?`;
      const parts: any[] = [
        { type: "text", text: reply },
        { type: "project_posted", project_id: proj.id, title: proj.title },
      ];
      if (scored.length) parts.push({ type: "builders", builders: scored });
      else parts.push({ type: "broaden_prompt" });
      await appendMessage("assistant", reply, parts);
      return json({ ok: true, thread_id: threadId, project_id: proj.id });
    }

    // ============ send_invites ============
    if (intent === "send_invites") {
      const builderIds: string[] = Array.isArray(body?.builder_ids) ? body.builder_ids : [];
      if (!builderIds.length || !thread.project_id) {
        return json({ error: "builder_ids and active project required" }, 400);
      }
      await appendMessage("user", `Send invitations to ${builderIds.length} builders.`);
      await updateThread({ current_stage: 4 });

      const { data: builders } = await admin
        .from("builder_profiles")
        .select("id, full_name")
        .in("id", builderIds);
      const validIds = (builders ?? []).map((b: any) => b.id);
      if (!validIds.length) return json({ error: "no valid builders" }, 400);

      const projectTitle = (await admin.from("projects").select("title").eq("id", thread.project_id).single()).data?.title ?? "this project";

      const rows = validIds.map((id) => ({
        project_id: thread.project_id, founder_id: user.id, builder_id: id,
        message: `You're a strong match for "${projectTitle}". Take a look and submit your work.`,
        status: "sent",
      }));
      const { error: invErr } = await admin.from("project_invitations").insert(rows);
      if (invErr) {
        const msg = `Couldn't send invitations: ${invErr.message}`;
        await appendMessage("assistant", msg, [{ type: "text", text: msg }]);
        return json({ error: invErr.message }, 500);
      }

      await admin.from("notifications").insert(validIds.map((id) => ({
        user_id: id, type: "project_invitation", title: "New project invitation",
        body: `A founder invited you to submit on "${projectTitle}".`,
        link: `/projects/${thread.project_id}`,
      })));

      stats.invited = (stats.invited ?? 0) + validIds.length;
      stats.awaiting = null;
      await updateThread({ current_stage: 5, stats });

      const reply = `Invitations sent to **${validIds.length} builders**. As they submit, I'll auto-evaluate each one and surface the shortlist here.`;
      await appendMessage("assistant", reply, [
        { type: "text", text: reply },
        { type: "invites_sent", count: validIds.length },
      ]);
      return json({ ok: true, thread_id: threadId, invited: validIds.length });
    }

    // ============ broaden_match ============
    if (intent === "broaden_match") {
      return await runBroaden();
    }

    // ============ fetch_shortlist ============
    if (intent === "fetch_shortlist") {
      return await runFetchShortlist();
    }

    // ============ evaluate_new_submission ============
    if (intent === "evaluate_new_submission") {
      const submissionId = String(body?.submission_id ?? "");
      if (!submissionId || !thread.project_id) return json({ error: "submission_id and project required" }, 400);

      // Skip if already evaluated.
      const { data: existing } = await admin
        .from("ai_submission_evaluations")
        .select("submission_id, total_score, startup_grade")
        .eq("submission_id", submissionId)
        .maybeSingle();

      let scoreLine = "";
      let builderName = "Builder";
      if (existing) {
        scoreLine = `${existing.total_score ?? "—"}/100 (${existing.startup_grade ?? "—"})`;
      } else {
        // Trigger evaluation via the existing edge function (service-role bearer).
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/evaluate-submission`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ submission_id: submissionId }),
        });
        if (!resp.ok) {
          console.error("evaluate-submission failed", resp.status, await resp.text());
          return json({ ok: false, skipped: true });
        }
        const { data: ev } = await admin
          .from("ai_submission_evaluations")
          .select("total_score, startup_grade")
          .eq("submission_id", submissionId)
          .maybeSingle();
        scoreLine = ev ? `${ev.total_score ?? "—"}/100 (${ev.startup_grade ?? "—"})` : "evaluation queued";
      }

      const { data: sub } = await admin
        .from("submissions")
        .select("builder_id, builder_profiles!inner(full_name)")
        .eq("id", submissionId)
        .maybeSingle();
      if (sub?.builder_profiles?.full_name) builderName = sub.builder_profiles.full_name;

      const fresh = await recomputeStats(thread.project_id, stats);
      await updateThread({ stats: fresh, current_stage: Math.max(thread.current_stage ?? 5, 5) });

      const reply = `Evaluated **${builderName}** — ${scoreLine}`;
      await appendMessage("assistant", reply, [
        { type: "text", text: reply },
        { type: "evaluation_pinged", submission_id: submissionId },
      ]);
      return json({ ok: true, thread_id: threadId });
    }

    // ============ refresh_stats ============
    if (intent === "refresh_stats") {
      const fresh = await recomputeStats(thread.project_id, stats);
      await updateThread({ stats: fresh });
      return json({ ok: true, stats: fresh });
    }

    // ============ reset ============
    if (intent === "reset") {
      await admin.from("agent_threads").update({ status: "archived" }).eq("id", threadId);
      const { data: created } = await admin
        .from("agent_threads")
        .insert({ founder_id: user.id, status: "active", current_stage: 0, stats: {} })
        .select("id").single();
      return json({ ok: true, thread_id: created?.id });
    }

    return json({ error: "unknown intent" }, 400);

    // ---- helpers that close over thread/stats ----
    async function runFetchShortlist() {
      if (!thread.project_id) return json({ error: "no project on thread" }, 400);
      const { data: evals } = await admin
        .from("ai_submission_evaluations")
        .select(`
          submission_id, total_score, summary_verdict, recommendation, startup_grade,
          strengths, gaps,
          submissions!inner(id, title, builder_id, status,
            builder_profiles!inner(full_name, username, avatar_url, experience_level))
        `)
        .eq("project_id", thread.project_id)
        .order("total_score", { ascending: false, nullsFirst: false })
        .limit(10);

      const list = evals ?? [];
      const shortlist = list.filter((e: any) => e.recommendation === "fundable" || e.recommendation === "iterate").slice(0, 5);

      const fresh = await recomputeStats(thread.project_id, stats);
      await updateThread({ stats: fresh, current_stage: shortlist.length ? 6 : (thread.current_stage ?? 5) });

      const reply = list.length
        ? `**${list.length} submission(s)** evaluated. Top ${shortlist.length} ranked below.`
        : `No evaluated submissions yet. As builders submit, I'll auto-evaluate and surface them here.`;
      await appendMessage("assistant", reply, [
        { type: "text", text: reply },
        ...(shortlist.length ? [{ type: "shortlist", shortlist }] : []),
      ]);
      return json({ ok: true, thread_id: threadId, evaluations: list, shortlist });
    }

    async function runBroaden() {
      if (!thread.project_id) return json({ error: "no project on thread" }, 400);
      const skills: string[] = Array.isArray(stats.project_draft?.skills)
        ? stats.project_draft.skills
        : ((await admin.from("projects").select("tags").eq("id", thread.project_id).single()).data?.tags ?? []);

      // Drop overlap filter: any available builder, ranked.
      const { data: builders } = await admin
        .from("builder_profiles")
        .select("id, full_name, username, title, skills, experience_level, location, avatar_url, rating, total_projects, available")
        .eq("available", true)
        .order("rating", { ascending: false, nullsFirst: false })
        .limit(30);

      const scored = rankBuilders(builders ?? [], skills);
      stats.matched = scored.length;
      stats.awaiting = scored.length ? "send_invites" : null;
      await updateThread({ stats });

      const reply = scored.length
        ? `Broadened the search — here are **${scored.length} more builders** ranked by rating and partial skill fit.`
        : `Still no available builders in the database. Try again later.`;
      await appendMessage("assistant", reply, [
        { type: "text", text: reply },
        ...(scored.length ? [{ type: "builders", builders: scored }] : []),
      ]);
      return json({ ok: true, thread_id: threadId });
    }
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (msg === "rate_limited") return json({ error: "rate_limited", message: "AI is busy. Try again shortly." }, 429);
    if (msg === "credits_exhausted") return json({ error: "credits_exhausted", message: "AI credits exhausted." }, 402);
    console.error("founder-agent error", msg);
    return json({ error: "internal_error", message: msg }, 500);
  }
});
