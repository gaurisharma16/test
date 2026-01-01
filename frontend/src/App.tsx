import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import FinancialData from "./pages/FinancialData";
import Editorial from "./pages/Editorial";
import BrokerReports from "./pages/BrokerReports";
import MarketSummary from "./pages/MarketSummary";
import FilingsAlerts from "./pages/FilingsAlerts";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            
            {/* Protected routes */}
            <Route element={<Layout />}>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/financial-data"
                element={
                  <ProtectedRoute>
                    <FinancialData />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/editorial"
                element={
                  <ProtectedRoute>
                    <Editorial />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/broker-reports"
                element={
                  <ProtectedRoute>
                    <BrokerReports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/market-summary"
                element={
                  <ProtectedRoute>
                    <MarketSummary />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/filings-alerts"
                element={
                  <ProtectedRoute>
                    <FilingsAlerts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
            </Route>
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
