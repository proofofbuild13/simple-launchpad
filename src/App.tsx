import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminGuard } from "@/components/admin/AdminGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";

import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Unauthorized from "./pages/Unauthorized";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import RegisterStartup from "./pages/auth/RegisterStartup";
import RegisterBuilder from "./pages/auth/RegisterBuilder";
import DashboardRouter from "./pages/dashboard/DashboardRouter";
import PostProject from "./pages/projects/PostProject";
import MyProjects from "./pages/projects/MyProjects";
import BrowseProjects from "./pages/projects/BrowseProjects";
import ProjectDetail from "./pages/projects/ProjectDetail";
import PublicProject from "./pages/projects/PublicProject";
import Leaderboard from "./pages/projects/Leaderboard";
import SubmitSolution from "./pages/submissions/SubmitSolution";
import MySubmissions from "./pages/submissions/MySubmissions";
import SubmissionReview from "./pages/submissions/SubmissionReview";
import EditSubmission from "./pages/submissions/EditSubmission";
import Offers from "./pages/contracts/Offers";
import OfferDetail from "./pages/offers/OfferDetail";
import MakeOffer from "./pages/offers/MakeOffer";
import MakeJobOffer from "./pages/offers/MakeJobOffer";
import JobOffers from "./pages/offers/JobOffers";
import JobOfferDetail from "./pages/offers/JobOfferDetail";
import Contracts from "./pages/contracts/Contracts";
import ContractDetail from "./pages/contracts/ContractDetail";
import Interviews from "./pages/interviews/Interviews";
import ScheduleInterview from "./pages/interviews/ScheduleInterview";
import Workspace from "./pages/workspace/Workspace";
import Workspaces from "./pages/workspace/Workspaces";
import Messages from "./pages/messages/Messages";
import Notifications from "./pages/notifications/Notifications";
import Settings from "./pages/settings/Settings";
import AdminDisputes from "./pages/dashboard/AdminDisputes";
import Marketplace from "./pages/marketplace/Marketplace";
import BuilderProfile from "./pages/marketplace/BuilderProfile";
import StartupProfile from "./pages/marketplace/StartupProfile";
import StartupPayments from "./pages/payments/StartupPayments";
import Profile from "./pages/profile/Profile";
import SavedProjects from "./pages/saved/SavedProjects";
import SavedBuilders from "./pages/saved/SavedBuilders";
import EditProject from "./pages/projects/EditProject";
import BuilderPayments from "./pages/payments/BuilderPayments";
import AdminCommissions from "./pages/dashboard/AdminCommissions";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminDisputeDetail from "./pages/admin/AdminDisputeDetail";
import FounderAgent from "./pages/agent/FounderAgent";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/startup" element={<RegisterStartup />} />
            <Route path="/register/builder" element={<RegisterBuilder />} />

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/403" element={<Unauthorized />} />
            <Route path="/p/:id" element={<PublicProject />} />

            <Route element={<AdminGuard><DashboardLayout /></AdminGuard>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/disputes" element={<AdminDisputes />} />
              <Route path="/admin/disputes/:id" element={<AdminDisputeDetail />} />
              <Route path="/admin/commissions" element={<AdminCommissions />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/users/:id" element={<AdminUserDetail />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
            </Route>

            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardRouter />} />
              <Route path="/agent" element={<FounderAgent />} />


              <Route path="/projects" element={<MyProjects />} />
              <Route path="/projects/new" element={<PostProject />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/projects/:id/edit" element={<EditProject />} />
              <Route path="/projects/:id/leaderboard" element={<Leaderboard />} />
              <Route path="/projects/:id/submit" element={<SubmitSolution />} />

              <Route path="/browse" element={<BrowseProjects />} />

              <Route path="/submissions" element={<MySubmissions />} />
              <Route path="/submissions/:id" element={<SubmissionReview />} />
              <Route path="/submissions/:id/edit" element={<EditSubmission />} />

              <Route path="/interviews" element={<Interviews />} />
              <Route path="/interviews/new" element={<ScheduleInterview />} />

              <Route path="/offers" element={<Offers />} />
              <Route path="/offers/new" element={<MakeOffer />} />
              <Route path="/offers/:id" element={<OfferDetail />} />

              <Route path="/job-offers" element={<JobOffers />} />
              <Route path="/job-offers/new" element={<MakeJobOffer />} />
              <Route path="/job-offers/:id" element={<JobOfferDetail />} />

              <Route path="/contracts" element={<Contracts />} />
              <Route path="/contracts/:id" element={<ContractDetail />} />

              <Route path="/workspaces" element={<Workspaces />} />
              <Route path="/workspace/:id" element={<Workspace />} />
              <Route path="/workspaces/:id" element={<Workspace />} />

              <Route path="/messages" element={<Messages />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/saved-projects" element={<SavedProjects />} />
              <Route path="/saved-builders" element={<SavedBuilders />} />

              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/builders/:id" element={<BuilderProfile />} />
              <Route path="/startups/:id" element={<StartupProfile />} />

              <Route path="/payments/startup" element={<StartupPayments />} />
              <Route path="/payments/builder" element={<BuilderPayments />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
