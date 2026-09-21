/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Project } from '../../types.ts';
import {
  ExternalLink,
  Code,
  FileText,
  Layers,
  CheckCircle2,
  Users,
  Copy,
  Check,
  Tag,
  Calendar,
  Sparkles,
  Github,
} from 'lucide-react';

interface LinuxProjectViewProps {
  project: Project;
}

export const LinuxProjectView: React.FC<LinuxProjectViewProps> = ({ project }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'readme' | 'deliverables' | 'json'>('overview');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const data = JSON.stringify(project, null, 2);
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenGithub = () => {
    if (project.githubUrl) {
      window.open(project.githubUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleOpenDemo = () => {
    if (project.demoUrl) {
      window.open(project.demoUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#141414]">
      {/* File Inspector Top Toolbar */}
      <div className="h-10 px-4 bg-[#181818] border-b border-[rgba(245,239,230,0.10)] flex items-center justify-between gap-4 shrink-0">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1 font-mono text-xs rounded-[2px] transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#F2613F] text-[#F5EFE6] font-bold'
                : 'text-[#857E74] hover:text-[#F5EFE6] hover:bg-white/[0.06]'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>OVERVIEW</span>
          </button>

          <button
            onClick={() => setActiveTab('readme')}
            className={`px-3 py-1 font-mono text-xs rounded-[2px] transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'readme'
                ? 'bg-[#F2613F] text-[#F5EFE6] font-bold'
                : 'text-[#857E74] hover:text-[#F5EFE6] hover:bg-white/[0.06]'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>README.md</span>
          </button>

          <button
            onClick={() => setActiveTab('deliverables')}
            className={`px-3 py-1 font-mono text-xs rounded-[2px] transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'deliverables'
                ? 'bg-[#F2613F] text-[#F5EFE6] font-bold'
                : 'text-[#857E74] hover:text-[#F5EFE6] hover:bg-white/[0.06]'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>DELIVERABLES.txt</span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1 font-mono text-xs rounded-[2px] transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'json'
                ? 'bg-[#F2613F] text-[#F5EFE6] font-bold'
                : 'text-[#857E74] hover:text-[#F5EFE6] hover:bg-white/[0.06]'
            }`}
          >
            <Code className="w-3 h-3" />
            <span>METADATA.json</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="p-1.5 text-[#857E74] hover:text-[#F5EFE6] bg-white/[0.04] hover:bg-white/[0.1] rounded-[2px] transition-colors cursor-pointer"
            title="Copy metadata JSON"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#F2613F]" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {project.demoUrl && (
            <button
              onClick={handleOpenDemo}
              className="px-2.5 py-1 bg-white/[0.08] hover:bg-white/[0.16] text-[#F5EFE6] font-mono text-xs rounded-[2px] flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
            >
              <span>LIVE DEMO</span>
              <ExternalLink className="w-3 h-3 text-[#F2613F]" />
            </button>
          )}

          {project.githubUrl ? (
            <button
              onClick={handleOpenGithub}
              className="px-2.5 py-1 bg-[#F2613F] hover:bg-[#d94e22] text-[#F5EFE6] font-mono text-xs font-bold rounded-[2px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Github className="w-3 h-3" />
              <span>GITHUB</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          ) : (
            <span
              title="Repository is currently internal or restricted"
              className="px-2 py-1 bg-white/[0.04] text-[#857E74] font-mono text-[11px] rounded-[2px] border border-white/5 cursor-not-allowed select-none"
            >
              REPO RESTRICTED
            </span>
          )}
        </div>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-[#F5EFE6] select-text">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 max-w-3xl">
            {/* Header Identity */}
            <div className="pb-4 border-b border-[rgba(245,239,230,0.10)]">
              <div className="flex items-center gap-2 font-mono text-xs text-[#F2613F] mb-1">
                <span>{project.projectNumber}</span>
                <span>//</span>
                <span>STATUS: {project.status.toUpperCase()}</span>
                <span>//</span>
                <span>{project.year}</span>
              </div>
              <h1 className="font-fraunces font-bold text-3xl sm:text-4xl text-[#F5EFE6] tracking-tight">
                {project.title}
              </h1>
              <p className="font-mono text-xs text-[#857E74] uppercase tracking-wider mt-1">
                {project.disciplines}
              </p>
            </div>

            {/* Core Summary */}
            <div className="p-4 bg-[#181818] border border-[rgba(245,239,230,0.10)] rounded-[2px]">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#F2613F] block mb-1">
                EXECUTIVE SUMMARY
              </span>
              <p className="font-bitter text-base text-[#F5EFE6] leading-relaxed">
                {project.summary}
              </p>
            </div>

            {/* Deep Description */}
            <div className="space-y-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#857E74]">
                PROJECT CONTEXT & METHODOLOGY
              </span>
              <p className="font-bitter text-sm text-[#C2BBB0] leading-relaxed">
                {project.description}
              </p>
            </div>

            {/* Student Leads & Tech Stack */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Student Leads / Contributors */}
              <div className="p-4 bg-[#181818] border border-[rgba(245,239,230,0.10)] rounded-[2px] space-y-2.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#F2613F] flex items-center gap-1.5">
                  <Users className="w-3 h-3" />
                  <span>{project.contributors ? 'CONTRIBUTORS' : 'STUDENT SQUAD LEADS'}</span>
                </span>
                {project.contributors ? (
                  <div className="space-y-2.5">
                    {Object.entries(project.contributors).map(([category, members]) => (
                      <div key={category} className="space-y-1">
                        <span className="font-mono text-[10px] font-bold text-[#857E74] tracking-wider block">
                          {category}
                        </span>
                        <ul className="space-y-1">
                          {members.map((name) => (
                            <li key={name} className="font-mono text-xs text-[#F5EFE6] flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-[#F2613F] rounded-full" />
                              <span>{name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {project.leadStudents.map((lead) => (
                      <li key={lead} className="font-mono text-xs text-[#F5EFE6] flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-[#F2613F] rounded-full" />
                        <span>{lead}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Technologies */}
              <div className="p-4 bg-[#181818] border border-[rgba(245,239,230,0.10)] rounded-[2px] space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#F2613F] flex items-center gap-1.5">
                  <Tag className="w-3 h-3" />
                  <span>TECHNOLOGY STACK</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-[#22201F] text-[#C2BBB0] font-mono text-[11px] rounded-[2px] border border-white/5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Deliverables Checklist */}
            {project.deliverables && project.deliverables.length > 0 && (
              <div className="p-4 bg-[#181818] border border-[rgba(245,239,230,0.10)] rounded-[2px] space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#F2613F] block">
                  SHIPPED ARTIFACT DELIVERABLES
                </span>
                <ul className="space-y-1.5">
                  {project.deliverables.map((item) => (
                    <li key={item} className="flex items-center gap-2 font-mono text-xs text-[#C2BBB0]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#F2613F] shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* README.md TAB */}
        {activeTab === 'readme' && (
          <div className="max-w-3xl font-mono text-xs space-y-4">
            <div className="p-4 bg-[#0C0C0C] border border-[rgba(245,239,230,0.10)] rounded-[2px] text-[#857E74] space-y-4">
              <div className="pb-3 border-b border-white/10 text-[#F5EFE6]">
                <span className="text-[#F2613F]"># </span>
                <span className="font-bold text-lg">{project.title}</span>
                <p className="text-xs text-[#857E74] mt-1">{project.summary}</p>
              </div>

              <div>
                <span className="text-[#F2613F]">## </span>
                <span className="text-[#F5EFE6] font-bold">1. Background & Scope</span>
                <p className="text-[#C2BBB0] mt-1 font-bitter text-sm leading-relaxed">
                  {project.description}
                </p>
              </div>

              <div>
                <span className="text-[#F2613F]">## </span>
                <span className="text-[#F5EFE6] font-bold">2. Architecture & Modules</span>
                <div className="mt-2 p-3 bg-[#181818] rounded-[2px] text-[#F5EFE6] text-[11px] space-y-1 border border-white/5">
                  <div>📁 src/</div>
                  <div className="pl-4">├── 📄 engine.ts // Core system logic</div>
                  <div className="pl-4">├── 📄 render.ts // Visualization canvas pipeline</div>
                  <div className="pl-4">└── 📄 schema.ts // Type definitions</div>
                </div>
              </div>

              <div>
                <span className="text-[#F2613F]">## </span>
                <span className="text-[#F5EFE6] font-bold">
                  {project.contributors ? '3. Contributors' : '3. Squad Authors'}
                </span>
                {project.contributors ? (
                  <div className="mt-2 space-y-2 text-[#C2BBB0]">
                    {Object.entries(project.contributors).map(([category, members]) => (
                      <div key={category} className="space-y-0.5">
                        <span className="text-[11px] font-bold text-[#F5EFE6] uppercase">{category}:</span>
                        <ul className="list-disc list-inside pl-2 text-xs">
                          {members.map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="list-disc list-inside mt-1 text-[#C2BBB0]">
                    {project.leadStudents.map((lead) => (
                      <li key={lead}>{lead}</li>
                    ))}
                  </ul>
                )}
              </div>

              {project.githubUrl && (
                <div className="pt-2 border-t border-white/10 text-[#857E74]">
                  <span>Git Repository: </span>
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#F2613F] underline hover:text-[#F5EFE6]"
                  >
                    {project.githubUrl}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DELIVERABLES.txt TAB */}
        {activeTab === 'deliverables' && (
          <div className="max-w-3xl font-mono text-xs space-y-2">
            <div className="p-4 bg-[#0C0C0C] border border-[rgba(245,239,230,0.10)] rounded-[2px] text-[#C2BBB0] space-y-3">
              <div className="text-[#F2613F] font-bold">
                === PROJECT ARTIFACT SPECIFICATION: {project.projectNumber} ===
              </div>
              <div className="text-[#857E74]">
                Generated on: Cohort {project.year} // Status: {project.status}
              </div>
              <hr className="border-white/10" />
              <div className="space-y-2">
                {project.deliverables?.map((item, idx) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="text-[#F2613F]">[PASS]</span>
                    <span>0{idx + 1}. {item}</span>
                  </div>
                ))}
              </div>
              <hr className="border-white/10" />
              <div className="text-[11px] text-[#857E74]">
                All milestones verified by NEXUS Core Engineering Review Guild.
              </div>
            </div>
          </div>
        )}

        {/* METADATA.json TAB */}
        {activeTab === 'json' && (
          <div className="max-w-3xl font-mono text-xs">
            <pre className="p-4 bg-[#0C0C0C] border border-[rgba(245,239,230,0.10)] rounded-[2px] text-[#C2BBB0] overflow-x-auto leading-relaxed">
              {JSON.stringify(project, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Status Footer Bar */}
      <div className="h-7 px-4 bg-[#181818] border-t border-[rgba(245,239,230,0.10)] flex items-center justify-between font-mono text-[10px] text-[#857E74] shrink-0">
        <div className="flex items-center gap-3">
          <span>PATH: /home/nexus/projects/{project.title.toLowerCase()}</span>
          <span>•</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-[#F2613F] rounded-full" />
          <span className="text-[#F5EFE6] uppercase">{project.category}</span>
        </div>
      </div>
    </div>
  );
};
