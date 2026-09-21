/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * TeamBackgroundAmbience
 *
 * Quiet, architectural background ambience for the Team Page:
 * - Subtle geometric blueprint grid with gentle radial falloff
 * - Zero heavy blur filters, zero infinite animation loops, zero distraction
 */
export const TeamBackgroundAmbience: React.FC = () => {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0"
      aria-hidden="true"
    >
      {/* Subtle Architectural Blueprint Grid with soft vignette */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--text-primary) 1px, transparent 1px),
            linear-gradient(to bottom, var(--text-primary) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 65% 55% at 50% 30%, black 20%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 65% 55% at 50% 30%, black 20%, transparent 80%)',
        }}
      />
    </div>
  );
};

