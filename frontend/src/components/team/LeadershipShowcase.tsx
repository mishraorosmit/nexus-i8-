/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import { TeamMember } from '../../types.ts';
import { Container } from '../primitives/Container.tsx';
import { SectionLabel } from '../primitives/SectionLabel.tsx';
import { NexusIcon } from '../brand/NexusLogo.tsx';
import { handleImageFallbackError } from '../../data/cloudinaryMap.ts';

interface LeadershipShowcaseProps {
  id?: string;
  coordinators: TeamMember[];
  mentors: TeamMember[];
  onSelectMember: (member: TeamMember) => void;
}

/**
 * LEADERSHIP & ADVISORY SHOWCASE
 *
 * Displays Coordinators and Mentors in a clean, authoritative grid,
 * matching the architectural card grammar and interactive focus physics
 * of the NEXUS design system.
 */
export const LeadershipShowcase: React.FC<LeadershipShowcaseProps> = ({
  id = 'leadership-showcase',
  coordinators,
  mentors,
  onSelectMember,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Combine coordinators and mentors into one unified array
  const leadershipMembers: { member: TeamMember; badge: string; categoryLabel: string }[] = [
    ...coordinators.map((c) => ({
      member: c,
      badge: c.role.toUpperCase().includes('HEAD OF OPERATIONS')
        ? 'HEAD OF OPS'
        : c.role === 'COORDINATOR'
        ? 'COORDINATOR'
        : c.role,
      categoryLabel: 'STUDIO COORDINATOR',
    })),
    ...mentors.map((m) => ({
      member: m,
      badge: 'MENTOR',
      categoryLabel: 'STUDIO MENTOR',
    })),
  ];

  return (
    <section
      id={id}
      className="relative w-full py-8 sm:py-10 md:py-12 bg-[var(--bg-subsurface)] text-[var(--text-primary)] border-b border-[var(--border-subtle)]"
    >
      <Container>
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 sm:pb-5 border-b border-[var(--border-subtle)]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <SectionLabel number="01" label="LEADERSHIP &amp; ADVISORY" />
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[var(--bg-surface)] text-[var(--text-primary)] text-[10px] font-dosis font-bold tracking-[0.22em] uppercase border border-[rgba(242,97,63,0.3)]">
                <NexusIcon size="xs" />
                <span>DIRECTORS</span>
              </span>
            </div>
            <h2 className="font-fraunces font-bold text-2xl sm:text-3xl md:text-4xl text-[var(--text-primary)] tracking-tight uppercase">
              COORDINATOR &amp; MENTOR
            </h2>
            <p className="font-bitter text-xs sm:text-sm text-[var(--text-secondary)] max-w-xl leading-relaxed">
              Guiding studio operations, cross-disciplinary sprint roadmaps, engineering architecture, and squad mentorship.
            </p>
          </div>

          <div className="flex items-center gap-2 font-dosis text-xs font-bold tracking-[0.2em] text-[var(--text-muted)] uppercase self-start sm:self-end">
            <span className="font-fraunces text-2xl text-[var(--text-primary)] font-bold">
              {String(leadershipMembers.length).padStart(2, '0')}
            </span>
            <span>LEADERS</span>
          </div>
        </div>

        {/* Coordinators & Mentors Simple Grid */}
        <div
          className={`pt-6 sm:pt-8 grid grid-cols-1 ${
            leadershipMembers.length === 2
              ? 'md:grid-cols-2 max-w-4xl'
              : 'md:grid-cols-2 lg:grid-cols-3 max-w-6xl lg:max-w-7xl'
          } gap-5 sm:gap-6 mx-auto items-stretch`}
          onMouseLeave={() => setHoveredId(null)}
        >
          {leadershipMembers.map(({ member, badge, categoryLabel }) => {
            const isHovered = hoveredId === member.id;
            const isAnyHovered = hoveredId !== null;
            const isDimmed = isAnyHovered && !isHovered;

            return (
              <motion.div
                key={member.id}
                onMouseEnter={() => setHoveredId(member.id)}
                onClick={() => onSelectMember(member)}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={`group relative bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 sm:p-7 flex flex-col justify-between transition-[transform,opacity,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu cursor-pointer select-none shadow-sm ${
                  isHovered
                    ? 'border-[#F2613F] bg-[var(--bg-elevated)] shadow-xl -translate-y-1 z-10'
                    : isDimmed
                    ? 'opacity-40'
                    : 'hover:border-[var(--border-medium)]'
                }`}
                role="button"
                tabIndex={0}
                aria-label={`View dossier of ${member.name}, ${badge}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectMember(member);
                  }
                }}
              >
                <div>
                  {/* Top Meta Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] text-xs font-dosis font-bold tracking-[0.2em] uppercase">
                    <span className="text-[var(--text-muted)]">{categoryLabel}</span>
                    <span className="px-2 py-0.5 bg-[#F2613F] text-[#F5EFE6] text-[10px] tracking-[0.2em]">
                      {badge}
                    </span>
                  </div>

                  {/* Prominent Portrait */}
                  <div className="relative w-full aspect-[4/5] my-4 bg-[var(--bg-subsurface)] overflow-hidden border border-[var(--border-subtle)] shadow-xs">
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
                        <NexusIcon size="lg" />
                        <span className="mt-2 font-dosis text-xs tracking-widest uppercase">
                          PORTRAIT
                        </span>
                      </div>
                    )}

                    {/* Corner Architectural Pins */}
                    <div
                      className={`absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#F2613F] transition-opacity duration-200 ${
                        isHovered ? 'opacity-100' : 'opacity-80'
                      }`}
                    />
                    <div
                      className={`absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-[#F2613F] transition-opacity duration-200 ${
                        isHovered ? 'opacity-100' : 'opacity-80'
                      }`}
                    />
                  </div>

                  {/* Identity & Role Description */}
                  <div className="space-y-2.5 pt-1">
                    <div className="space-y-1">
                      <span className="text-xs font-dosis font-bold tracking-[0.24em] text-[#F2613F] uppercase block">
                        {member.role}
                      </span>
                      <h3 className="font-fraunces font-bold text-2xl sm:text-3xl text-[var(--text-primary)] tracking-tight leading-tight">
                        {member.name}
                      </h3>
                    </div>

                    {member.discipline && (
                      <p className="font-bitter text-sm sm:text-[15px] font-semibold text-[var(--text-primary)] leading-snug">
                        {member.discipline}
                      </p>
                    )}

                    {member.bio && (
                      <p className="font-bitter text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3 pt-1">
                        {member.bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-5 mt-5 flex items-center justify-between border-t border-[var(--border-subtle)] text-xs font-dosis font-bold tracking-[0.22em] text-[var(--text-primary)] group-hover:text-[#F2613F] transition-colors duration-200">
                  <span>EXPLORE DOSSIER</span>
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </Container>
    </section>
  );
};

