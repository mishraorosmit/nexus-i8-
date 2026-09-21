/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Container } from '../primitives/Container.tsx';
import { NexusLogo, NexusWordmark } from '../brand/NexusLogo.tsx';
import { InteractiveFooterPenguin } from '../mascot/InteractiveFooterPenguin.tsx';
import { AppRoute } from '../../types.ts';
import { useTheme } from '../../context/ThemeContext.tsx';
import { resolveImageUrl, handleImageFallbackError } from '../../data/cloudinaryMap.ts';

// Coding Ninjas logo paths resolve through Cloudinary CDN with local fallback.
const codingNinjasDarkLogo = resolveImageUrl('/images/logos/coding_ninjas_dark_clean.png');
const codingNinjasLightLogo = resolveImageUrl('/images/logos/coding_ninjas_light_clean.png');

interface FooterProps {
  onRouteChange: (route: AppRoute) => void;
}

/**
 * FOOTER
 * Minimal, clean footer containing:
 * - NEXUS COLLEGE COMMUNITY
 * - Navigation
 * - Socials
 * - University / Campus
 * - © 2026 NEXUS
 */
export const Footer: React.FC<FooterProps> = ({ onRouteChange }) => {
  const { isDark } = useTheme();

  const handleNavClick = (href: AppRoute, e: React.MouseEvent) => {
    e.preventDefault();
    onRouteChange(href);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      id="nexus-global-footer"
      className="w-full bg-[var(--bg-primary)] text-[var(--text-primary)] pt-16 md:pt-20 pb-12 border-t border-[var(--border-subtle)] transition-colors duration-250"
    >
      <Container>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 pb-14 border-b border-[var(--border-subtle)]">
          {/* 1. Logo & College Community */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1 space-y-4">
            <NexusLogo
              size="lg"
              showSubtitle={true}
              subtitleLayout="below"
              onClick={() => {
                onRouteChange('/');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
            <p className="font-bitter text-sm text-[var(--text-secondary)] max-w-xs pt-1 leading-relaxed">
              A student-led community for building, experimenting, and creating projects that matter.
            </p>
          </div>

          {/* 2. Navigation */}
          <div className="col-span-1 space-y-3">
            <h4 className="font-dosis text-xs uppercase tracking-[0.22em] text-[#F2613F] font-bold">
              NAVIGATION
            </h4>
            <ul className="space-y-2 text-xs font-dosis font-semibold tracking-[0.2em] uppercase text-[var(--text-secondary)]">
              <li>
                <a href="/" onClick={(e) => handleNavClick('/', e)} className="hover:text-[#F2613F] transition-colors">
                  HOME
                </a>
              </li>
              <li>
                <a href="/about" onClick={(e) => handleNavClick('/about', e)} className="hover:text-[#F2613F] transition-colors">
                  ABOUT
                </a>
              </li>
              <li>
                <a href="/projects" onClick={(e) => handleNavClick('/projects', e)} className="hover:text-[#F2613F] transition-colors">
                  PROJECTS
                </a>
              </li>
              <li>
                <a href="/gallery" onClick={(e) => handleNavClick('/gallery', e)} className="hover:text-[#F2613F] transition-colors">
                  GALLERY
                </a>
              </li>
              <li>
                <a href="/team" onClick={(e) => handleNavClick('/team', e)} className="hover:text-[#F2613F] transition-colors">
                  TEAM
                </a>
              </li>
              <li>
                <a href="/contact" onClick={(e) => handleNavClick('/contact', e)} className="hover:text-[#F2613F] transition-colors">
                  CONTACT
                </a>
              </li>
            </ul>
          </div>

          {/* 3. Socials */}
          <div className="col-span-1 space-y-3">
            <h4 className="font-dosis text-xs uppercase tracking-[0.22em] text-[#F2613F] font-bold">
              SOCIALS
            </h4>
            <ul className="space-y-2 text-xs font-dosis font-semibold tracking-[0.2em] uppercase text-[var(--text-secondary)]">
              <li>
                <a
                  href="https://github.com/nexushuborg"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#F2613F] transition-colors"
                >
                  GITHUB ↗
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/nexusfordev"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#F2613F] transition-colors"
                >
                  INSTAGRAM ↗
                </a>
              </li>
            </ul>
          </div>

          {/* 4. Coding Ninjas Affiliation (Rightmost Column) */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-1 space-y-3">
            <h4 className="font-dosis text-xs uppercase tracking-[0.22em] text-[#F2613F] font-bold">
              AFFILIATION
            </h4>
            <div className="pt-1">
              <img
                src={isDark ? codingNinjasDarkLogo : codingNinjasLightLogo}
                alt="Coding Ninjas - A 10x Club Initiative ITER Chapter"
                className="w-full max-w-[240px] sm:max-w-[260px] h-auto object-contain block select-none"
                loading="lazy"
                decoding="async"
                onError={handleImageFallbackError}
              />
            </div>
          </div>
        </div>

        {/* Minimal Copyright Line & Interactive Mascot */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-dosis tracking-[0.2em] uppercase text-[var(--text-muted)]">
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <span>© 2026</span>
            <NexusWordmark size="xs" />
          </div>

          {/* Clean Interactive Mascot — Draggable, physics-reactive, zero UI box/slop */}
          <div className="my-2 sm:my-0 flex items-center justify-center">
            <InteractiveFooterPenguin scale={2.6} />
          </div>
        </div>
      </Container>
    </footer>
  );
};
