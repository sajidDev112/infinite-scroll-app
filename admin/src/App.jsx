import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router';
import AppLayout, { ProtectedRoute } from './components/layout/AppLayout.jsx';
import { Spinner } from './components/ui/Misc.jsx';
import ErrorBoundary from './components/layout/ErrorBoundary.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import StoriesPage from './pages/StoriesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { useAuth } from './context/AuthContext.jsx';

// Heavy, editor-only code (Konva, GSAP, Lenis) is split out of the main bundle.
const StoryBuilderPage = lazy(() => import('./features/builder/StoryBuilderPage.jsx'));
const StoryPreviewPage = lazy(() => import('./pages/StoryPreviewPage.jsx'));

function NotFound() {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <p className="section-title">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Page not found</h1>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-accent-300 hover:text-accent-400">Back to dashboard</Link>
      </div>
    </div>
  );
}

export default function App() {
  const { status } = useAuth();
  const loader = <Spinner className="h-full" label="Loading…" />;
  return (
    <ErrorBoundary>
    <Suspense fallback={loader}>
      <Routes>
        <Route path="/login" element={status === 'signed-in' ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="stories" element={<StoriesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="/stories/new" element={<ProtectedRoute><StoryBuilderPage /></ProtectedRoute>} />
        <Route path="/stories/:id/edit" element={<ProtectedRoute><StoryBuilderPage /></ProtectedRoute>} />
        <Route path="/stories/:id/preview" element={<ProtectedRoute><StoryPreviewPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
}
