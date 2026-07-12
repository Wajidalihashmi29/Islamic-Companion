import { Routes, Route } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import ProtectedRoute from "./components/ProtectedRoute";
import SessionWatcher from "./components/SessionWatcher";

function App() {
  return (
    <>
      <SessionWatcher />
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      </Routes>
    </>
  );
}

export default App;