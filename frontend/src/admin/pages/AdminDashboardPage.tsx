import React, { useEffect, useState, useCallback } from 'react';
import { adminGetDashboardData } from '../api.ts';
import { AdminDashboardData, AdminRoute } from '../types.ts';
import {
  Database,
  Users,
  UserCheck,
  UserMinus,
  GraduationCap,
  FolderGit2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

interface AdminDashboardPageProps {
  onNavigate: (route: AdminRoute) => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const res = await adminGetDashboardData();

    if (res.success && res.data) {
      setMetrics(res.data);
      setIsLoading(false);
    } else {
      setError(res.error || 'Failed to retrieve database metrics.');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            Administration Console
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Real SQLite database metrics (<code className="text-neutral-300 font-mono">data/nexus.db</code>) and operational status
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchMetrics}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh database metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active Session
          </span>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <div>
              <span className="font-semibold text-red-300">Backend Communication Issue: </span>
              <span className="text-red-400/90">{error}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchMetrics}
            className="px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-200 text-[11px] font-medium transition-colors shrink-0 cursor-pointer border border-red-700/60"
          >
            Retry Query
          </button>
        </div>
      )}

      {/* Database Connection Status Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono">
              Database Engine
            </span>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-neutral-100">
                Connected & Operational
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">Node 22 native node:sqlite (nexus.db)</p>
          </div>
          <div className="w-9 h-9 rounded bg-neutral-800 flex items-center justify-center text-neutral-400">
            <Database className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-mono">
              Security Boundary
            </span>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-neutral-100">
                Authenticated Session
              </span>
            </div>
            <p className="text-[10px] text-neutral-400">HttpOnly cookie verification (24h lifespan)</p>
          </div>
          <div className="w-9 h-9 rounded bg-neutral-800 flex items-center justify-center text-neutral-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Primary Member Metrics: Total, Active, Inactive, Alumni */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-neutral-300" />
            <span>Member Roster Metrics (Real SQLite Data)</span>
          </h2>
          <span className="text-[11px] text-neutral-400">Source: members table</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* TOTAL MEMBERS */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium text-neutral-300">TOTAL MEMBERS</span>
              <Users className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {isLoading ? (
                <span className="text-neutral-500 animate-pulse">...</span>
              ) : (
                metrics?.members.total ?? 0
              )}
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">All registered records</div>
          </div>

          {/* ACTIVE MEMBERS */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium text-emerald-400">ACTIVE MEMBERS</span>
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">
              {isLoading ? (
                <span className="text-neutral-500 animate-pulse">...</span>
              ) : (
                metrics?.members.active ?? 0
              )}
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">Status = ACTIVE</div>
          </div>

          {/* INACTIVE MEMBERS */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium text-neutral-400">INACTIVE MEMBERS</span>
              <UserMinus className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-bold text-neutral-300 font-mono">
              {isLoading ? (
                <span className="text-neutral-500 animate-pulse">...</span>
              ) : (
                metrics?.members.inactive ?? 0
              )}
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">Status = INACTIVE</div>
          </div>

          {/* ALUMNI */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium text-blue-400">ALUMNI</span>
              <GraduationCap className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-400 font-mono">
              {isLoading ? (
                <span className="text-neutral-500 animate-pulse">...</span>
              ) : (
                metrics?.members.alumni ?? 0
              )}
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">Status = ALUMNI</div>
          </div>
        </div>
      </div>

      {/* Additional Clean Ecosystem Entities (Projects & Events) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-neutral-300" />
            <span>Platform Ecosystem Entities (Real SQLite Data)</span>
          </h2>
          <span className="text-[11px] text-neutral-400">Source: projects, events tables</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium text-neutral-300">TOTAL PROJECTS</span>
              <FolderGit2 className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {isLoading ? (
                <span className="text-neutral-500 animate-pulse">...</span>
              ) : (
                metrics?.projects?.total ?? 0
              )}
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">Active showcase initiatives</div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium text-neutral-300">UPCOMING EVENTS</span>
              <Calendar className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {isLoading ? (
                <span className="text-neutral-500 animate-pulse">...</span>
              ) : (
                metrics?.events?.upcoming ?? 0
              )}
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">
              {metrics?.events?.total !== undefined ? `${metrics.events.total} total recorded events` : 'Scheduled sessions'}
            </div>
          </div>
        </div>
      </div>

      {/* Administrative Modules Navigation */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-neutral-400">
            Administrative Modules
          </h2>
          <span className="text-[11px] text-neutral-400">Deliberate placeholders for subsequent phases</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              title: 'Members',
              route: '/admin/members' as AdminRoute,
              desc: 'Member roster, unique IDs (NX-001..NX-026+), clearance levels, and avatars',
            },
            {
              title: 'Projects',
              route: '/admin/projects' as AdminRoute,
              desc: 'Project lifecycle, featured flags, deliverables, and repo links',
            },
            {
              title: 'Events',
              route: '/admin/events' as AdminRoute,
              desc: 'Event scheduling, registration lists, venues, and banners',
            },
            {
              title: 'Media',
              route: '/admin/media' as AdminRoute,
              desc: 'Asset repository, storage management, and Cloudinary image mappings',
            },
            {
              title: 'Announcements',
              route: '/admin/announcements' as AdminRoute,
              desc: 'Bulletins, public notices, recruitment schedules, and operational alerts',
            },
            {
              title: 'Imports',
              route: '/admin/imports' as AdminRoute,
              desc: 'CSV/JSON batch import pipeline, verification, and export',
            },
            {
              title: 'Audit Logs',
              route: '/admin/audit' as AdminRoute,
              desc: 'Tamper-evident mutation logs, before/after diffs, and admin activity',
            },
            {
              title: 'Settings',
              route: '/admin/settings' as AdminRoute,
              desc: 'Platform parameters, maintenance mode, and security configuration',
            },
          ].map((card) => (
            <div
              key={card.route}
              onClick={() => onNavigate(card.route)}
              className="bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 rounded-lg p-4 transition-colors cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-neutral-200 group-hover:text-white transition-colors">
                    {card.title}
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-200 transition-colors" />
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                  {card.desc}
                </p>
              </div>
              <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] font-mono text-neutral-400">
                <span>{card.route}</span>
                <span className="text-neutral-400 uppercase">Reserved</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
