import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "./components/ops/ProtectedRoute";
import OpsLayout from "./components/ops/OpsLayout";

const MyRoutes = lazy(() => import("./pages/MyRoutes"));
const RouteBuilder = lazy(() => import("./pages/RouteBuilder"));
const DataManager = lazy(() => import("./pages/DataManager"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const OpsDashboard = lazy(() => import("./pages/ops/OpsDashboard"));
const OpsJobBoard = lazy(() => import("./pages/ops/OpsJobBoard"));
const OpsCampaignDetail = lazy(() => import("./pages/ops/OpsCampaignDetail"));
const OpsScheduling = lazy(() => import("./pages/ops/OpsScheduling"));
const OpsTimeMileage = lazy(() => import("./pages/ops/OpsTimeMileage"));
const OpsSettings = lazy(() => import("./pages/ops/OpsSettings"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={
            <div className="flex items-center justify-center h-screen">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          }>
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
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
