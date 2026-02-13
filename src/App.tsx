import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import MyRoutes from "./pages/MyRoutes";
import RouteBuilder from "./pages/RouteBuilder";
import DataManager from "./pages/DataManager";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "@/hooks/useAuth";
import OpsLogin from "./pages/ops/OpsLogin";
import ProtectedRoute from "./components/ops/ProtectedRoute";
import OpsLayout from "./components/ops/OpsLayout";
import OpsDashboard from "./pages/ops/OpsDashboard";
import OpsJobBoard from "./pages/ops/OpsJobBoard";
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
          <AppLayout>
            <Routes>
              <Route path="/" element={<MyRoutes />} />
              <Route path="/my-routes" element={<MyRoutes />} />
              <Route path="/route-builder" element={<RouteBuilder />} />
              <Route path="/buildings" element={<DataManager />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/ops/login" element={<OpsLogin />} />
              <Route path="/ops" element={<ProtectedRoute><OpsLayout /></ProtectedRoute>}>
                <Route index element={<OpsDashboard />} />
                <Route path="jobs" element={<OpsJobBoard />} />
                <Route path="scheduling" element={<OpsScheduling />} />
                <Route path="time-mileage" element={<OpsTimeMileage />} />
                <Route path="settings" element={<OpsSettings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
