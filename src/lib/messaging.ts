import { supabase } from "@/integrations/supabase/client";

export async function openDirectConversation(otherUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_or_create_direct_conversation", {
    _other_user: otherUserId,
  });
  if (error) {
    console.error("openDirectConversation", error);
    return null;
  }
  return data as string;
}
