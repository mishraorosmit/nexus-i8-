/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Project } from '../../types.ts';
import { PROJECTS } from '../../data/nexusData.ts';
import {
  Folder,
  Search,
  Grid,
  List,
  ArrowUpDown,
  Home,
  HardDrive,
  Clock,
  ExternalLink,
  ChevronRight,
  Code,
  Layers,
  Sparkles,
  Globe,
  Cpu,
} from 'lucide-react';

interface LinuxFileManagerProps {
  onOpenProject: (project: Project) => void;
  projects?: Project[];
}

export const LinuxFileManager: React.FC<LinuxFileManagerProps> = ({ onOpenProject, projects }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'year' | 'category'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const projectSource = projects && projects.length > 0 ? projects : PROJECTS;

  // Filter and sort projects
  const filteredProjects = projectSource.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.disciplines.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }).sort((a, b) => {
    if (sortBy === 'name') return a.title.localeCompare(b.title);
    if (sortBy === 'year') return b.year.localeCompare(a.year);
    if (sortBy === 'category') return a.category.localeCompare(b.category);
    return 0;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#141414] text-[#F5EFE6] overflow-hidden select-none">
      {/* Top File Manager Navigation Bar */}
      <div className="h-10 px-4 bg-[#181818] border-b border-[rgba(245,239,230,0.10)] flex items-center justify-between gap-4 shrink-0 font-mono text-xs">
        {/* Breadcrumb Trail */}
        <div className="flex items-center gap-1.5 text-[#857E74] overflow-hidden truncate">
          <span className="flex items-center gap-1 text-[#F2613F]">
            <Home className="w-3.5 h-3.5" />
            <span>home</span>
          </span>
          <ChevronRight className="w-3 h-3 text-[#857E74]" />
          <span>nexus</span>
          <ChevronRight className="w-3 h-3 text-[#857E74]" />
          <span className="text-[#F5EFE6] font-bold">projects</span>
          <span className="text-[#857E74] text-[10px]">({filteredProjects.length} items)</span>
        </div>

        {/* Search & Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#857E74]" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-[#0C0C0C] border border-[rgba(245,239,230,0.14)] rounded-[2px] text-xs text-[#F5EFE6] focus:border-[#F2613F] outline-none w-36 sm:w-48 font-mono placeholder:text-[#857E74]"
            />
          </div>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#0C0C0C] border border-[rgba(245,239,230,0.14)] text-xs text-[#F5EFE6] px-2 py-1 rounded-[2px] outline-none cursor-pointer font-mono hidden sm:block"
          >
            <option value="name">Sort: Name</option>
            <option value="year">Sort: Year</option>
            <option value="category">Sort: Category</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#0C0C0C] border border-[rgba(245,239,230,0.14)] rounded-[2px] p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1 rounded-[1px] ${viewMode === 'grid' ? 'bg-[#F2613F] text-[#0C0C0C]' : 'text-[#857E74]'}`}
              title="Grid View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1 rounded-[1px] ${viewMode === 'list' ? 'bg-[#F2613F] text-[#0C0C0C]' : 'text-[#857E74]'}`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main File Explorer Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-44 bg-[#0C0C0C] border-r border-[rgba(245,239,230,0.10)] p-3 space-y-4 font-mono text-xs hidden sm:block shrink-0">
          <div className="space-y-1">
            <span className="text-[10px] text-[#857E74] uppercase tracking-wider font-bold block px-2">
              PLACES
            </span>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[2px] text-[#C2BBB0] hover:bg-[#181818]">
              <Home className="w-3.5 h-3.5 text-[#F2613F]" />
              <span>Home</span>
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[2px] bg-[#22201F] text-[#F5EFE6] font-bold border-l-2 border-[#F2613F]">
              <Folder className="w-3.5 h-3.5 text-[#F2613F]" />
              <span>Projects</span>
            </button>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[2px] text-[#C2BBB0] hover:bg-[#181818]">
              <Clock className="w-3.5 h-3.5 text-[#857E74]" />
              <span>Recent</span>
            </button>
          </div>

          <div className="space-y-1 pt-2 border-t border-[rgba(245,239,230,0.10)]">
            <span className="text-[10px] text-[#857E74] uppercase tracking-wider font-bold block px-2">
              STORAGE
            </span>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[2px] text-[#C2BBB0]">
              <HardDrive className="w-3.5 h-3.5 text-[#857E74]" />
              <span>NEXUS-VFS</span>
            </button>
          </div>
        </div>

        {/* Content View */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#141414]">
          {viewMode === 'grid' ? (
            /* GRID VIEW */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredProjects.map((p) => {
                const isSelected = selectedId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    onDoubleClick={() => onOpenProject(p)}
                    className={`p-3 rounded-[2px] border transition-all cursor-pointer flex flex-col items-center text-center group ${
                      isSelected
                        ? 'bg-[#22201F] border-[#F2613F] shadow-xs'
                        : 'bg-[#181818] border-[rgba(245,239,230,0.10)] hover:border-[rgba(245,239,230,0.20)] hover:bg-[#22201F]'
                    }`}
                  >
                    <Folder className={`w-10 h-10 mb-2 ${isSelected ? 'text-[#F2613F]' : 'text-[#C2BBB0] group-hover:text-[#F2613F]'}`} />
                    <span className="font-mono text-xs font-bold text-[#F5EFE6] truncate w-full">
                      {p.title.toLowerCase()}
                    </span>
                    <span className="font-mono text-[10px] text-[#857E74] truncate w-full mt-0.5">
                      {p.category}
                    </span>
                    <span className="font-mono text-[9px] text-[#F2613F] mt-1">
                      {p.year} // {p.status}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW */
            <div className="w-full font-mono text-xs">
              <div className="grid grid-cols-12 gap-2 pb-2 mb-2 border-b border-[rgba(245,239,230,0.10)] text-[10px] text-[#857E74] uppercase tracking-wider font-bold">
                <span className="col-span-5">Name</span>
                <span className="col-span-3">Category</span>
                <span className="col-span-2">Year</span>
                <span className="col-span-2 text-right">Status</span>
              </div>
              <div className="space-y-1">
                {filteredProjects.map((p) => {
                  const isSelected = selectedId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      onDoubleClick={() => onOpenProject(p)}
                      className={`grid grid-cols-12 gap-2 p-2 rounded-[2px] items-center cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#22201F] text-[#F5EFE6] font-bold border-l-2 border-[#F2613F]'
                          : 'hover:bg-[#181818] text-[#C2BBB0]'
                      }`}
                    >
                      <div className="col-span-5 flex items-center gap-2 truncate">
                        <Folder className="w-3.5 h-3.5 text-[#F2613F] shrink-0" />
                        <span className="truncate">{p.title.toLowerCase()}</span>
                      </div>
                      <span className="col-span-3 truncate text-[#857E74]">{p.category}</span>
                      <span className="col-span-2 text-[#857E74]">{p.year}</span>
                      <span className="col-span-2 text-right text-[#F2613F] text-[11px]">
                        {p.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
