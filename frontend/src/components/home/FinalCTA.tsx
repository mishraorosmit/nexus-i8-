/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Container } from '../primitives/Container.tsx';
import { SectionLabel } from '../primitives/SectionLabel.tsx';
import { NexusIcon } from '../brand/NexusLogo.tsx';
import { RevealSection, RevealText } from '../motion/MotionPrimitives.tsx';
import { AppRoute } from '../../types.ts';

interface FinalCTAProps {
  onRouteChange: (route: AppRoute) => void;
}

/**
 * FINAL CALL TO ACTION (SECTION 06)
 * Heading: BUILD WHAT'S NEXT.
 * Subhead: If you want to make projects with people who care about craft, design, and code, NEXUS is where you start.
 * Crisp, tactile, and responsive buttons without forced reflow or mouse-following glow noise.
 */
export const FinalCTA: React.FC<FinalCTAProps> = ({ onRouteChange }) => {
  return (
    <RevealSection
      id="nexus-final-cta"
      className="relative w-full py-20 sm:py-24 md:py-28 bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden border-t border-[var(--border-subtle)] transition-colors duration-250"
    >
      {/* Background Subtle Geometric Atmosphere */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none select-none bg-[radial-gradient(var(--text-primary)_1px,transparent_1px)] [background-size:24px_24px]"
        aria-hidden="true"
      />

      {/* Background Watermark of Authentic X */}
      <div
        className="absolute -right-16 -bottom-16 opacity-10 pointer-events-none select-none"
        aria-hidden="true"
      >
        <NexusIcon size="custom" className="w-80 h-80 sm:w-96 sm:h-96" />
      </div>

      <Container>
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-7 sm:space-y-8">
          {/* Centered Brand Emblem */}
          <div className="flex justify-center">
            <div className="p-3 bg-[var(--bg-surface)] border border-[rgba(242,97,63,0.4)] shadow-xs inline-flex items-center justify-center transform transition-transform duration-300 hover:scale-105">
              <NexusIcon size="md" />
            </div>
          </div>

          <SectionLabel
            number="06"
            label="GET IN TOUCH"
            className="justify-center text-[var(--text-muted)]"
          />

          <RevealText
            as="h2"
            staggerMs={45}
            className="font-fraunces font-bold text-4xl sm:text-5xl lg:text-6xl text-[var(--text-primary)] tracking-tight uppercase"
          >
            BUILD WHAT'S NEXT.
          </RevealText>

          <p className="font-bitter text-base sm:text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
            If you want to make projects with people who care about craft, design, and code, NEXUS is where you start.
          </p>

          {/* High-Visibility, Tactile CTA Action Buttons */}
          <div className="pt-4 sm:pt-6 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            {/* Primary Action Button: GET IN TOUCH */}
            <button
              id="cta-btn-get-in-touch"
              type="button"
              onClick={() => onRouteChange('/contact')}
              className="relative w-full sm:w-auto inline-flex items-center justify-between gap-6 px-8 py-4 sm:px-9 sm:py-4.5 bg-[#F2613F] text-white font-dosis font-bold tracking-[0.22em] text-xs sm:text-[13px] uppercase rounded-[2px] border border-[#F2613F] shadow-xs transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:bg-[#FA7958] active:scale-[0.98] active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] cursor-pointer group select-none overflow-hidden"
              aria-label="GET IN TOUCH"
            >
              {/* Text & Icon Content */}
              <span className="relative z-10 text-white font-bold tracking-[0.22em] transition-transform duration-200 group-hover:translate-x-0.5">
                GET IN TOUCH
              </span>
              <span className="relative z-10 inline-flex items-center justify-center text-white transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5">
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </span>
            </button>

            {/* Secondary Action Button: EXPLORE PROJECTS */}
            <button
              id="cta-btn-explore-projects"
              type="button"
              onClick={() => onRouteChange('/projects')}
              className="relative w-full sm:w-auto inline-flex items-center justify-between gap-6 px-8 py-4 sm:px-9 sm:py-4.5 bg-[var(--bg-surface)] text-[var(--text-primary)] font-dosis font-bold tracking-[0.22em] text-xs sm:text-[13px] uppercase rounded-[2px] border border-[var(--border-strong)] shadow-xs transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-[#F2613F] hover:bg-[var(--bg-elevated)] active:scale-[0.98] active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F2613F] cursor-pointer group select-none overflow-hidden"
              aria-label="EXPLORE PROJECTS"
            >
              {/* Reactive Left Accent Bar */}
              <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#F2613F] transform scale-y-0 group-hover:scale-y-100 transition-transform duration-250 ease-out origin-top" aria-hidden="true" />

              {/* Text & Icon Content */}
              <span className="relative z-10 text-[var(--text-primary)] font-bold tracking-[0.22em] transition-transform duration-200 group-hover:translate-x-0.5">
                EXPLORE PROJECTS
              </span>
              <span className="relative z-10 inline-flex items-center justify-center text-[#F2613F] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5">
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </span>
            </button>
          </div>
        </div>
      </Container>
    </RevealSection>
  );
};


