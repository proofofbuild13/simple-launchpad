import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, GraduationCap } from "lucide-react";

export function PublicExperience({ userId }: { userId: string }) {
  const [exps, setExps] = useState<any[]>([]);
  const [edus, setEdus] = useState<any[]>([]);
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [{ data: e }, { data: ed }] = await Promise.all([
        supabase.from("experiences").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
        supabase.from("educations").select("*").eq("user_id", userId).order("start_year", { ascending: false }),
      ]);
      setExps(e ?? []);
      setEdus(ed ?? []);
    })();
  }, [userId]);

  return (
    <>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4" />Experience</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {exps.length === 0 && <p className="text-sm text-muted-foreground">No experience listed.</p>}
          {exps.map((x) => (
            <div key={x.id} className="border-l-2 border-primary/40 pl-3">
              <div className="text-sm font-medium">{x.role} · {x.company_name}</div>
              <div className="text-xs text-muted-foreground">{x.employment_type} · {x.start_date ?? ""} → {x.is_current ? "Present" : (x.end_date ?? "")}</div>
              {x.description && <p className="text-xs text-foreground/80 whitespace-pre-wrap mt-1">{x.description}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4" />Education</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {edus.length === 0 && <p className="text-sm text-muted-foreground">No education listed.</p>}
          {edus.map((e) => (
            <div key={e.id} className="border-l-2 border-primary/40 pl-3">
              <div className="text-sm font-medium">{e.degree ?? "Degree"} · {e.institution}</div>
              <div className="text-xs text-muted-foreground">{e.specialization} · {e.start_year ?? ""} → {e.end_year ?? "Present"} {e.grade && `· ${e.grade}`}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
