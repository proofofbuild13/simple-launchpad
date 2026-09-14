import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, Compass, Bot, FolderKanban, Handshake, Users2, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "./NotificationBell";

const startupItems = [
  { title: "Agent", url: "/agent", icon: Bot },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Deals", url: "/deals", icon: Handshake },
  { title: "Collective", url: "/collective", icon: Users2 },
];

const builderItems = [
  { title: "Collective", url: "/collective", icon: Users2 },
  { title: "Deals", url: "/deals", icon: Handshake },
];

export default function DashboardLayout() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const initial = user?.email?.[0]?.toUpperCase() ?? "U";
  const navItems = role === "startup" ? startupItems : role === "builder" ? builderItems : [];

  return (
    <div className="min-h-screen flex flex-col w-full bg-background overflow-x-hidden">
      <header className="h-14 border-b flex items-center justify-between px-3 sm:px-4 bg-card/50 backdrop-blur shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <NavLink to={role === "startup" ? "/agent" : "/dashboard"} className="flex items-center gap-2">
            <img src="/logo.png" alt="proof_of_Build" className="h-7 w-7 object-contain" />
            <div className="flex flex-col hidden sm:flex">
              <span className="text-sm font-semibold leading-none">proof_of_Build</span>
              <span className="text-[10px] text-muted-foreground">Build before you hire</span>
            </div>
          </NavLink>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5">
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.url}
                to={item.url}
                title={item.title}
                className={({ isActive }) =>
                  `flex items-center justify-center h-8 w-8 rounded-md transition-colors ${
                    isActive || (item.url === "/agent" && window.location.pathname.startsWith("/agent"))
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
              </NavLink>
            ))}
          </nav>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/marketplace")}
            title="Marketplace"
            className="h-8 w-8"
          >
            <Compass className="h-4 w-4" />
          </Button>
          <NotificationBell />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs bg-primary/10">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">
                {user?.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="flex-1 overflow-auto min-w-0">
        <div className="w-full max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
