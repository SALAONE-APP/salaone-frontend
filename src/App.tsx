import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { LandingPage } from "./pages/LandingPage";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { TermsOfServicePage } from "./pages/TermsOfServicePage";
import { AccessSuspendedPage } from "./pages/AccessSuspendedPage";
import { TrialExpiredPage } from "./pages/TrialExpiredPage";
import { AppRoutes } from "./routes/AppRoutes";
import { PublicRoute } from "./routes/PublicRoute";
import { Toaster } from "./components/ui/sonner";
import { RelationshipTourProvider } from "./context/TourContext";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RelationshipTourProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/access-suspended" element={<AccessSuspendedPage />} />
            <Route path="/trial-expired" element={<TrialExpiredPage />} />
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              }
            />
            <Route
              path="/reset-password"
              element={
                <PublicRoute>
                  <ResetPassword />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={<Register />}
            />
            <Route
              path="/register/:slug"
              element={<Register />}
            />
            <Route path="/*" element={<AppRoutes />} />
          </Routes>
          <Toaster richColors position="top-right" />
        </RelationshipTourProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
