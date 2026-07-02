import { NavLink, useLocation } from "react-router-dom";
import {
  Bot,
  FolderKanban,
  Handshake,
  Search,
  MessageSquare,
  Shield,
  AlertTriangle,
  Wallet,
  Users as UsersIcon,
  ScrollText,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

type Item = { title: string; url: string; icon: any };

const startupItems: Item[] = [
  { title: "Agent", url: "/agent", icon: Bot },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Deals", url: "/deals", icon: Handshake },
  { title: "Builders", url: "/marketplace", icon: UsersIcon },
  { title: "Inbox", url: "/messages", icon: MessageSquare },
];

const builderItems: Item[] = [
  { title: "Browse", url: "/browse", icon: Search },
  { title: "Deals", url: "/deals", icon: Handshake },
  { title: "Profile", url: "/profile", icon: User },
  { title: "Inbox", url: "/messages", icon: MessageSquare },
];

const adminItems: Item[] = [
  { title: "Dashboard", url: "/admin", icon: Shield },
  { title: "Disputes", url: "/admin/disputes", icon: AlertTriangle },
  { title: "Platform fees", url: "/admin/commissions", icon: Wallet },
  { title: "Users", url: "/admin/users", icon: UsersIcon },
  { title: "Audit logs", url: "/admin/audit-logs", icon: ScrollText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { role } = useAuth();

  const main =
    role === "startup" ? startupItems : role === "builder" ? builderItems : [];
  const isAdmin = role === "admin" || (role as string) === "super_admin";

  const renderItem = (item: Item) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton asChild isActive={pathname === item.url}>
        <NavLink to={item.url} className="flex items-center gap-2">
          <item.icon className="h-4 w-4" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <NavLink to={role === "startup" ? "/agent" : "/dashboard"} className="flex items-center gap-2">
          <img src="/logo.png" alt="proof_of_Build" className="h-7 w-7 object-contain" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold">proof_of_Build</span>
              <span className="text-[10px] text-muted-foreground">
                Build before you hire
              </span>
            </div>
          )}
        </NavLink>
      </SidebarHeader>
      <SidebarContent>
        {main.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {role === "startup" ? "Founder" : "Builder"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{main.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{adminItems.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
