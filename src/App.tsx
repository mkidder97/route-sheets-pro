import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import MyRoutes from "./pages/MyRoutes";
import RouteBuilder from "./pages/RouteBuilder";
import DataManager from "./pages/DataManager";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "@/hooks/useAuth";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ops/ProtectedRoute";
import OpsLayout from "./components/ops/OpsLayout";
import OpsDashboard from "./pages/ops/OpsDashboard";
import OpsJobBoard from "./pages/ops/OpsJobBoard";
import OpsCampaignDetail from "./pages/ops/OpsCampaignDetail";
import OpsScheduling from "./pages/ops/OpsScheduling";
import OpsTimeMileage from "./pages/ops/OpsTimeMileage";
import OpsSettings from "./pages/ops/OpsSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Shared login */}
            <Route path="/login" element={<Login />} />

            {/* Legacy redirect */}
            <Route path="/ops/login" element={<Navigate to="/login" replace />} />

            {/* RoofRoute routes — protected */}
            <Route element={<ProtectedRoute><AppLayout><Outlet /></AppLayout></ProtectedRoute>}>
              <Route path="/" element={<MyRoutes />} />
              <Route path="/my-routes" element={<MyRoutes />} />
              <Route path="/route-builder" element={<RouteBuilder />} />
              <Route path="/buildings" element={<DataManager />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* RoofOps routes — already protected */}
            <Route path="/ops" element={<ProtectedRoute><OpsLayout /></ProtectedRoute>}>
              <Route index element={<OpsDashboard />} />
              <Route path="jobs" element={<OpsJobBoard />} />
              <Route path="jobs/campaign/:id" element={<OpsCampaignDetail />} />
              <Route path="scheduling" element={<OpsScheduling />} />
              <Route path="time-mileage" element={<OpsTimeMileage />} />
              <Route path="settings" element={
                <ProtectedRoute allowedRoles={["admin", "office_manager"]}>
                  <OpsSettings />
                </ProtectedRoute>
              } />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
