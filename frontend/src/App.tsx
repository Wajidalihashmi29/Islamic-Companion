import { Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import Home from "./pages/Home";
import SettingsPage from "./pages/SettingsPage";
import SessionWatcher from "./components/SessionWatcher";
import QuranReaderPage from "./pages/QuranReaderPage";
import QuranPdfPage from "./pages/QuranPdfPage";
import FeaturePage from "./pages/FeaturePage";
import AppStatusBar from "./components/AppStatusBar";
import ArabicFontSync from "./components/ArabicFontSync";

function App() {
  return (
    <>
      <SessionWatcher />
      <ArabicFontSync />
      <AppStatusBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/quran" element={<QuranReaderPage />} />
        <Route path="/quran-pdf" element={<QuranPdfPage />} />
        <Route path="/prayer" element={<FeaturePage featureId="prayer" />} />
        <Route path="/qibla" element={<FeaturePage featureId="qibla" />} />
        <Route path="/hadith" element={<FeaturePage featureId="hadith" />} />
        <Route path="/zakat" element={<FeaturePage featureId="zakat" />} />
        <Route path="/azkar" element={<FeaturePage featureId="azkar" />} />
        <Route path="/calendar" element={<FeaturePage featureId="calendar" />} />
        <Route path="/tasbeeh" element={<FeaturePage featureId="tasbeeh" />} />
        <Route path="/favorites" element={<FeaturePage featureId="favorites" />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;