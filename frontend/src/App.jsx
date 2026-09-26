import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { bootstrapAuth } from './store/authSlice';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { Loading } from './components/common';
import Home from './pages/Home';
import JobsPage from './pages/JobsPage';
import JobDetails from './pages/JobDetails';
import Pricing from './pages/Pricing';
import { Login, Register } from './pages/Auth';
import { StatesPage, CategoriesPage, UpdatesPage } from './pages/Browse';
import Legal from './pages/Legal';
import NotFound from './pages/NotFound';
import ForgotPassword from './pages/ForgotPassword';

// Admin + dashboard bundles are only downloaded when needed.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ToolsLayout = lazy(() => import('./pages/tools/ToolsLayout'));
const ToolsHome = lazy(() => import('./pages/tools/ToolsHome'));
const ToolPage = lazy(() => import('./pages/tools/ToolPage'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminJobs = lazy(() => import('./pages/admin/AdminJobs'));
const AdminJobForm = lazy(() => import('./pages/admin/AdminJobForm'));
const AdminApplications = lazy(() => import('./pages/admin/AdminApplications'));
const AdminUpdates = lazy(() => import('./pages/admin/AdminUpdates'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'));
const Checkout = lazy(() => import('./pages/Checkout'));

export default function App() {
  const dispatch = useDispatch();
  useEffect(() => { dispatch(bootstrapAuth()); }, [dispatch]);

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="government-jobs" element={<JobsPage sector="government" />} />
          <Route path="private-jobs" element={<JobsPage sector="private" />} />
          <Route path="jobs/:slug" element={<JobDetails />} />
          <Route path="states" element={<StatesPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="updates/admit-card" element={<UpdatesPage type="admit_card" />} />
          <Route path="updates/results" element={<UpdatesPage type="result" />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="legal/:page" element={<Legal />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="tools" element={<ToolsLayout />}>
            <Route index element={<ToolsHome />} />
            <Route path=":id" element={<ToolPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="checkout/:plan" element={<Checkout />} />
          </Route>

          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="jobs" element={<AdminJobs />} />
              <Route path="jobs/new" element={<AdminJobForm />} />
              <Route path="jobs/:id/edit" element={<AdminJobForm />} />
              <Route path="applications" element={<AdminApplications />} />
              <Route path="updates" element={<AdminUpdates />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="users" element={<AdminUsers />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
