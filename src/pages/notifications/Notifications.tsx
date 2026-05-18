import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Mail,
  Send,
  Bookmark,
  FileSignature,
  Wallet,
  Shield,
  UserPlus,
  MessageSquare,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TYPE_ICON: Record<string, any> = {
  project_invitation: Send,
  message_received: MessageSquare,
  shortlisted: Bookmark,
  offer_received: Mail,
  contract_activated: FileSignature,
  payment_declared: Wallet,
  payment_confirmed: Wallet,
  payment_method_missing: Wallet,
  admin_verification: Shield,
  saved_profile: UserPlus,
};

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, markAllRead, markRead } = useNotifications();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">You're all caught up.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = TYPE_ICON[n.notification_type ?? n.type] ?? CheckCircle2;
            const isUnread = !n.is_read && !(n as any).read;
            return (
              <Card
                key={n.id}
                className={`cursor-pointer transition-all hover:border-primary/40 ${
                  isUnread ? "border-primary/20 bg-primary/[0.02]" : ""
                }`}
                onClick={() => {
                  if (isUnread) markRead(n.id);
                  if (n.link) navigate(n.link);
                }}
              >
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isUnread
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p
                            className={`text-sm leading-tight truncate ${
                              isUnread ? "font-semibold" : "font-medium"
                            }`}
                          >
                            {n.title}
                          </p>
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">
                          {(n.notification_type ?? n.type).replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
