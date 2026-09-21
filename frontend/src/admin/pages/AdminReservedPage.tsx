import React from 'react';
import { AdminRoute } from '../types.ts';
import { ADMIN_NAV_ITEMS } from '../components/AdminLayout.tsx';
import { ArrowLeft, Construction } from 'lucide-react';

interface AdminReservedPageProps {
  route: AdminRoute;
  onNavigate: (route: AdminRoute) => void;
}

export const AdminReservedPage: React.FC<AdminReservedPageProps> = ({ route, onNavigate }) => {
  const itemConfig = ADMIN_NAV_ITEMS.find((item) => item.path === route);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={() => onNavigate('/admin')}
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Main Deliberate Placeholder Card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-lg font-semibold text-white tracking-tight">
              {itemConfig?.label || 'Administrative Module'}
            </h1>
            <p className="text-sm font-medium text-neutral-300">
              This module is not implemented yet.
            </p>
            <p className="text-xs text-neutral-400 leading-relaxed pt-1">
              Route <code className="font-mono text-neutral-300 px-1 py-0.5 rounded bg-neutral-950 border border-neutral-800">{route}</code> is reserved for subsequent implementation phases. No mock or sample data is exposed.
            </p>
          </div>

          <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 shrink-0">
            <Construction className="w-5 h-5" />
          </div>
        </div>

        {/* Back to Dashboard Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer border border-neutral-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
