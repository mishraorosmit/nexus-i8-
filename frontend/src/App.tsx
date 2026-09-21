/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { CinematicTransitionProvider } from './context/CinematicTransitionContext.tsx';
import { CinematicThemeTransition } from './components/motion/CinematicThemeTransition.tsx';
import { Navbar } from './components/layout/Navbar.tsx';
import { Footer } from './components/layout/Footer.tsx';
import { ContextCursor } from './components/cursor/ContextCursor.tsx';
import { CinematicPreloader } from './components/preloader/CinematicPreloader.tsx';
import { NexusPenguin } from './components/mascot/NexusPenguin.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { AppRoute } from './types.ts';
import { EidCardPage } from './eid/EidCardPage.tsx';

export function isEidPath(pathname: string, hash: string = ''): boolean {
  if (typeof window === 'undefined') return false;
  let clean = (pathname || '').trim().split('?')[0].split('#')[0];
  if (hash && hash.startsWith('#/')) {
    clean = hash.slice(1).split('?')[0];
  }
  if (!clean.startsWith('/')) clean = '/' + clean;
  clean = clean.replace(/\/+$/, '');

  if (!clean || clean === '/') return false;

  const standardRoutes = ['/about', '/projects', '/gallery', '/team', '/contact'];
  if (standardRoutes.includes(clean)) return false;

  if (clean.startsWith('/memberID')) return true;
  if (/^\/nx-[0-9]+/i.test(clean)) return true;

  const segments = clean.slice(1).split('/').filter(Boolean);
  if (segments.length >= 2) return true;

  return false;
}

export function isAdminPath(pathname: string, hash: string = ''): boolean {
  if (typeof window === 'undefined') return false;
  let clean = (pathname || '').trim().split('?')[0].split('#')[0];
  if (hash && hash.startsWith('#/')) {
    clean = hash.slice(1).split('?')[0];
  }
  if (!clean.startsWith('/')) clean = '/' + clean;
  clean = clean.replace(/\/+$/, '');

  return clean === '/admin' || clean.startsWith('/admin/');
}

// Code-split route pages with prefetching on user intent
const AboutPage = lazy(() => import('./pages/AboutPage.tsx').then((m) => ({ default: m.AboutPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage.tsx').then((m) => ({ default: m.ProjectsPage })));
const GalleryPage = lazy(() => import('./pages/GalleryPage.tsx').then((m) => ({ default: m.GalleryPage })));
const TeamPage = lazy(() => import('./pages/TeamPage.tsx').then((m) => ({ default: m.TeamPage })));
const ContactPage = lazy(() => import('./pages/ContactPage.tsx').then((m) => ({ default: m.ContactPage })));
const AdminApp = lazy(() => import('./admin/AdminApp.tsx').then((m) => ({ default: m.AdminApp })));

export default function App() {
  const shouldReduceMotion = useReducedMotion();

  const [currentPath, setCurrentPath] = useState<string>(() => {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  });

  // Normalize initial route from current browser pathname if valid
  const getInitialRoute = (): AppRoute => {
    if (typeof window === 'undefined') return '/';
    const path = window.location.pathname as AppRoute;
    const validRoutes: AppRoute[] = ['/', '/about', '/projects', '/gallery', '/team', '/contact'];
    return validRoutes.includes(path) ? path : '/';
  };

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(getInitialRoute);
  const [showPreloader, setShowPreloader] = useState(true);
  const [isHandoffStarted, setIsHandoffStarted] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentPath(path);
      const validRoutes: AppRoute[] = ['/', '/about', '/projects', '/gallery', '/team', '/contact'];
      setCurrentRoute(validRoutes.includes(path as AppRoute) ? (path as AppRoute) : '/');
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const handleRouteChange = (route: AppRoute) => {
    setCurrentRoute(route);
    setCurrentPath(route);
    if (window.location.pathname !== route) {
      window.history.pushState(null, '', route);
    }
  };

  // Render the corresponding active page
  const renderCurrentPage = () => {
    switch (currentRoute) {
      case '/about':
        return <AboutPage onRouteChange={handleRouteChange} />;
      case '/projects':
        return <ProjectsPage onRouteChange={handleRouteChange} />;
      case '/gallery':
        return <GalleryPage onRouteChange={handleRouteChange} />;
      case '/team':
        return <TeamPage onRouteChange={handleRouteChange} />;
      case '/contact':
        return <ContactPage onRouteChange={handleRouteChange} />;
      case '/':
      default:
        return <HomePage onRouteChange={handleRouteChange} />;
    }
  };

  const isProjectsWorkspace = currentRoute === '/projects';

  if (isAdminPath(currentPath, typeof window !== 'undefined' ? window.location.hash : '')) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen w-full bg-neutral-950 flex items-center justify-center text-neutral-400 font-mono text-xs">
            Loading admin...
          </div>
        }
      >
        <AdminApp />
      </Suspense>
    );
  }

  if (isEidPath(currentPath, typeof window !== 'undefined' ? window.location.hash : '')) {
    return (
      <ThemeProvider>
        <CinematicTransitionProvider>
          <ContextCursor />
          <EidCardPage />
        </CinematicTransitionProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <CinematicTransitionProvider>
        {/* Cinematic theme transition overlay — above all UI, below nothing */}
        <CinematicThemeTransition />

        <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
          {/* Cinematic Brand Preloader: "THE X IS THE NEXUS" */}
          {showPreloader && (
            <CinematicPreloader
              onHandoffStart={() => setIsHandoffStarted(true)}
              onComplete={() => {
                setShowPreloader(false);
                setIsHandoffStarted(true);
              }}
            />
          )}

          {/* Global Isolated Mascot Director (Active on standard website pages) */}
          {!isProjectsWorkspace && (
            <NexusPenguin currentRoute={currentRoute} preloaderFinished={!showPreloader} />
          )}

          {/* Contextual Cursor for fine-pointer desktop interactions */}
          <ContextCursor />

          {/* Persistent Global Responsive Navbar (Shown on all standard pages) */}
          {!isProjectsWorkspace && (
            <Navbar currentRoute={currentRoute} onRouteChange={handleRouteChange} />
          )}

          {/* Primary Route View */}
          <main className="flex-1 w-full flex flex-col">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentRoute}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
                animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={{
                  duration: 0.45,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="w-full flex-1 flex flex-col"
              >
                <Suspense fallback={<div className="w-full min-h-screen bg-[var(--bg-primary)]" />}>
                  {renderCurrentPage()}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Persistent Global Footer (Shown on standard website pages) */}
          {!isProjectsWorkspace && <Footer onRouteChange={handleRouteChange} />}
        </div>
      </CinematicTransitionProvider>
    </ThemeProvider>
  );
}
