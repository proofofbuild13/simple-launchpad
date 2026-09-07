import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Github, Star, Wallet, BadgeCheck } from "lucide-react";

export function BuilderIdentityHeader() {
  const { user, role } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      if (role === "startup") {
        const { data } = await supabase
          .from("startup_profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        setProfile(data);
      } else {
        const { data } = await supabase
          .from("builder_profiles")
          .select("full_name, title, avatar_url, github, rating, wallet_address, verified")
          .eq("id", user.id)
          .maybeSingle();
        setProfile(data);
        const { count } = await supabase
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .eq("builder_id", user.id)
          .in("status", ["completed", "accepted", "approved"]);
        setCompleted(count ?? 0);
      }
    })();
  }, [user, role]);

  const isFounder = role === "startup";
  const name = isFounder
    ? profile?.company_name ?? "Your startup"
    : profile?.full_name ?? "Your profile";
  const subtitle = isFounder ? profile?.industry ?? "Founder" : profile?.title ?? "Builder";
  const avatar = isFounder ? profile?.logo_url : profile?.avatar_url;

  return (
    <Card>
      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarImage src={avatar ?? undefined} alt={name} />
          <AvatarFallback>{name?.[0]?.toUpperCase() ?? "P"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold truncate">{name}</h2>
            {!isFounder && completed > 0 && (
              <Badge className="gap-1">
                <BadgeCheck className="h-3 w-3" /> Verified builder
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {!isFounder && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3" /> Score {Number(profile?.rating ?? 0).toFixed(1)}
              </span>
            )}
            {profile?.github && (
              <a
                href={profile.github}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Github className="h-3 w-3" /> GitHub
              </a>
            )}
            {profile?.wallet_address ? (
              <span className="inline-flex items-center gap-1 font-mono">
                <Wallet className="h-3 w-3" />
                {String(profile.wallet_address).slice(0, 6)}…{String(profile.wallet_address).slice(-4)}
              </span>
            ) : (
              !isFounder && (
                <span className="inline-flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> No wallet linked
                </span>
              )
            )}
            {!isFounder && <span>{completed} completed builds</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
