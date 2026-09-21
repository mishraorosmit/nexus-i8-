/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { TeamMember } from '../../types.ts';
import { Container } from '../primitives/Container.tsx';
import { SectionLabel } from '../primitives/SectionLabel.tsx';
import { NexusIcon } from '../brand/NexusLogo.tsx';
import ProfileCard from './ProfileCard.tsx';

interface LeadershipShowcaseProps {
  id?: string;
  coordinators: TeamMember[];
  mentors: TeamMember[];
  onSelectMember: (member: TeamMember) => void;
}

/**
 * LEADERSHIP & ADVISORY SHOWCASE
 *
 * Displays Coordinators and Mentors aligned together in the same row,
 * featuring high-performance 3D interactive ProfileCards with holographic foil,
 * ambient flame backglow, and quick dossier inspection.
 */
export const LeadershipShowcase: React.FC<LeadershipShowcaseProps> = ({
  id = 'leadership-showcase',
  coordinators,
  mentors,
  onSelectMember,
}) => {
  // Combine both into one unified array for consistent row rendering
  const leadershipMembers: { member: TeamMember; badge: string; categoryLabel: string }[] = [
    ...coordinators.map((c) => ({
      member: c,
      badge: c.role.toUpperCase().includes('HEAD OF OPERATIONS')
        ? 'HEAD OF OPS'
        : c.role === 'COORDINATOR'
        ? 'COORDINATOR'
        : c.role,
      categoryLabel: 'STUDIO LEADERSHIP',
    })),
    ...mentors.map((m) => ({
      member: m,
      badge: 'MENTOR',
      categoryLabel: 'ADVISORY & GUIDANCE',
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

        {/* Coordinators & Mentors in the Same Row (Grid aligned side-by-side with 3D ProfileCard) */}
        <div
          className={`pt-6 sm:pt-8 grid grid-cols-1 ${
            leadershipMembers.length >= 3
              ? 'md:grid-cols-3 max-w-6xl'
              : 'md:grid-cols-2 max-w-4xl'
          } gap-6 sm:gap-8 mx-auto items-stretch justify-items-center`}
        >
          {leadershipMembers.map(({ member, badge }) => {
            const isCoord = member.role.toUpperCase().includes('COORDINATOR');
            const displayTitle = isCoord
              ? 'Studio Coordinator'
              : member.role === 'MENTOR'
              ? 'Studio Mentor'
              : member.role;
            const handleName = member.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
            const statusText = isCoord ? 'Coordinator // Active' : 'Mentor // Advisory';

            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="w-full flex justify-center"
              >
                <ProfileCard
                  name={member.name}
                  title={displayTitle}
                  handle={handleName}
                  status={statusText}
                  badge={badge}
                  contactText="View Dossier"
                  avatarUrl={member.imageUrl || ''}
                  imagePosition={member.imagePosition || 'center 20%'}
                  showUserInfo={true}
                  enableTilt={true}
                  enableMobileTilt={false}
                  onContactClick={() => onSelectMember(member)}
                  onClick={() => onSelectMember(member)}
                  iconUrl="/assets/demo/iconpattern.png"
                  behindGlowEnabled={true}
                  behindGlowColor="rgba(242, 97, 63, 0.55)"
                  behindGlowSize="42%"
                  innerGradient="linear-gradient(145deg, rgba(242, 97, 63, 0.28) 0%, rgba(14, 15, 20, 0.95) 50%, rgba(242, 97, 63, 0.12) 100%)"
                />
              </motion.div>
            );
          })}
        </div>
      </Container>
    </section>
  );
};
