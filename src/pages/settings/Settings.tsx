import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Briefcase } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { user, role } = useAuth();
  const [openFt, setOpenFt] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user || role !== "builder") { setLoaded(true); return; }
    (supabase as any).from("builder_profiles")
      .select("open_to_full_time").eq("id", user.id).maybeSingle()
      .then(({ data }: any) => {
        setOpenFt(!!data?.open_to_full_time);
        setLoaded(true);
      });
  }, [user, role]);

  const toggle = async (v: boolean) => {
    if (!user) return;
    setOpenFt(v);
    const { error } = await (supabase as any).from("builder_profiles")
      .update({ open_to_full_time: v }).eq("id", user.id);
    if (error) { toast.error(error.message); setOpenFt(!v); return; }
    toast.success(v ? "You're now visible for full-time roles" : "Full-time visibility off");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{user?.email}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="capitalize">{role}</span></div>
        </CardContent>
      </Card>

      {role === "builder" && loaded && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4 text-emerald-600" /> Hiring preferences</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <div className="font-medium text-sm">Open to Full-Time Roles</div>
                <div className="text-xs text-muted-foreground">Show an "Open to Full-Time" badge on your profile and get prioritized notifications for new full-time roles.</div>
              </div>
              <Switch checked={openFt} onCheckedChange={toggle} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
