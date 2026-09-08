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
  const { data, error } = await supabase
    .from("room_posts" as any)
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
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
