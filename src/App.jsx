import { lazy, Suspense, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { IS_DEMO } from './utils/env.js';
import { isFirebaseConfigured } from './firebase.js';
import { listenToAuth } from './features/auth/authThunks.js';
import { selectAuthStatus } from './features/auth/authSlice.js';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SetupRequired from './pages/SetupRequired.jsx';

// Route-level code splitting
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage.jsx'));
const SearchPage = lazy(() => import('./pages/SearchPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage.jsx'));
const SplitBillsPage = lazy(() => import('./pages/SplitBillsPage.jsx'));
const SplitBillDetailPage = lazy(() => import('./pages/SplitBillDetailPage.jsx'));
const ChatPage = lazy(() => import('./pages/ChatPage.jsx'));
const FeedPage = lazy(() => import('./pages/FeedPage.jsx'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'));
const ReviewPage = lazy(() => import('./pages/ReviewPage.jsx'));

// The demo runs inside an embedded preview where URL paths can't change.
const Router = IS_DEMO ? MemoryRouter : BrowserRouter;

export default function App() {
  const dispatch = useDispatch();
  const status = useSelector(selectAuthStatus);

  useEffect(() => dispatch(listenToAuth()), [dispatch]);

  if (!isFirebaseConfigured) return <SetupRequired />;
  if (status === 'loading') return <Spinner label="Menyiapkan aplikasi..." />;

  return (
    <Router>
      {status === 'unauthenticated' ? (
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      ) : (
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<DashboardPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/:id" element={<ReportDetailPage />} />
              <Route path="split" element={<SplitBillsPage />} />
              <Route path="split/:id" element={<SplitBillDetailPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="chat/:chatId" element={<ChatPage />} />
              <Route path="feed" element={<FeedPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="review" element={<ReviewPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      )}
    </Router>
  );
}
