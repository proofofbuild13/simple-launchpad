import { supabase } from "@/integrations/supabase/client";
import { getFounderAgentError } from "@/lib/founderAgentClient";

export async function runAIEvaluation(submissionId: string) {
  const { data, error } = await supabase.functions.invoke("evaluate-submission", {
    body: { submission_id: submissionId },
  });
  if (error || data?.error || data?.ok === false) throw await getFounderAgentError(error, data);
  return data;
}
