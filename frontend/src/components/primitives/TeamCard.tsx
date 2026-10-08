/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { NexusIcon } from '../brand/NexusLogo.tsx';
import { TeamMember } from '../../types.ts';
import { handleImageFallbackError } from '../../data/cloudinaryMap.ts';

interface TeamCardProps {
  member: TeamMember;
  showBio?: boolean;
  showRole?: boolean;
  className?: string;
}

/**
 * TeamCard
 * Compact, interactive profile card designed with editorial balance.
 *
 * For Coordinator & Mentor:
 * - Subtle cursor-following ambient highlight
 * - Refined warm border and typography
 * - Photo switcher when alternate portrait is available
 *
 * For Squad Members:
 * - Clean, standard editorial card with crisp typography and subtle image zoom
 */
export const TeamCard: React.FC<TeamCardProps> = ({
  member,
  showBio = false,
  showRole,
  className = '',
}) => {
  const [imageError, setImageError] = React.useState(false);
  const [useAlternate, setUseAlternate] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [lightSpot, setLightSpot] = React.useState({ x: 50, y: 50 });

  const isCoordinatorOrMentor =
    member.group === 'COORDINATOR & MENTOR' ||
    member.role.toUpperCase().includes('COORDINATOR') ||
    member.role.toUpperCase().includes('MENTOR');

  const isStudentSquad =
    member.group === 'MANAGEMENT' ||
    member.group === 'IDEATION' ||
    member.group === 'CONTENT';

  const shouldShowRole = showRole !== undefined ? showRole : !isStudentSquad;

  const activeSrc =
    useAlternate && member.alternateImageUrl
      ? member.alternateImageUrl
      : member.imageUrl;

  const activePosition = useAlternate
    ? member.name === 'OM PANDEY'
      ? 'center 26%'
      : member.imagePosition || 'top center'
    : member.imagePosition || 'top center';

  React.useEffect(() => {
    setImageError(false);
  }, [activeSrc]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isCoordinatorOrMentor || e.pointerType !== 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, (y / rect.height) * 100));
    setLightSpot({ x: xPercent, y: yPercent });
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
    setLightSpot({ x: 50, y: 50 });
  };

  // ----------------------------------------------------
  // COORDINATOR & MENTOR: REFINED INTERACTIVE PROFILE CARD
  // ----------------------------------------------------
  if (isCoordinatorOrMentor) {
    return (
      <article
        tabIndex={0}
        role="region"
        aria-label={`Leadership Profile: ${member.name}, ${member.role}`}
        onPointerEnter={() => setIsHovered(true)}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          transform: isHovered ? 'translateY(-4px)' : 'translateY(0px)',
          transition: isHovered
            ? 'transform 0.12s ease-out, box-shadow 0.3s ease, border-color 0.3s ease'
            : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease, border-color 0.4s ease',
        }}
        className={`
          relative bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 sm:p-7
          flex flex-col justify-between group
          hover:border-[#F2613F] hover:bg-[var(--bg-elevated)] hover:shadow-lg
          active:scale-[0.98]
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F2613F] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]
          select-none overflow-hidden cursor-pointer
          ${className}
        `}
      >
        <div className="relative z-10 flex flex-col justify-between h-full">
          <div>
            {/* Portrait container with interactive hover zoom and subtle lighting */}
            <div className="relative aspect-square w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden transition-all duration-300 group-hover:border-[#F2613F]/60 shadow-xs">
              {activeSrc && !imageError ? (
                <div className="w-full h-full overflow-hidden bg-[var(--bg-secondary)] relative">
                  <img
                    src={activeSrc}
                    alt={`Portrait of ${member.name}`}
                    className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
                    style={{ objectPosition: activePosition }}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      if (e.currentTarget.dataset.fallbackTried === 'true') {
                        setImageError(true);
                      } else {
                        handleImageFallbackError(e);
                      }
                    }}
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)]/40 via-transparent to-transparent opacity-60 pointer-events-none transition-opacity group-hover:opacity-30"
                    aria-hidden="true"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                  <NexusIcon
                    size="lg"
                    className="mb-2 text-[#F2613F]/80 transition-transform duration-300 group-hover:scale-110"
                  />
                  <span className="font-dosis text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)] text-center font-semibold">
                    PORTRAIT // {member.name}
                  </span>
                </div>
              )}

              {/* Photo Switcher Button if alternate photo exists */}
              {member.alternateImageUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUseAlternate((prev) => !prev);
                  }}
                  title="Switch portrait photo"
                  aria-label="Toggle portrait photo"
                  className="absolute top-2.5 left-2.5 z-20 px-2.5 py-1 text-[9px] font-dosis font-bold tracking-widest uppercase bg-[var(--bg-primary)] hover:bg-[#F2613F] text-[var(--text-primary)] border border-[var(--border-strong)] rounded-xs transition-colors flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                >
                  <span>{useAlternate ? 'PORTRAIT 1' : 'PORTRAIT 2'}</span>
                </button>
              )}

              {/* Minimal framing corner accents */}
              <div className="absolute top-2 right-2 w-2.5 h-2.5 border-t border-r border-[var(--text-primary)]/30 pointer-events-none z-10 transition-colors group-hover:border-[#F2613F]" />
              <div className="absolute bottom-2 left-2 w-2.5 h-2.5 border-b border-l border-[var(--text-primary)]/30 pointer-events-none z-10 transition-colors group-hover:border-[#F2613F]" />
            </div>

            {/* Member Name */}
            <h3 className="font-bitter text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] mt-6 group-hover:text-[#F2613F] transition-colors duration-300">
              {member.name}
            </h3>

            {/* Role & Year */}
            <div className="mt-1 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-dosis text-xs font-bold text-[#F2613F] tracking-[0.22em] uppercase">
                  {member.role}
                </p>
                {member.yearOfStudy && (
                  <>
                    <span className="text-[var(--text-primary)]/30 text-xs">•</span>
                    <span className="font-mono text-[11px] text-[var(--text-secondary)] font-semibold">
                      {member.yearOfStudy}
                    </span>
                  </>
                )}
              </div>

              {/* Subtle accent line expands on hover */}
              <div
                className="w-0 h-[2px] bg-[#F2613F] mt-2 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-12"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </article>
    );
  }

  // ----------------------------------------------------
  // STANDARD CARD FOR ALL OTHER SQUAD MEMBERS
  // ----------------------------------------------------
  return (
    <article
      tabIndex={0}
      role="region"
      aria-label={`Profile: ${member.name}, ${member.role}`}
      className={`
        bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6
        flex flex-col justify-between group
        transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]
        hover:border-[#F2613F]/60 hover:bg-[var(--bg-elevated)] hover:shadow-2xs
        active:scale-[0.99]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F2613F] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]
        select-none
        ${className}
      `}
    >
      <div>
        {/* Portrait container (overflow-hidden, image scales 1 -> 1.03 on hover) */}
        <div className="relative aspect-square w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-[#F2613F]/40">
          {activeSrc && !imageError ? (
            <div className="w-full h-full overflow-hidden bg-[var(--bg-secondary)] relative">
              <img
                src={activeSrc}
                alt={`Portrait of ${member.name}`}
                className="w-full h-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
                style={{ objectPosition: activePosition }}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (e.currentTarget.dataset.fallbackTried === 'true') {
                    setImageError(true);
                  } else {
                    handleImageFallbackError(e);
                  }
                }}
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)]/40 via-transparent to-transparent opacity-60 pointer-events-none"
                aria-hidden="true"
              />
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]">
              {/* Background texture */}
              <div
                className="absolute inset-0 opacity-30 bg-[radial-gradient(var(--text-primary)_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none"
                aria-hidden="true"
              />
              <NexusIcon
                size="lg"
                className="mb-2 opacity-70 group-hover:opacity-100 transition-opacity transform group-hover:scale-105 duration-300"
              />
              <span className="font-dosis text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)] text-center font-semibold">
                PORTRAIT // {member.name}
              </span>
            </div>
          )}

          {/* Alternate Portrait Switcher if available */}
          {member.alternateImageUrl && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setUseAlternate((prev) => !prev);
              }}
              title="Switch portrait photo"
              aria-label="Toggle portrait photo"
              className="absolute top-2 left-2 z-20 px-2 py-0.5 text-[9px] font-dosis font-bold tracking-widest uppercase bg-[var(--bg-primary)] hover:bg-[#F2613F] text-[var(--text-primary)] border border-[var(--border-strong)] rounded-xs transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <span>{useAlternate ? 'PORTRAIT 1' : 'PORTRAIT 2'}</span>
            </button>
          )}

          {/* Framing corner accents */}
          <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-[var(--text-primary)]/30 pointer-events-none z-10" />
          <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-[var(--text-primary)]/30 pointer-events-none z-10" />
        </div>

        {/* Member Name */}
        <h3 className="font-bitter text-2xl font-bold uppercase tracking-tight text-[var(--text-primary)] mt-6 group-hover:text-[#F2613F] transition-colors duration-300">
          {member.name}
        </h3>

        {/* Role (becomes stronger on hover, only for groups with role display enabled) */}
        {shouldShowRole && member.role && (
          <div className="mt-1">
            <p className="font-dosis text-xs font-bold text-[var(--text-muted)] group-hover:text-[#F2613F] tracking-[0.2em] uppercase transition-all duration-300">
              {member.role}
            </p>
            {/* Small accent line appears */}
            <div
              className="w-0 h-[2px] bg-[#F2613F] mt-1.5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:w-8"
              aria-hidden="true"
            />
          </div>
        )}
      </div>
    </article>
  );
};
