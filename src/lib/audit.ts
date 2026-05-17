import { supabase } from "@/integrations/supabase/client";

export async function logAudit(
  action: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, any>
) {
  try {
    await supabase.rpc("log_audit", {
      _action: action,
      _entity_type: entityType ?? null,
      _entity_id: entityId ?? null,
      _metadata: (metadata ?? {}) as any,
    });
  } catch (e) {
    console.warn("audit log failed", e);
  }
}
