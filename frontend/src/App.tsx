import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/routing/ProtectedRoute";
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
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/studies" element={<ProtectedRoute><StudiesPage /></ProtectedRoute>} />
          <Route path="/studies/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
          <Route path="/studies/:id" element={<ProtectedRoute><StudyDetailPage /></ProtectedRoute>} />
          <Route path="/predictions/:id/explain" element={<ProtectedRoute><ExplainabilityPage /></ProtectedRoute>} />
          <Route path="/benchmark" element={<ProtectedRoute><BenchmarkPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}