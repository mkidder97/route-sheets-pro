import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "./components/ops/ProtectedRoute";

const UnifiedLayout = lazy(() => import("./components/UnifiedLayout"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Buildings = lazy(() => import("./pages/Buildings"));
const BuildingDetail = lazy(() => import("./pages/BuildingDetail"));
const DataManager = lazy(() => import("./pages/DataManager"));
const RouteBuilder = lazy(() => import("./pages/RouteBuilder"));
const Settings = lazy(() => import("./pages/Settings"));
const Clients = lazy(() => import("./pages/Clients"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Contractors = lazy(() => import("./pages/Contractors"));
const Warranties = lazy(() => import("./pages/Warranties"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Analytics = lazy(() => import("./pages/Analytics"));

const InspectionCampaigns = lazy(() => import("./pages/inspections/Campaigns"));
const InspectionSchedule = lazy(() => import("./pages/inspections/Schedule"));
const InspectionHistory = lazy(() => import("./pages/inspections/History"));

const OpsJobBoard = lazy(() => import("./pages/ops/OpsJobBoard"));
const OpsCampaignDetail = lazy(() => import("./pages/ops/OpsCampaignDetail"));
const OpsWorkOrders = lazy(() => import("./pages/ops/OpsWorkOrders"));
const OpsTimeMileage = lazy(() => import("./pages/ops/OpsTimeMileage"));
const OpsScheduling = lazy(() => import("./pages/ops/OpsScheduling"));
const OpsSettings = lazy(() => import("./pages/ops/OpsSettings"));

const MyRoutes = lazy(() => import("./pages/MyRoutes"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminRegions = lazy(() => import("./pages/admin/Regions"));

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
            <Route path="/login" element={<Login />} />
            <Route path="/ops/login" element={<Navigate to="/login" replace />} />

            <Route element={<ProtectedRoute><UnifiedLayout /></ProtectedRoute>}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/my-routes" element={<MyRoutes />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analytics" element={<Analytics />} />

              <Route path="/buildings" element={<Buildings />} />
              <Route path="/buildings/:id" element={<BuildingDetail />} />
              <Route path="/admin/data" element={<DataManager />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/contractors" element={<Contractors />} />
              <Route path="/warranties" element={<Warranties />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/portfolio" element={<Portfolio />} />

              <Route path="/inspections/campaigns" element={<InspectionCampaigns />} />
              <Route path="/route-builder" element={<RouteBuilder />} />
              <Route path="/inspections/schedule" element={<InspectionSchedule />} />
              <Route path="/inspections/history" element={<InspectionHistory />} />

              <Route path="/ops" element={<Navigate to="/ops/jobs" replace />} />
              <Route path="/ops/jobs" element={<OpsJobBoard />} />
              <Route path="/ops/jobs/campaign/:id" element={<OpsCampaignDetail />} />
              <Route path="/inspections/campaigns/:id" element={<OpsCampaignDetail />} />
              <Route path="/ops/work-orders" element={<OpsWorkOrders />} />
              <Route path="/ops/time-mileage" element={<OpsTimeMileage />} />
              <Route path="/ops/scheduling" element={<OpsScheduling />} />

              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/regions" element={<AdminRegions />} />
              <Route path="/settings" element={
                <ProtectedRoute allowedRoles={["admin", "office_manager"]}>
                  <Settings />
                </ProtectedRoute>
              } />
              <Route path="/ops/settings" element={
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
