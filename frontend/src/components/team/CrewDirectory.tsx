/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, ArrowUpRight, Rows3, LayoutGrid } from 'lucide-react';
import { TeamMember } from '../../types.ts';
import { Container } from '../primitives/Container.tsx';
import { SectionLabel } from '../primitives/SectionLabel.tsx';
import { NexusIcon } from '../brand/NexusLogo.tsx';
import { SquadCardHover } from './SquadCardHover.tsx';
import { handleImageFallbackError } from '../../data/cloudinaryMap.ts';

interface CrewDirectoryProps {
  id?: string;
  members: TeamMember[];
  onSelectMember: (member: TeamMember) => void;
  sectionNumber?: string;
}

/**
 * CREW DIRECTORY (FULL CREW DATABASE)
 * 
 * Interactive feature:
 * - Hovering any member sharpens and highlights their card
 * - Surrounding members subtly reduce emphasis (focus effect)
 * - Click opens the member dossier
 * - Filterable only by real existing data categories + search query
 */
export const CrewDirectory: React.FC<CrewDirectoryProps> = ({
  id = 'crew-directory',
  members,
  onSelectMember,
  sectionNumber = '03',
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card-hover' | 'grid'>('card-hover');

  // Strictly use existing categories from dataset
  const categories = ['ALL', 'COORDINATOR & MENTOR', 'HEADS', 'MANAGEMENT', 'IDEATION', 'CONTENT'];

  const isLeadership = (m: TeamMember) =>
    m.group === 'COORDINATOR & MENTOR' ||
    m.group === 'HEADS' ||
    m.role.toUpperCase().includes('COORDINATOR') ||
    m.role.toUpperCase().includes('MENTOR') ||
    m.role.toUpperCase().includes('HEAD');

  const filteredMembers = members.filter((member) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      query === '' ||
      member.name.toLowerCase().includes(query) ||
      member.role.toLowerCase().includes(query) ||
      member.discipline.toLowerCase().includes(query);

    if (activeCategory === 'ALL') {
      if (query !== '') {
        return matchesQuery;
      }
      return !isLeadership(member);
    }

    if (activeCategory === 'COORDINATOR & MENTOR') {
      return (
        (member.group === 'COORDINATOR & MENTOR' ||
          member.role.toUpperCase().includes('COORDINATOR') ||
          member.role.toUpperCase().includes('MENTOR')) &&
        !member.role.toUpperCase().includes('HEAD') &&
        matchesQuery
      );
    }

    if (activeCategory === 'HEADS') {
      return (
        (member.group === 'HEADS' || member.role.toUpperCase().includes('HEAD')) &&
        matchesQuery
      );
    }

    return member.group === activeCategory && matchesQuery;
  });

  const isLeadershipCategory =
    activeCategory === 'COORDINATOR & MENTOR' || activeCategory === 'HEADS';
  const isSquadCategory =
    activeCategory === 'MANAGEMENT' ||
    activeCategory === 'IDEATION' ||
    activeCategory === 'CONTENT';

  const managementMembers = members.filter((m) => m.group === 'MANAGEMENT');
  const ideationMembers = members.filter((m) => m.group === 'IDEATION');
  const contentMembers = members.filter((m) => m.group === 'CONTENT');

  return (
    <section
      id={id}
      className="relative w-full py-8 sm:py-10 md:py-12 bg-[var(--bg-primary)] text-[var(--text-primary)]"
    >
      <Container>
        {/* Section Header: Restrained Editorial Typography */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 sm:pb-5 border-b border-[var(--border-subtle)]">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-3">
              <SectionLabel number={sectionNumber} label="DATABASE" />
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[var(--bg-surface)] text-[var(--text-primary)] text-[10px] font-dosis font-bold tracking-[0.2em] uppercase border border-[rgba(242,97,63,0.3)]">
                <NexusIcon size="xs" />
                <span>ACTIVE CREW</span>
              </span>
            </div>
            <h2 className="font-fraunces font-bold text-2xl sm:text-3xl md:text-4xl text-[var(--text-primary)] tracking-tight uppercase">
              CREW DIRECTORY
            </h2>
            <p className="font-bitter text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              Complete index of student researchers, software engineers, industrial designers, and editorial authors.
            </p>
          </div>

          {/* Member Count Indicator */}
          <div className="flex items-center gap-2 font-dosis text-xs tracking-[0.2em] text-[var(--text-muted)] uppercase self-start md:self-end">
            <span className="font-bold text-[var(--text-primary)] text-2xl font-fraunces">
              {filteredMembers.length}
            </span>
            <span>RECORDS</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="py-3 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--border-subtle)]">
          {/* Category Filters */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-dosis font-bold tracking-[0.16em] uppercase transition-all duration-200 border cursor-pointer ${
                    isActive
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[#F2613F]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-medium)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Search Input & View Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('card-hover')}
                title="Interactive expanding card hover ribbon"
                className={`px-2.5 py-1.5 text-[11px] font-dosis font-bold tracking-[0.14em] uppercase flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'card-hover'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[#F2613F]'
                    : 'text-[var(--text-muted)] hover:text-[#F2613F]'
                }`}
              >
                <Rows3 className="w-3.5 h-3.5" />
                <span>CARD HOVER</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Standard grid layout"
                className={`px-2.5 py-1.5 text-[11px] font-dosis font-bold tracking-[0.14em] uppercase flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[#F2613F]'
                    : 'text-[var(--text-muted)] hover:text-[#F2613F]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>GRID</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60 md:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="SEARCH CREW..."
                className="w-full bg-[var(--bg-subsurface)] border border-[var(--border-subtle)] px-3 py-1.5 pl-8 text-xs font-dosis font-bold tracking-[0.15em] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#F2613F] focus:bg-[var(--bg-surface)] transition-colors"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            </div>
          </div>
        </div>

        {/* Card Hover Ribbon Mode for Squads */}
        {viewMode === 'card-hover' && searchQuery.trim() === '' && !isLeadershipCategory ? (
          <div className="pt-4 sm:pt-5 space-y-6 sm:space-y-8">
            {isSquadCategory ? (
              <SquadCardHover
                members={filteredMembers}
                onSelectMember={onSelectMember}
                categoryName={activeCategory}
              />
            ) : (
              /* ALL Category: display each squad ribbon */
              <div className="space-y-6 sm:space-y-8">
                {managementMembers.length > 0 && (
                  <SquadCardHover
                    members={managementMembers}
                    onSelectMember={onSelectMember}
                    categoryName="MANAGEMENT"
                  />
                )}
                {ideationMembers.length > 0 && (
                  <SquadCardHover
                    members={ideationMembers}
                    onSelectMember={onSelectMember}
                    categoryName="IDEATION"
                  />
                )}
                {contentMembers.length > 0 && (
                  <SquadCardHover
                    members={contentMembers}
                    onSelectMember={onSelectMember}
                    categoryName="CONTENT"
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          /* Members Grid with Clean Portrait Photography and Spacious Layout */
          <div
            className={`pt-5 sm:pt-6 ${
              isLeadershipCategory
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 max-w-6xl lg:max-w-7xl mx-auto items-stretch'
                : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 items-stretch'
            }`}
            onMouseLeave={() => setHoveredMemberId(null)}
          >
          {filteredMembers.map((member) => {
            const isHovered = hoveredMemberId === member.id;
            const isAnyHovered = hoveredMemberId !== null;
            const isDimmed = isAnyHovered && !isHovered;
            const isLead = isLeadership(member);

            return (
              <div
                key={member.id}
                onMouseEnter={() => setHoveredMemberId(member.id)}
                onClick={() => onSelectMember(member)}
                className={`group relative bg-[var(--bg-surface)] ${
                  isLead ? 'border border-[var(--border-medium)] p-6 sm:p-7' : 'border border-[var(--border-subtle)] p-5 sm:p-6'
                } flex flex-col justify-between transition-[transform,opacity,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu cursor-pointer select-none ${
                  isHovered
                    ? 'border-[#F2613F] bg-[var(--bg-elevated)] shadow-xl -translate-y-1 z-10'
                    : isDimmed
                    ? 'opacity-40'
                    : 'hover:border-[var(--border-medium)]'
                }`}
                role="button"
                tabIndex={0}
                aria-label={`View dossier for ${member.name}, ${member.role}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectMember(member);
                  }
                }}
              >
                <div>
                  {/* Meta Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] text-[10px] font-dosis font-bold tracking-[0.2em] text-[var(--text-muted)] uppercase">
                    <span>{member.group}</span>
                  </div>

                  {/* Portrait Photography (Aspect 4/5) */}
                  <div className="relative w-full aspect-[4/5] my-4 bg-[var(--bg-subsurface)] overflow-hidden border border-[var(--border-subtle)] shadow-2xs">
                    {member.imageUrl ? (
                      <img
                        src={member.imageUrl}
                        alt={member.name}
                        className={`w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                          isHovered ? 'scale-[1.04]' : 'scale-100'
                        }`}
                        style={{ objectPosition: member.imagePosition || 'center 20%' }}
                        loading="lazy"
                        decoding="async"
                        onError={handleImageFallbackError}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)] bg-[var(--bg-subsurface)]">
                        <NexusIcon size="md" />
                        <span className="mt-2 font-dosis text-[10px] tracking-widest uppercase">
                          PORTRAIT
                        </span>
                      </div>
                    )}

                    {/* Corner Accent */}
                    <div
                      className={`absolute top-2 left-2 w-2.5 h-2.5 border-t-2 border-l-2 border-[#F2613F] transition-opacity duration-200 ${
                        isHovered ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                    <div
                      className={`absolute bottom-2 right-2 w-2.5 h-2.5 border-b-2 border-r-2 border-[#F2613F] transition-opacity duration-200 ${
                        isHovered ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  </div>

                  {/* Identity & Role */}
                  <div className="space-y-2 pt-1">
                    <div className="space-y-1">
                      <span className="text-[10px] font-dosis font-bold tracking-[0.22em] text-[#F2613F] uppercase block">
                        {member.role}
                      </span>
                      <h3
                        className={`font-fraunces font-bold ${
                          isLead ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'
                        } text-[var(--text-primary)] tracking-tight leading-tight`}
                      >
                        {member.name}
                      </h3>
                    </div>

                    {member.discipline && (
                      <p className="font-bitter text-xs sm:text-[13px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed pt-1">
                        {member.discipline}
                      </p>
                    )}

                    {isLead && member.bio && (
                      <p className="font-bitter text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3 pt-1">
                        {member.bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-4 mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] text-[10px] font-dosis font-bold tracking-[0.2em] text-[var(--text-primary)] group-hover:text-[#F2613F] transition-colors duration-200">
                  <span>{isLead ? 'EXPLORE DOSSIER' : 'VIEW PROFILE'}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
              </div>
            );
          })}
        </div>
        )}

        {filteredMembers.length === 0 && (
          <div className="text-center py-16 text-[var(--text-muted)] font-bitter text-sm">
            No crew records found matching your filter or search query.
          </div>
        )}
      </Container>
    </section>
  );
};
