import { supabase } from "@/integrations/supabase/client";

export const PROOF_CATEGORIES = ["All", "DeFi", "DAO", "NFT", "Infra", "L2"] as const;
export type ProofCategory = (typeof PROOF_CATEGORIES)[number];

export const ROOMS = [
  { id: "defi", label: "DeFi" },
  { id: "l2s", label: "L2s" },
  { id: "daos", label: "DAOs" },
  { id: "nft-infra", label: "NFT Infra" },
  { id: "rwa", label: "RWA Tokenization" },
] as const;

export const ROOM_FILTERS = [
  { id: "all", label: "All" },
  ...ROOMS,
] as const;

export type ProofFeedItem = {
  submission_id: string;
  submission_title: string;
  summary: string | null;
  created_at: string;
  builder_id: string;
  builder_name: string;
  builder_avatar: string | null;
  project_id: string;
  project_title: string;
  category: string | null;
};

export async function fetchProofFeed(category: ProofCategory) {
  const { data, error } = await supabase.rpc("get_proof_feed" as any, {
    _category: category === "All" ? null : category,
    _limit: 40,
  });
  if (error) {
    console.error("fetchProofFeed", error);
    return [] as ProofFeedItem[];
  }
  return (data ?? []) as ProofFeedItem[];
}

export async function fetchRoomPosts(roomId: string) {
  let query = supabase.from("room_posts" as any).select("*");
  if (roomId && roomId !== "all") {
    query = query.eq("room_id", roomId);
  }
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) {
    console.error("fetchRoomPosts", error);
    return [] as any[];
  }
  return (data ?? []) as any[];
}

export async function createRoomPost(roomId: string, content: string, parentId?: string | null) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("room_posts" as any)
    .insert({ room_id: roomId, content, parent_id: parentId ?? null, author_id: auth.user.id } as any)
    .select()
    .single();
  if (error) {
    console.error("createRoomPost", error);
    return null;
  }
  return data as any;
}

