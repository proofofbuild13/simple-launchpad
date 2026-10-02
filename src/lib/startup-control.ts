import { supabase } from "@/integrations/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StartupStats {
  active_projects: number;
  total_submissions: number;
  unique_builders: number;
  total_spend: number;
}

export interface StartupProject {
  id: string;
  title: string;
  status: string;
  budget: number | null;
  category: string | null;
  created_at: string;
  submission_count?: number;
}

export interface StartupRoom {
  id: string;
  room_id: string;
  content: string;
  created_at: string;
  reply_count: number;
}

export interface StartupChallenge {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  entry_count: number;
}

// ── Aggregated stats ──────────────────────────────────────────────────────────

export async function fetchStartupStats(founderId: string): Promise<StartupStats> {
  const fallback: StartupStats = {
    active_projects: 0,
    total_submissions: 0,
    unique_builders: 0,
    total_spend: 0,
  };

  try {
    const { data, error } = await supabase.rpc("get_startup_stats" as any, {
      _founder_id: founderId,
    });
    if (error) {
      console.warn("fetchStartupStats rpc error – falling back to client aggregation:", error.message);
      return fetchStartupStatsFallback(founderId);
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return fallback;
    return {
      active_projects: Number(row.active_projects) || 0,
      total_submissions: Number(row.total_submissions) || 0,
      unique_builders: Number(row.unique_builders) || 0,
      total_spend: Number(row.total_spend) || 0,
    };
  } catch {
    return fetchStartupStatsFallback(founderId);
  }
}

/** Client-side fallback if the RPC function hasn't been applied yet */
async function fetchStartupStatsFallback(founderId: string): Promise<StartupStats> {
  const { data: projects, count: pc } = await supabase
    .from("projects")
    .select("id", { count: "exact" })
    .eq("founder_id", founderId)
    .not("status", "in", '("archived","deleted")');

  const projectIds = (projects ?? []).map((p: any) => p.id);
  if (!projectIds.length) {
    return { active_projects: 0, total_submissions: 0, unique_builders: 0, total_spend: 0 };
  }

  const [{ count: sc }, { data: subs }] = await Promise.all([
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .in("project_id", projectIds),
    supabase
      .from("submissions")
      .select("builder_id")
      .in("project_id", projectIds),
  ]);

  const uniqueBuilders = new Set((subs ?? []).map((s: any) => s.builder_id)).size;

  const { data: contracts } = await supabase
    .from("contracts")
    .select("escrow_amount")
    .eq("founder_id", founderId)
    .in("status", ["completed", "fully_settled", "payment_confirmed"]);

  const totalSpend = (contracts ?? []).reduce((acc: number, c: any) => acc + (Number(c.escrow_amount) || 0), 0);

  return {
    active_projects: pc ?? 0,
    total_submissions: sc ?? 0,
    unique_builders: uniqueBuilders,
    total_spend: totalSpend,
  };
}

// ── My Projects ───────────────────────────────────────────────────────────────

export async function fetchStartupProjects(founderId: string): Promise<StartupProject[]> {
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, status, budget, category, created_at")
    .eq("founder_id", founderId)
    .order("created_at", { ascending: false });

  if (error || !projects?.length) return [];

  // Fetch submission counts for all projects in one call
  const { data: counts } = await supabase.rpc("get_project_submission_counts" as any, {
    _ids: projects.map((p: any) => p.id),
  });

  const countMap: Record<string, number> = {};
  (counts ?? []).forEach((c: any) => {
    countMap[c.project_id] = Number(c.count) || 0;
  });

  return projects.map((p: any) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    budget: p.budget ? Number(p.budget) : null,
    category: p.category,
    created_at: p.created_at,
    submission_count: countMap[p.id] ?? 0,
  }));
}

// ── My Rooms (posts authored by this startup) ─────────────────────────────────

export async function fetchStartupRooms(founderId: string): Promise<StartupRoom[]> {
  const { data: posts, error } = await supabase
    .from("room_posts" as any)
    .select("id, room_id, content, created_at, parent_id")
    .eq("author_id", founderId)
    .is("parent_id", null) // only root posts, not replies
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !posts) return [];

  const postIds = (posts as any[]).map((p: any) => p.id);

  // Count replies for each post
  let replyCounts: Record<string, number> = {};
  if (postIds.length) {
    const { data: replies } = await supabase
      .from("room_posts" as any)
      .select("parent_id")
      .in("parent_id", postIds);

    (replies ?? []).forEach((r: any) => {
      replyCounts[r.parent_id] = (replyCounts[r.parent_id] ?? 0) + 1;
    });
  }

  return (posts as any[]).map((p: any) => ({
    id: p.id,
    room_id: p.room_id,
    content: p.content,
    created_at: p.created_at,
    reply_count: replyCounts[p.id] ?? 0,
  }));
}

// ── My Challenges ─────────────────────────────────────────────────────────────

export async function fetchStartupChallenges(founderId: string): Promise<StartupChallenge[]> {
  const { data: challenges, error } = await supabase
    .from("community_challenges" as any)
    .select("id, title, description, start_date, end_date, is_active, created_at")
    .eq("created_by", founderId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !challenges) return [];

  const challengeIds = (challenges as any[]).map((c: any) => c.id);

  // Count submissions per challenge
  let entryCounts: Record<string, number> = {};
  if (challengeIds.length) {
    const { data: entries } = await supabase
      .from("community_submissions" as any)
      .select("challenge_id")
      .in("challenge_id", challengeIds);

    (entries ?? []).forEach((e: any) => {
      entryCounts[e.challenge_id] = (entryCounts[e.challenge_id] ?? 0) + 1;
    });
  }

  return (challenges as any[]).map((c: any) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    start_date: c.start_date,
    end_date: c.end_date,
    is_active: c.is_active,
    created_at: c.created_at,
    entry_count: entryCounts[c.id] ?? 0,
  }));
}

// ── Create helpers ────────────────────────────────────────────────────────────

export async function createStartupChallenge(input: {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
}): Promise<{ error: string | null }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in" };
  const { error } = await supabase.from("community_challenges" as any).insert({
    title: input.title,
    description: input.description,
    start_date: input.start_date,
    end_date: input.end_date,
    is_active: true,
    created_by: auth.user.id,
  } as any);
  return { error: error?.message ?? null };
}
