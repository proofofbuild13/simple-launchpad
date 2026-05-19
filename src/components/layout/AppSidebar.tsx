import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  PlusCircle,
  FileCheck2,
  HandCoins,
  FileSignature,
  Search,
  Send,
  Bell,
  MessageSquare,
  Settings,
  Shield,
  User,
  Calendar,
  AlertTriangle,
  Compass,
  Briefcase,
  Wallet,
  Users as UsersIcon,
  ScrollText,
  Bookmark,
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
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Post Project", url: "/projects/new", icon: PlusCircle },
  { title: "My Projects", url: "/projects", icon: FolderKanban },
  { title: "Submissions", url: "/submissions", icon: FileCheck2 },
  { title: "Interviews", url: "/interviews", icon: Calendar },
  { title: "Offers", url: "/offers", icon: HandCoins },
  { title: "Job Offers", url: "/job-offers", icon: Briefcase },
  { title: "Contracts", url: "/contracts", icon: FileSignature },
  { title: "Workspaces", url: "/workspaces", icon: Briefcase },
  { title: "Saved Builders", url: "/saved-builders", icon: Bookmark },
  { title: "Payments", url: "/payments/startup", icon: Wallet },
];

const builderItems: Item[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Browse Projects", url: "/browse", icon: Search },
  { title: "Saved Projects", url: "/saved-projects", icon: Bookmark },
  { title: "My Submissions", url: "/submissions", icon: Send },
  { title: "Interviews", url: "/interviews", icon: Calendar },
  { title: "Offers", url: "/offers", icon: HandCoins },
  { title: "Job Offers", url: "/job-offers", icon: Briefcase },
  { title: "Contracts", url: "/contracts", icon: FileSignature },
  { title: "Workspaces", url: "/workspaces", icon: Briefcase },
  { title: "Earnings", url: "/payments/builder", icon: Wallet },
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
        <NavLink to="/dashboard" className="flex items-center gap-2">
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
