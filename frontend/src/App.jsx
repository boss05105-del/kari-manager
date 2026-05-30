import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import ProfileSetup from './pages/ProfileSetup';
import AdminDashboard from './pages/AdminDashboard';
import StoreCard from './pages/StoreCard';
import Analytics from './pages/Analytics';
import OverdueReport from './pages/OverdueReport';
import DirectorDashboard from './pages/DirectorDashboard';
import PlanForm from './pages/PlanForm';
import FactForm from './pages/FactForm';
import DirectorHistory from './pages/DirectorHistory';
import DirectorReport from './pages/DirectorReport';

function useAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  if (!token || !user) return { auth: false, role: null };
  try {
    return { auth: true, role: JSON.parse(user).role };
  } catch {
    return { auth: false, role: null };
  }
}

function ProtectedRoute({ children, requiredRole }) {
  const { auth, role } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === 'admin' ? '/admin' : '/director'} replace />;
  }
  return <Layout>{children}</Layout>;
}

function RootRedirect() {
  const { auth, role } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (role === 'director' && !user.profile_completed) {
      return <Navigate to="/setup" replace />;
    }
  } catch {}
  return <Navigate to={role === 'admin' ? '/admin' : '/director'} replace />;
}

function DirectorGuard({ children }) {
  const { auth, role } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  if (role !== 'director') return <Navigate to="/admin" replace />;
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user.profile_completed) return <Navigate to="/setup" replace />;
  } catch {}
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<ProfileSetup />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>
      } />
      <Route path="/admin/store/:id" element={
        <ProtectedRoute requiredRole="admin"><StoreCard /></ProtectedRoute>
      } />
      <Route path="/admin/analytics" element={
        <ProtectedRoute requiredRole="admin"><Analytics /></ProtectedRoute>
      } />
      <Route path="/admin/ratings" element={
        <ProtectedRoute requiredRole="admin"><Analytics /></ProtectedRoute>
      } />
      <Route path="/admin/overdue" element={
        <ProtectedRoute requiredRole="admin"><OverdueReport /></ProtectedRoute>
      } />
      <Route path="/admin/report" element={
        <ProtectedRoute requiredRole="admin"><DirectorReport /></ProtectedRoute>
      } />

      {/* Director routes */}
      <Route path="/director" element={<DirectorGuard><DirectorDashboard /></DirectorGuard>} />
      <Route path="/director/plan" element={<DirectorGuard><PlanForm /></DirectorGuard>} />
      <Route path="/director/fact" element={<DirectorGuard><FactForm /></DirectorGuard>} />
      <Route path="/director/history" element={<DirectorGuard><DirectorHistory /></DirectorGuard>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
