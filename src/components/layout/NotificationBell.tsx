import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  const displayCount = unreadCount > 9 ? "9+" : unreadCount;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && unreadCount > 0) {
          markAllRead();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" id="notification-bell">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <>
              {/* Pulse ring */}
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-destructive/30 animate-ping" />
              {/* Badge */}
              <span className="absolute top-0.5 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground px-1 shadow-sm">
                {displayCount}
              </span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 max-h-[420px] overflow-y-auto" sideOffset={8}>
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {notifications.length > 0 && (
            <Button
              variant="link"
              size="sm"
              className="text-xs h-auto p-0"
              onClick={() => navigate("/notifications")}
            >
              View all
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            You're all caught up!
          </div>
        ) : (
          notifications.slice(0, 15).map((n) => {
            const Icon = TYPE_ICON[n.notification_type ?? n.type] ?? CheckCircle2;
            const isUnread = !n.is_read && !(n as any).read;
            return (
              <DropdownMenuItem
                key={n.id}
                className={`flex items-start gap-3 p-3 cursor-pointer ${
                  isUnread ? "bg-primary/5" : ""
                }`}
                onClick={() => {
                  if (isUnread) markRead(n.id);
                  if (n.link) navigate(n.link);
                }}
              >
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isUnread ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm leading-tight ${isUnread ? "font-semibold" : "font-medium"}`}>
                      {n.title}
                    </p>
                    {isUnread && (
                      <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                  {n.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
