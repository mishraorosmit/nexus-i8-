import React, { useState } from 'react';
import { AdminRoute, NavItemConfig, AdminUser, AdminSession } from '../types.ts';
import {
  LayoutDashboard,
  Users,
  FolderGit2,
  Calendar,
  Image as ImageIcon,
  FileSpreadsheet,
  FileText,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  Database,
  ExternalLink,
  Megaphone,
} from 'lucide-react';

interface AdminLayoutProps {
  currentRoute: AdminRoute;
  onRouteChange: (route: AdminRoute) => void;
  onLogout: () => void;
  user: AdminUser | null;
  session: AdminSession | null;
  children: React.ReactNode;
}

export const ADMIN_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/admin',
    isReserved: false,
    description: 'System overview, status, and telemetry',
    apiEndpoint: '/api/admin/*',
  },
  {
    id: 'members',
    label: 'Members',
    path: '/admin/members',
    isReserved: false,
    description: 'Member roster, clearance levels, and E-ID associations',
    apiEndpoint: '/api/admin/members',
  },
  {
    id: 'projects',
    label: 'Projects',
    path: '/admin/projects',
    isReserved: false,
    description: 'Portfolio showcases, repository links, and project teams',
    apiEndpoint: '/api/admin/projects',
  },
  {
    id: 'events',
    label: 'Events',
    path: '/admin/events',
    isReserved: false,
    description: 'Workshops, hackathons, and registration lists',
    apiEndpoint: '/api/admin/events',
  },
  {
    id: 'media',
    label: 'Media',
    path: '/admin/media',
    isReserved: false,
    description: 'Centralized asset registry and Cloudinary image mappings',
    apiEndpoint: '/api/admin/media',
  },
  {
    id: 'announcements',
    label: 'Announcements',
    path: '/admin/announcements',
    isReserved: false,
    description: 'Bulletins, public notices, and broadcast updates',
    apiEndpoint: '/api/admin/announcements',
  },
  {
    id: 'imports',
    label: 'Imports',
    path: '/admin/imports',
    isReserved: true,
    description: 'CSV/JSON batch import, schema validation, and export',
    apiEndpoint: '/api/admin/members/import',
  },
  {
    id: 'audit',
    label: 'Audit Logs',
    path: '/admin/audit',
    isReserved: false,
    description: 'Security logs, mutation records, and admin activity',
    apiEndpoint: '/api/admin/audit-logs',
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/admin/settings',
    isReserved: false,
    description: 'Organization settings, maintenance mode, and parameters',
    apiEndpoint: '/api/admin/site-settings',
  },
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentRoute,
  onRouteChange,
  onLogout,
  user,
  session,
  children,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getNavIcon = (id: string) => {
    switch (id) {
      case 'dashboard':
        return <LayoutDashboard className="w-4 h-4" />;
      case 'members':
        return <Users className="w-4 h-4" />;
      case 'projects':
        return <FolderGit2 className="w-4 h-4" />;
      case 'events':
        return <Calendar className="w-4 h-4" />;
      case 'media':
        return <ImageIcon className="w-4 h-4" />;
      case 'announcements':
        return <Megaphone className="w-4 h-4" />;
      case 'imports':
        return <FileSpreadsheet className="w-4 h-4" />;
      case 'audit':
        return <FileText className="w-4 h-4" />;
      case 'settings':
        return <Settings className="w-4 h-4" />;
      default:
        return <LayoutDashboard className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans antialiased">
      {/* Top Header */}
      <header className="h-14 border-b border-neutral-800 bg-neutral-900/90 backdrop-blur px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => onRouteChange('/admin')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-7 h-7 rounded bg-white text-neutral-950 flex items-center justify-center font-bold text-xs tracking-tighter">
              NX
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight leading-none text-white">
                NEXUS Admin
              </span>
              <span className="text-[10px] text-neutral-400 font-mono leading-tight mt-0.5">
                Internal Portal
              </span>
            </div>
          </div>
        </div>

        {/* Status Indicators & Session Controls */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-400 border-r border-neutral-800 pr-4">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-[11px] text-emerald-400">SQLite Connected</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-medium text-neutral-200">
                {user?.name || 'Administrator'}
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                {session?.sessionId ? `ID: ${session.sessionId.slice(0, 14)}...` : 'Session Active'}
              </span>
            </div>

            <button
              id="admin-logout-button"
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md transition-colors cursor-pointer"
              title="Terminate administrative session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:flex flex-col w-56 border-r border-neutral-800 bg-neutral-900/50 p-3 shrink-0">
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 px-3 py-2 font-medium">
            Navigation
          </div>
          <nav className="space-y-1">
            {ADMIN_NAV_ITEMS.map((item) => {
              const isActive = currentRoute === item.path;
              return (
                <button
                  key={item.id}
                  id={`admin-nav-${item.id}`}
                  type="button"
                  onClick={() => onRouteChange(item.path)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-neutral-800 text-white border border-neutral-700'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? 'text-white' : 'text-neutral-400'}>
                      {getNavIcon(item.id)}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.isReserved && (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                      Reserved
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-neutral-800 px-3 pb-2 text-[11px] text-neutral-400">
            <div className="flex items-center justify-between mb-1">
              <span>Security</span>
              <span className="text-neutral-400 flex items-center gap-1 text-[10px]">
                <Shield className="w-3 h-3 text-emerald-400" /> scrypt / HttpOnly
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="text-neutral-400 hover:text-neutral-200 inline-flex items-center gap-1 transition-colors"
              >
                <span>View Public Site</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-neutral-950/80 backdrop-blur-sm flex">
            <div className="w-64 bg-neutral-900 border-r border-neutral-800 p-4 flex flex-col h-full">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800">
                <span className="text-xs font-semibold text-white">Admin Navigation</span>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1">
                {ADMIN_NAV_ITEMS.map((item) => {
                  const isActive = currentRoute === item.path;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onRouteChange(item.path);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                        isActive
                          ? 'bg-neutral-800 text-white'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {getNavIcon(item.id)}
                        <span>{item.label}</span>
                      </div>
                      {item.isReserved && (
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                          Reserved
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-auto pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-400 bg-red-950/30 border border-red-900/50 rounded-md"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
