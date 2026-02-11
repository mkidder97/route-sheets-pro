import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import UploadPage from "./pages/Upload";

import RouteBuilder from "./pages/RouteBuilder";
import Buildings from "./pages/Buildings";
import Inspectors from "./pages/Inspectors";
import Codes from "./pages/Codes";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<UploadPage />} />
            
            <Route path="/route-builder" element={<RouteBuilder />} />
            <Route path="/buildings" element={<Buildings />} />
            <Route path="/inspectors" element={<Inspectors />} />
            <Route path="/codes" element={<Codes />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
