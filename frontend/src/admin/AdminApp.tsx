import React, { useState, useEffect, useCallback } from 'react';
import { AdminRoute, AdminAuthState } from './types.ts';
import { adminCheckSession, adminLogout } from './api.ts';
import { AdminLoginPage } from './pages/AdminLoginPage.tsx';
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx';
import { AdminMembersPage } from './pages/AdminMembersPage.tsx';
import { AdminProjectsPage } from './pages/AdminProjectsPage.tsx';
import { AdminEventsPage } from './pages/AdminEventsPage.tsx';
import { AdminAuditPage } from './pages/AdminAuditPage.tsx';
import { AdminSettingsPage } from './pages/AdminSettingsPage.tsx';
import { AdminMediaPage } from './pages/AdminMediaPage.tsx';
import { AdminAnnouncementsPage } from './pages/AdminAnnouncementsPage.tsx';
import { AdminReservedPage } from './pages/AdminReservedPage.tsx';
import { AdminLayout } from './components/AdminLayout.tsx';
import { ShieldAlert } from 'lucide-react';

export const AdminApp: React.FC = () => {
  // Normalize current pathname to valid AdminRoute
  const getInitialRoute = (): AdminRoute => {
    if (typeof window === 'undefined') return '/admin';
    const clean = window.location.pathname.replace(/\/+$/, '') || '/admin';
    const validRoutes: AdminRoute[] = [
      '/admin',
      '/admin/login',
      '/admin/members',
      '/admin/projects',
      '/admin/events',
      '/admin/media',
      '/admin/announcements',
      '/admin/imports',
      '/admin/audit',
      '/admin/settings',
    ];
    if (validRoutes.includes(clean as AdminRoute)) {
      return clean as AdminRoute;
    }
    return '/admin';
  };

  const [currentRoute, setCurrentRoute] = useState<AdminRoute>(getInitialRoute);
  const [authState, setAuthState] = useState<AdminAuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    role: null,
    permissions: [],
    session: null,
    error: null,
  });

  // Server-side session verification
  const verifySession = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
    const result = await adminCheckSession();

    if (result.success && result.user) {
      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        user: result.user,
        role: result.role || null,
        permissions: result.permissions || [],
        session: result.session || null,
        error: null,
      });

      // If authenticated and sitting on /admin/login, redirect to /admin
      if (window.location.pathname === '/admin/login') {
        navigateTo('/admin');
      }
    } else {
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        role: null,
        permissions: [],
        session: null,
        error: result.error || null,
      });

      // If unauthenticated and on any /admin/* route other than /admin/login, redirect to /admin/login
      if (window.location.pathname !== '/admin/login') {
        navigateTo('/admin/login');
      }
    }
  }, []);

  useEffect(() => {
    verifySession();

    const handlePopState = () => {
      const path = getInitialRoute();
      setCurrentRoute(path);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [verifySession]);

  const navigateTo = (route: AdminRoute) => {
    setCurrentRoute(route);
    if (typeof window !== 'undefined' && window.location.pathname !== route) {
      window.history.pushState(null, '', route);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    setAuthState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      role: null,
      permissions: [],
      session: null,
      error: null,
    });
    navigateTo('/admin/login');
  };

  // Redirect authenticated administrator away from /admin/login
  useEffect(() => {
    if (!authState.isLoading && authState.isAuthenticated && currentRoute === '/admin/login') {
      navigateTo('/admin');
    }
  }, [authState.isLoading, authState.isAuthenticated, currentRoute]);

  // 1. Loading state while verifying server session
  if (authState.isLoading) {
    return (
      <div className="min-h-screen w-full bg-neutral-950 flex flex-col items-center justify-center text-neutral-400 font-mono text-xs gap-3">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        <span>Verifying administrative session...</span>
      </div>
    );
  }

  // 2. Unauthenticated: always show login screen
  if (!authState.isAuthenticated) {
    return <AdminLoginPage onLoginSuccess={verifySession} />;
  }

  // 3. Authenticated: if on /admin/login, redirecting screen
  if (currentRoute === '/admin/login') {
    return (
      <div className="min-h-screen w-full bg-neutral-950 flex flex-col items-center justify-center text-neutral-400 font-mono text-xs gap-3">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        <span>Redirecting to administration console...</span>
      </div>
    );
  }

  // 4. Authenticated: render within AdminLayout
  return (
    <AdminLayout
      currentRoute={currentRoute}
      onRouteChange={navigateTo}
      onLogout={handleLogout}
      user={authState.user}
      session={authState.session}
    >
      {currentRoute === '/admin' ? (
        <AdminDashboardPage onNavigate={navigateTo} />
      ) : currentRoute === '/admin/members' ? (
        <AdminMembersPage onNavigate={navigateTo} />
      ) : currentRoute === '/admin/projects' ? (
        <AdminProjectsPage onNavigate={navigateTo} />
      ) : currentRoute === '/admin/events' ? (
        <AdminEventsPage onNavigate={navigateTo} />
      ) : currentRoute === '/admin/audit' ? (
        <AdminAuditPage onNavigate={navigateTo} />
      ) : currentRoute === '/admin/settings' ? (
        <AdminSettingsPage onNavigate={navigateTo} />
      ) : currentRoute === '/admin/media' ? (
        <AdminMediaPage onNavigate={navigateTo} />
      ) : currentRoute === '/admin/announcements' ? (
        <AdminAnnouncementsPage />
      ) : currentRoute.startsWith('/admin/') ? (
        <AdminReservedPage route={currentRoute} onNavigate={navigateTo} />
      ) : (
        <div className="p-8 text-center text-neutral-400 text-xs">
          <ShieldAlert className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
          <p>Unrecognized administrative route.</p>
          <button
            type="button"
            onClick={() => navigateTo('/admin')}
            className="mt-4 px-3 py-1.5 bg-neutral-800 text-white rounded text-xs"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </AdminLayout>
  );
};
