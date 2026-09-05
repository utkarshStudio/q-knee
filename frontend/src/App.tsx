import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProtectedRoute } from "./components/routing/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import StudiesPage from "./pages/StudiesPage";
import UploadPage from "./pages/UploadPage";
import StudyDetailPage from "./pages/StudyDetailPage";
import ExplainabilityPage from "./pages/ExplainabilityPage";
import BenchmarkPage from "./pages/BenchmarkPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/studies/upload" element={<UploadPage />} />
          <Route path="/studies" element={<StudiesPage />} />
          <Route path="/studies/:id" element={<StudyDetailPage />} />
          <Route path="/viewer" element={<StudyDetailPage />} />
          <Route path="/viewer/:id" element={<StudyDetailPage />} />
          <Route path="/explainability" element={<ExplainabilityPage />} />
          <Route path="/predictions/:id/explain" element={<ExplainabilityPage />} />
          <Route path="/benchmark" element={<BenchmarkPage />} />
          <Route path="/technology" element={<LandingPage defaultSection="technology" />} />
          <Route path="/research" element={<LandingPage defaultSection="research" />} />
          <Route path="/about" element={<LandingPage defaultSection="about" />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}