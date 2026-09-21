/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileJson,
  X,
  ShieldCheck,
  Filter,
  Check,
} from 'lucide-react';
import { AdminMemberQueryParams } from '../types.ts';
import { adminGetExportUrl } from '../api.ts';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: AdminMemberQueryParams;
  totalFiltered: number;
  totalAll: number;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  currentFilters,
  totalFiltered,
  totalAll,
}) => {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered');

  if (!isOpen) return null;

  const handleDownload = () => {
    const params = scope === 'filtered' ? { ...currentFilters, format } : { format };
    const url = adminGetExportUrl(params);

    // Trigger browser download via invisible link anchor
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    onClose();
  };

  const hasActiveFilters =
    (currentFilters.status && currentFilters.status !== 'all') ||
    !!currentFilters.role ||
    !!currentFilters.domain ||
    !!currentFilters.department ||
    !!currentFilters.q ||
    !!currentFilters.search;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-800/60 border border-neutral-700/50 flex items-center justify-center text-cyan-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">Export Members</h2>
              <p className="text-xs font-mono text-neutral-400">
                Download member roster in CSV or JSON format
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors rounded-lg hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Format Selection */}
          <div>
            <label className="block text-xs font-mono text-neutral-300 mb-2 font-medium">
              EXPORT FORMAT
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-3 rounded-lg border text-left flex items-start gap-3 transition-all ${
                  format === 'csv'
                    ? 'bg-emerald-950/30 border-emerald-500/80 text-emerald-200 ring-1 ring-emerald-500/50'
                    : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-xs font-bold text-neutral-100">CSV Document</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    Spreadsheet compatible with formula defense
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`p-3 rounded-lg border text-left flex items-start gap-3 transition-all ${
                  format === 'json'
                    ? 'bg-emerald-950/30 border-emerald-500/80 text-emerald-200 ring-1 ring-emerald-500/50'
                    : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <FileJson className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-xs font-bold text-neutral-100">JSON Payload</div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    Raw structured JSON dataset
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Scope Selection */}
          <div>
            <label className="block text-xs font-mono text-neutral-300 mb-2 font-medium">
              EXPORT SCOPE
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                  scope === 'filtered'
                    ? 'bg-neutral-800/80 border-neutral-600 text-white'
                    : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="scope"
                    value="filtered"
                    checked={scope === 'filtered'}
                    onChange={() => setScope('filtered')}
                    className="text-emerald-500 focus:ring-emerald-500 bg-neutral-900 border-neutral-700"
                  />
                  <div>
                    <div className="text-xs font-medium text-neutral-200 flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Current Filtered View</span>
                    </div>
                    <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                      {hasActiveFilters ? 'Matches active query & filters' : 'All currently visible members'}
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-200">
                  {totalFiltered} rows
                </span>
              </label>

              <label
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                  scope === 'all'
                    ? 'bg-neutral-800/80 border-neutral-600 text-white'
                    : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="scope"
                    value="all"
                    checked={scope === 'all'}
                    onChange={() => setScope('all')}
                    className="text-emerald-500 focus:ring-emerald-500 bg-neutral-900 border-neutral-700"
                  />
                  <div>
                    <div className="text-xs font-medium text-neutral-200">
                      Entire Member Database
                    </div>
                    <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                      Ignores active filters, exports all records
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-neutral-800 text-neutral-200">
                  {totalAll} rows
                </span>
              </label>
            </div>
          </div>

          {/* Formula injection security notice */}
          {format === 'csv' && (
            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-start gap-2.5 text-xs text-neutral-400 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <p>
                <strong>Formula Injection Protected:</strong> Text cells starting with <code>=</code>, <code>+</code>, <code>-</code>, or <code>@</code> are safely prefixed with a quote to prevent spreadsheet code execution.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-950/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium transition-colors shadow-lg"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download {format.toUpperCase()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
