import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setItems(data ?? []));
  }, [user]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">You're all caught up.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card key={n.id}>
              <CardContent className="py-3">
                <div className="font-medium text-sm">{n.title}</div>
                <div className="text-xs text-muted-foreground">{n.body}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
