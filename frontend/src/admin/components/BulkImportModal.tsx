/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  ArrowRight,
  RefreshCw,
  Info,
  Layers,
  FileJson,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ImportMode,
  ImportPreviewResult,
  ImportCommitResult,
  RowPreview,
} from '../types.ts';
import { adminPreviewMemberImport, adminCommitMemberImport } from '../api.ts';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: ImportCommitResult) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'INPUT' | 'PREVIEW' | 'RESULT'>('INPUT');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [mode, setMode] = useState<ImportMode>('UPSERT');
  const [content, setContent] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setStep('INPUT');
    setContent('');
    setFileName(null);
    setError(null);
    setPreview(null);
    setCommitResult(null);
    setIsLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    // Auto-detect format from extension
    if (file.name.toLowerCase().endsWith('.json')) {
      setFormat('json');
    } else if (file.name.toLowerCase().endsWith('.csv')) {
      setFormat('csv');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setContent(text || '');
    };
    reader.onerror = () => {
      setError('Failed to read selected file.');
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    if (file.name.toLowerCase().endsWith('.json')) {
      setFormat('json');
    } else if (file.name.toLowerCase().endsWith('.csv')) {
      setFormat('csv');
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setContent(text || '');
    };
    reader.readAsText(file, 'utf-8');
  };

  const handlePreview = async () => {
    if (!content.trim()) {
      setError('Please select a file or enter import content.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const res = await adminPreviewMemberImport({
      content,
      format,
      mode,
    });

    setIsLoading(false);

    if (res.success && res.data) {
      setPreview(res.data);
      setStep('PREVIEW');
    } else {
      setError(res.error || 'Failed to preview import payload.');
    }
  };

  const handleCommit = async () => {
    if (!content.trim() || !preview?.canCommit) return;

    setIsLoading(true);
    setError(null);

    const res = await adminCommitMemberImport({
      content,
      format,
      mode,
    });

    setIsLoading(false);

    if (res.success && res.data) {
      setCommitResult(res.data);
      setStep('RESULT');
      onSuccess(res.data);
    } else {
      setError(res.error || 'Failed to commit import to SQLite.');
    }
  };

  const renderStatusPill = (c: RowPreview['classification']) => {
    switch (c) {
      case 'NEW':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            NEW
          </span>
        );
      case 'UPDATE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
            UPDATE
          </span>
        );
      case 'DUPLICATE':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-950/60 text-amber-400 border border-amber-800/40">
            DUPLICATE
          </span>
        );
      case 'CONFLICT':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-950/60 text-purple-400 border border-purple-800/40">
            CONFLICT
          </span>
        );
      case 'INVALID':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-950/60 text-rose-400 border border-rose-800/40">
            INVALID
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-800/60 border border-neutral-700/50 flex items-center justify-center text-emerald-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                {step === 'INPUT' && 'Bulk Member Import'}
                {step === 'PREVIEW' && 'Import Validation & Preview'}
                {step === 'RESULT' && 'Import Complete'}
              </h2>
              <p className="text-xs font-mono text-neutral-400">
                Safe, transactional CSV &amp; JSON batch ingestion into SQLite
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors rounded-lg hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-950/80 border border-rose-800/60 rounded-lg flex items-start gap-2.5 text-rose-200 text-xs font-mono">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: INPUT */}
          {step === 'INPUT' && (
            <div className="space-y-6">
              {/* Import Mode Selection */}
              <div>
                <label className="block text-xs font-mono text-neutral-300 mb-2 font-medium">
                  IMPORT MODE
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('UPSERT')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      mode === 'UPSERT'
                        ? 'bg-emerald-950/30 border-emerald-500/80 text-emerald-200 ring-1 ring-emerald-500/50'
                        : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="font-mono text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      UPSERT (Default)
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                      Create new records and update matched existing members.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('CREATE_ONLY')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      mode === 'CREATE_ONLY'
                        ? 'bg-emerald-950/30 border-emerald-500/80 text-emerald-200 ring-1 ring-emerald-500/50'
                        : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="font-mono text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      CREATE ONLY
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                      Only add brand new members. Existing matches are rejected.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('UPDATE_ONLY')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      mode === 'UPDATE_ONLY'
                        ? 'bg-emerald-950/30 border-emerald-500/80 text-emerald-200 ring-1 ring-emerald-500/50'
                        : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="font-mono text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      UPDATE ONLY
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                      Only update existing records. Unknown members are rejected.
                    </p>
                  </button>
                </div>
              </div>

              {/* Format Toggle & Raw Paste Switch */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-neutral-400">Format:</span>
                  <button
                    type="button"
                    onClick={() => setFormat('csv')}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center gap-1.5 border ${
                      format === 'csv'
                        ? 'bg-neutral-800 text-white border-neutral-700'
                        : 'text-neutral-400 border-transparent hover:text-neutral-200'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('json')}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center gap-1.5 border ${
                      format === 'json'
                        ? 'bg-neutral-800 text-white border-neutral-700'
                        : 'text-neutral-400 border-transparent hover:text-neutral-200'
                    }`}
                  >
                    <FileJson className="w-3.5 h-3.5 text-cyan-400" />
                    JSON
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPasting(!isPasting)}
                  className="text-xs font-mono text-emerald-400 hover:text-emerald-300 underline"
                >
                  {isPasting ? 'Upload File Instead' : 'Paste Text Instead'}
                </button>
              </div>

              {/* File Dropzone or Textarea */}
              {!isPasting ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-950/40 rounded-xl p-8 text-center cursor-pointer transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 mx-auto rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 mb-3">
                    <Upload className="w-6 h-6 text-emerald-400" />
                  </div>
                  {fileName ? (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-neutral-100">{fileName}</p>
                      <p className="text-xs text-emerald-400 font-mono">
                        File loaded ({Buffer.byteLength(content, 'utf-8')} bytes)
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-neutral-200">
                        Drag and drop your file here, or click to browse
                      </p>
                      <p className="text-xs text-neutral-400 font-mono">
                        Supports UTF-8 CSV or JSON array (max 5MB, up to 1000 records)
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={
                      format === 'csv'
                        ? 'Unique ID,Member Name,Role,Department,Email,Status\nNX-001,Jitesh Raj,Head of Operations,Operations,jitesh@nexus.campus,ACTIVE'
                        : '[\n  {\n    "name": "Jitesh Raj",\n    "role": "Head of Operations",\n    "unique_id": "NX-001"\n  }\n]'
                    }
                    rows={8}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-y"
                  />
                </div>
              )}

              <div className="p-3 bg-neutral-950/40 border border-neutral-800/80 rounded-lg flex items-start gap-2.5 text-xs text-neutral-400 font-mono">
                <Info className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                <p>
                  Existing members can be matched by <strong>unique_id</strong> or <strong>email</strong>.
                  New members without a unique ID will automatically receive the next sequential ID (e.g. NX-030).
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === 'PREVIEW' && preview && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase">Total</div>
                  <div className="text-lg font-bold text-neutral-100 font-mono mt-0.5">
                    {preview.totalRows}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-neutral-950 border border-emerald-900/40">
                  <div className="text-[10px] font-mono text-emerald-400 uppercase">New</div>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                    {preview.newRecords}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-neutral-950 border border-cyan-900/40">
                  <div className="text-[10px] font-mono text-cyan-400 uppercase">Updates</div>
                  <div className="text-lg font-bold text-cyan-400 font-mono mt-0.5">
                    {preview.updates}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-neutral-950 border border-amber-900/40">
                  <div className="text-[10px] font-mono text-amber-400 uppercase">Duplicates</div>
                  <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
                    {preview.duplicates}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-neutral-950 border border-purple-900/40">
                  <div className="text-[10px] font-mono text-purple-400 uppercase">Conflicts</div>
                  <div className="text-lg font-bold text-purple-400 font-mono mt-0.5">
                    {preview.conflicts}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-neutral-950 border border-rose-900/40">
                  <div className="text-[10px] font-mono text-rose-400 uppercase">Invalid</div>
                  <div className="text-lg font-bold text-rose-400 font-mono mt-0.5">
                    {preview.invalidRows}
                  </div>
                </div>
              </div>

              {/* Status note */}
              {preview.canCommit ? (
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg flex items-center gap-2 text-emerald-300 text-xs font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Validation passed! All {preview.validRows} rows are ready for atomic transactional commit.</span>
                </div>
              ) : (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg flex items-center gap-2 text-rose-300 text-xs font-mono">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    Commit blocked: Fix the {preview.invalidRows} invalid, {preview.duplicates} duplicate, or {preview.conflicts} conflicting rows before proceeding.
                  </span>
                </div>
              )}

              {/* Row Preview Table */}
              <div className="border border-neutral-800 rounded-lg overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead className="bg-neutral-950 sticky top-0 border-b border-neutral-800 text-neutral-400">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Unique ID</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Email</th>
                        <th className="py-2.5 px-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 bg-neutral-900/40">
                      {preview.rows.map((row) => (
                        <tr key={row.rowNumber} className="hover:bg-neutral-800/30 transition-colors">
                          <td className="py-2 px-3 text-neutral-400">{row.rowNumber}</td>
                          <td className="py-2 px-3">{renderStatusPill(row.classification)}</td>
                          <td className="py-2 px-3 text-neutral-200">{row.uniqueId || '-'}</td>
                          <td className="py-2 px-3 font-medium text-neutral-100">{row.name}</td>
                          <td className="py-2 px-3 text-neutral-300">{row.role}</td>
                          <td className="py-2 px-3 text-neutral-400">{row.email || '-'}</td>
                          <td className="py-2 px-3">
                            {row.errors.length > 0 ? (
                              <span className="text-rose-400 font-medium">
                                {row.errors.map((e) => e.message).join('; ')}
                              </span>
                            ) : row.warnings.length > 0 ? (
                              <span className="text-amber-400">
                                {row.warnings.join('; ')}
                              </span>
                            ) : (
                              <span className="text-emerald-400/80">Valid</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: RESULT */}
          {step === 'RESULT' && commitResult && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center mx-auto text-emerald-400 shadow-xl">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-neutral-100">
                  Bulk Import Committed Successfully!
                </h3>
                <p className="text-xs text-neutral-400 font-mono mt-1">
                  Processed {commitResult.totalProcessed} members in {commitResult.durationMs}ms inside an ACID transaction.
                </p>
              </div>

              <div className="inline-flex items-center gap-6 p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-xs font-mono">
                <div>
                  <span className="text-neutral-400">Created:</span>{' '}
                  <strong className="text-emerald-400">{commitResult.createdCount}</strong>
                </div>
                <div className="h-4 w-[1px] bg-neutral-800" />
                <div>
                  <span className="text-neutral-400">Updated:</span>{' '}
                  <strong className="text-cyan-400">{commitResult.updatedCount}</strong>
                </div>
                <div className="h-4 w-[1px] bg-neutral-800" />
                <div>
                  <span className="text-neutral-400">Mode:</span>{' '}
                  <strong className="text-neutral-200">{commitResult.mode}</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-950/50">
          {step === 'INPUT' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={isLoading || !content.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-mono font-medium transition-colors"
              >
                {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Parse &amp; Preview</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {step === 'PREVIEW' && (
            <>
              <button
                type="button"
                onClick={() => setStep('INPUT')}
                disabled={isLoading}
                className="px-4 py-2 text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={isLoading || !preview?.canCommit}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-mono font-medium transition-colors shadow-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Committing Transaction...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Commit Import</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 'RESULT' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium transition-colors"
              >
                Done / Refresh Roster
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
