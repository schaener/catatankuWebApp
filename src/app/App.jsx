import { Suspense, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { IS_DEMO } from '../platform/env.js';
import { isFirebaseConfigured } from '../platform/firebase.js';
import { listenToAuth } from '../platform/auth/authThunks.js';
import { selectAuthStatus } from '../platform/auth/authSlice.js';
import { Spinner } from '../platform/ui/ui.jsx';
import Layout from './Layout.jsx';
import LoginPage from './LoginPage.jsx';
import MorePage from './MorePage.jsx';
import SetupRequired from './SetupRequired.jsx';
import { PROVIDERS, ROUTES } from './modules.js';

// The demo runs inside an embedded preview where URL paths can't change.
const Router = IS_DEMO ? MemoryRouter : BrowserRouter;

const routeElement = (r) => {
  const Page = r.element;
  return <Page />;
};

export default function App() {
  const dispatch = useDispatch();
  const status = useSelector(selectAuthStatus);

  useEffect(() => dispatch(listenToAuth()), [dispatch]);

  if (!isFirebaseConfigured) return <SetupRequired />;
  if (status === 'loading') return <Spinner label="Menyiapkan aplikasi..." />;

  if (status === 'unauthenticated') {
    return (
      <Router>
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </Router>
    );
  }

  const routes = (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          {ROUTES.map((r) => (r.index ? <Route key="index" index element={routeElement(r)} /> : <Route key={r.path} path={r.path} element={routeElement(r)} />))}
          <Route path="more" element={<MorePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
  // Module providers (entry composer, share targets, alerts...) wrap the routes, innermost last.
  return <Router>{PROVIDERS.reduceRight((child, Provider) => <Provider>{child}</Provider>, routes)}</Router>;
}
