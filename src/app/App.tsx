import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { RequireRole } from './RequireRole';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { MapPage } from '@/pages/MapPage';
import { IncidentsPage } from '@/pages/IncidentsPage';
import { IncidentDetailPage } from '@/pages/IncidentDetailPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { VerificationPage } from '@/pages/VerificationPage';
import { ObjectsPage } from '@/pages/ObjectsPage';
import { ObjectDetailPage } from '@/pages/ObjectDetailPage';
import { SourcesPage } from '@/pages/SourcesPage';
import { DictionariesPage } from '@/pages/DictionariesPage';
import { AuditPage } from '@/pages/AuditPage';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireRole>
            <Layout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="incidents" element={<IncidentsPage />} />
        <Route path="incidents/:id" element={<IncidentDetailPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route
          path="verification"
          element={
            <RequireRole role="expert">
              <VerificationPage />
            </RequireRole>
          }
        />
        <Route path="objects" element={<ObjectsPage />} />
        <Route path="objects/:id" element={<ObjectDetailPage />} />
        <Route path="subscriptions" element={<SubscriptionsPage />} />
        <Route
          path="sources"
          element={
            <RequireRole role="admin">
              <SourcesPage />
            </RequireRole>
          }
        />
        <Route
          path="dictionaries"
          element={
            <RequireRole role="admin">
              <DictionariesPage />
            </RequireRole>
          }
        />
        <Route
          path="audit"
          element={
            <RequireRole role="admin">
              <AuditPage />
            </RequireRole>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
