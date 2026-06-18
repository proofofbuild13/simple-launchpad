import { supabase } from "@/integrations/supabase/client";

export async function runAIEvaluation(submissionId: string) {
  const { data, error } = await supabase.functions.invoke("evaluate-submission", {
    body: { submission_id: submissionId },
  });
  if (error) throw error;
  return data;
}
