/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { TeamMember } from '../../types.ts';
import { InlineNoise } from '../ui/card-hover.tsx';
import { ArrowUpRight } from 'lucide-react';
import { handleImageFallbackError } from '../../data/cloudinaryMap.ts';

interface SquadCardHoverProps {
  members: TeamMember[];
  onSelectMember: (member: TeamMember) => void;
  categoryName?: string;
  className?: string;
}

export const SquadCardHover: React.FC<SquadCardHoverProps> = ({
  members,
  onSelectMember,
  categoryName,
  className = '',
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number>(0);
  const hoverRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hoverRafRef.current) {
        cancelAnimationFrame(hoverRafRef.current);
      }
    };
  }, []);

  if (members.length === 0) {
    return null;
  }

  const count = members.length;

  const handleMouseEnter = (idx: number) => {
    if (idx === expandedIndex) return;
    if (hoverRafRef.current) {
      cancelAnimationFrame(hoverRafRef.current);
    }
    hoverRafRef.current = requestAnimationFrame(() => {
      setExpandedIndex(idx);
    });
  };

  const getImageWidth = (index: number) => {
    const isExpanded = index === expandedIndex;
    if (count <= 2) {
      return isExpanded ? '28rem' : '14rem';
    }
    if (count <= 4) {
      return isExpanded ? '24rem' : '8.5rem';
    }
    return isExpanded ? '22rem' : '5.5rem';
  };

  return (
    <div className={`w-full py-2 sm:py-3 ${className}`}>
      {categoryName && (
        <div className="mb-2.5 sm:mb-3 flex items-center justify-between">
          <span className="font-dosis font-bold text-xs tracking-[0.2em] text-[#F2613F] uppercase">
            {categoryName} SQUAD HOVER SHOWCASE
          </span>
          <span className="text-xs font-dosis font-medium text-[var(--text-muted)] tracking-[0.15em] uppercase">
            HOVER TO EXPAND • {count} SQUAD MEMBERS
          </span>
        </div>
      )}

      <div className="relative w-full overflow-x-auto pb-2.5 pt-1 no-scrollbar scroll-smooth overscroll-x-contain">
        <div className="flex items-center justify-start sm:justify-center gap-2 sm:gap-2.5 min-w-max mx-auto px-2">
          {members.map((member, idx) => {
            const isExpanded = idx === expandedIndex;

            return (
              <div
                key={member.id}
                onClick={() => onSelectMember(member)}
                onMouseEnter={() => handleMouseEnter(idx)}
                className={`relative shrink-0 cursor-pointer overflow-hidden rounded-[2px] transition-[width,transform,opacity,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu will-change-[width] border select-none ${
                  isExpanded
                    ? 'border-[#F2613F] bg-[var(--bg-surface)] z-10'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-subsurface)] hover:border-[var(--border-medium)] opacity-90 hover:opacity-100'
                }`}
                style={{
                  width: getImageWidth(idx),
                  height: '26rem',
                  contain: 'paint',
                }}
              >
                <InlineNoise className="rounded-[2px] h-full w-full bg-[var(--bg-surface)]" opacity={0.27}>
                  {member.imageUrl ? (
                    <img
                      className="w-full h-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      src={member.imageUrl}
                      alt={member.name}
                      loading="lazy"
                      decoding="async"
                      onError={handleImageFallbackError}
                      style={{
                        objectPosition: member.imagePosition || 'center 20%',
                        transform: isExpanded ? 'scale(1.04)' : 'scale(1)',
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-[var(--bg-surface)] flex items-center justify-center p-4 text-center font-dosis font-bold text-xs uppercase text-[var(--text-muted)]">
                      {member.name}
                    </div>
                  )}

                  {/* Top Metadata Badge */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
                    <span className="px-2.5 py-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[10px] font-dosis font-bold tracking-[0.2em] uppercase rounded-[2px]">
                      {member.group}
                    </span>
                  </div>

                  {/* Collapsed Vertical Identifier */}
                  {!isExpanded && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-3 pointer-events-none">
                      <span className="text-[11px] font-dosis font-bold tracking-[0.16em] text-[#F5EFE6] uppercase truncate text-center">
                        {member.name.split(' ')[0]}
                      </span>
                    </div>
                  )}

                  {/* Expanded Dossier Overlay */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col justify-end p-6 text-[#F5EFE6] transition-opacity duration-300 pointer-events-none ${
                      isExpanded ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-dosis font-bold tracking-[0.25em] text-[#F2613F] uppercase block">
                        {member.role}
                      </span>
                      <h4 className="font-fraunces font-bold text-2xl text-[#F5EFE6] tracking-tight uppercase leading-tight">
                        {member.name}
                      </h4>
                      {member.discipline && (
                        <p className="font-bitter text-xs text-[#C2BBB0] line-clamp-2 pt-1 leading-relaxed">
                          {member.discipline}
                        </p>
                      )}
                    </div>

                    <div className="pt-3.5 mt-2 flex items-center justify-between border-t border-white/15 text-[10px] font-dosis font-bold tracking-[0.2em] text-[#F2613F]">
                      <span>EXPLORE DOSSIER</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </InlineNoise>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