export async function updateRoomPost(id: string, content: string) {
  const { error } = await supabase
    .from("room_posts" as any)
    .update({ content } as any)
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteRoomPost(id: string) {
  const { error } = await supabase.from("room_posts" as any).delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function updateCommunityChallenge(
  id: string,
  patch: { title?: string; description?: string; start_date?: string; end_date?: string },
) {
  const { error } = await supabase
    .from("community_challenges" as any)
    .update(patch as any)
    .eq("id", id);
  return { error: error?.message ?? null };
}

export async function deleteCommunityChallenge(id: string) {
  const { error } = await supabase.from("community_challenges" as any).delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function createCommunityChallenge(input: {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
}) {
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

export async function fetchActiveCommunityChallenge() {
  const { data, error } = await supabase
    .from("community_challenges" as any)
    .select("*")
    .eq("is_active", true)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("fetchActiveCommunityChallenge", error);
    return null;
  }
  return data as any;
}

export async function fetchCommunitySubmissionCount(challengeId: string) {
  const { count } = await supabase
    .from("community_submissions" as any)
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challengeId);
  return count ?? 0;
}

export async function submitToCommunityChallenge(
  challengeId: string,
  title: string,
  url: string,
) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Not signed in" };
  const { error } = await supabase
    .from("community_submissions" as any)
    .upsert(
      { challenge_id: challengeId, builder_id: auth.user.id, title, url } as any,
      { onConflict: "challenge_id,builder_id" },
    );
  return { error: error?.message ?? null };
}

export async function fetchProfileNames(ids: string[]) {
  if (!ids.length) return {} as Record<string, { name: string; avatar: string | null }>;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", ids);
  const map: Record<string, { name: string; avatar: string | null }> = {};
  (data ?? []).forEach((p: any) => {
    map[p.id] = { name: p.full_name ?? "Member", avatar: p.avatar_url ?? null };
  });
  return map;
}

export type EngagementEntityType = "project" | "room_post" | "proof" | "challenge";
export type EngagementAction = "like" | "save";

export interface UserEngagements {
  likes: Set<string>;
  saves: Set<string>;
}

export async function fetchUserEngagements(userId: string): Promise<UserEngagements> {
  const result: UserEngagements = {
    likes: new Set<string>(),
    saves: new Set<string>(),
  };
  if (!userId) return result;

  try {
    const { data, error } = await supabase
      .from("engagements" as any)
      .select("entity_id, action")
      .eq("user_id", userId);

    if (!error && data) {
      data.forEach((row: any) => {
        if (row.action === "like") result.likes.add(row.entity_id);
        if (row.action === "save") result.saves.add(row.entity_id);
      });
    }
  } catch (err) {
    console.warn("Could not fetch engagements:", err);
  }

  // Also check existing saved_projects table for backward compatibility
  try {
    const { data: savedProjects } = await supabase
      .from("saved_projects")
      .select("project_id")
      .eq("user_id", userId);
    (savedProjects ?? []).forEach((sp: any) => {
      result.saves.add(sp.project_id);
    });
  } catch (err) {
    // ignore
  }

  return result;
}

export async function toggleEngagement(
  userId: string,
  entityType: EngagementEntityType,
  entityId: string,
  action: EngagementAction,
  currentlyActive: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: "Authentication required" };

  try {
    if (currentlyActive) {
      // Remove engagement
      const { error } = await supabase
        .from("engagements" as any)
        .delete()
        .eq("user_id", userId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .eq("action", action);

      if (error) {
        console.warn("Failed deleting engagement:", error);
      }

      // Sync legacy saved_projects if applicable
      if (entityType === "project" && action === "save") {
        await supabase
          .from("saved_projects")
          .delete()
          .eq("user_id", userId)
          .eq("project_id", entityId);
      }

      return { success: true };
    } else {
      // Add engagement
      const { error } = await supabase
        .from("engagements" as any)
        .insert({
          user_id: userId,
          entity_type: entityType,
          entity_id: entityId,
          action: action,
        } as any);

      if (error) {
        console.warn("Failed inserting engagement:", error);
      }

      // Sync legacy saved_projects if applicable
      if (entityType === "project" && action === "save") {
        await supabase
          .from("saved_projects")
          .upsert({ user_id: userId, project_id: entityId }, { onConflict: "user_id,project_id" });
      }

      return { success: true };
    }
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Failed to toggle engagement" };
  }
}

export interface CollectiveComment {
  id: string;
  user_id: string;
  entity_id: string;
  content: string;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
}

export async function fetchComments(
  entityType: EngagementEntityType,
  entityId: string,
): Promise<CollectiveComment[]> {
  const { data, error } = await supabase
    .from("collective_comments" as any)
    .select("id, user_id, entity_id, content, created_at")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    if (error) console.warn("fetchComments", error);
    return [];
  }

  const rows = data as any[];
  const names = await fetchProfileNames([...new Set(rows.map((r) => r.user_id))] as string[]);
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    entity_id: r.entity_id,
    content: r.content,
    created_at: r.created_at,
    author_name: names[r.user_id]?.name ?? "Member",
    author_avatar: names[r.user_id]?.avatar ?? null,
  }));
}

export async function addComment(
  entityType: EngagementEntityType,
  entityId: string,
  content: string,
): Promise<{ error: string | null }> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sign in to comment" };
  const { error } = await supabase.from("collective_comments" as any).insert({
    entity_type: entityType,
    entity_id: entityId,
    user_id: auth.user.id,
    content,
  } as any);
  return { error: error?.message ?? null };
}

export async function deleteComment(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("collective_comments" as any).delete().eq("id", id);
  return { error: error?.message ?? null };
}

export interface EngagementCounts {
  likes: Record<string, number>;
  comments: Record<string, number>;
}

export async function fetchEngagementCounts(entityIds: string[]): Promise<EngagementCounts> {
  const counts: EngagementCounts = { likes: {}, comments: {} };
  if (!entityIds.length) return counts;

  const [likeRes, commentRes] = await Promise.all([
    supabase
      .from("engagements" as any)
      .select("entity_id")
      .eq("action", "like")
      .in("entity_id", entityIds),
    supabase
      .from("collective_comments" as any)
      .select("entity_id")
      .in("entity_id", entityIds),
  ]);

  (likeRes.data ?? []).forEach((r: any) => {
    counts.likes[r.entity_id] = (counts.likes[r.entity_id] ?? 0) + 1;
  });
  (commentRes.data ?? []).forEach((r: any) => {
    counts.comments[r.entity_id] = (counts.comments[r.entity_id] ?? 0) + 1;
  });

  return counts;
}

export async function updateUserPerspective(perspective: "builder" | "founder") {
  try {
    const { error } = await supabase.auth.updateUser({
      data: { collective_perspective: perspective },
    });
    if (error) console.warn("Could not save perspective to user metadata:", error);
    return { error: error?.message ?? null };
  } catch (err: any) {
    return { error: err?.message ?? null };
  }
}

