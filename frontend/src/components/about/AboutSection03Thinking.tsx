/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';

/**
 * 03 — HOW WE THINK
 * Four core principles presented purely through large typography, subtle rules, and negative space.
 * Features subtle scroll-driven parallax watermark and staggered appearance.
 */
export const AboutSection03Thinking: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const watermarkY = useTransform(scrollYProgress, [0, 1], [60, -60]);

  const principles = [
    {
      number: '01',
      name: 'CURIOSITY',
      tagline: 'Ask better questions.',
    },
    {
      number: '02',
      name: 'COLLABORATION',
      tagline: 'Find people who think differently.',
    },
    {
      number: '03',
      name: 'EXPERIMENTATION',
      tagline: 'Build before everything is figured out.',
    },
    {
      number: '04',
      name: 'CRAFT',
      tagline: 'Make it worth sharing.',
    },
  ];

  return (
    <section
      ref={sectionRef}
      id="about-thinking"
      aria-labelledby="about-thinking-title"
      className="w-full py-12 sm:py-16 md:py-20 border-b border-[var(--border-subtle)] relative overflow-hidden bg-[var(--bg-primary)] transition-colors duration-250"
    >
      {/* Subtle Scroll Parallax Watermark */}
      <motion.div
        style={shouldReduceMotion ? undefined : { y: watermarkY }}
        className="absolute -right-6 md:right-10 top-12 font-fraunces text-8xl sm:text-9xl md:text-[14rem] lg:text-[18rem] font-bold text-[var(--text-primary)]/[0.03] select-none pointer-events-none will-change-transform leading-none z-0"
        aria-hidden="true"
      >
        03
      </motion.div>

      <div className="w-full max-w-7xl mx-auto px-6 sm:px-10 md:px-14 lg:px-20 relative z-10">
        {/* Section Label */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 md:mb-12"
        >
          <span className="font-dosis uppercase text-xs md:text-sm tracking-[0.24em] text-[#F2613F] font-semibold">
            03 / HOW WE THINK
          </span>
          <h2 id="about-thinking-title" className="sr-only">
            How We Think — Core Principles
          </h2>
        </motion.div>

        {/* Typographic Matrix with Staggered Entrance */}
        <div className="space-y-0 divide-y divide-[var(--border-subtle)]">
          {principles.map((p, idx) => (
            <motion.div
              key={p.name}
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
              transition={{
                duration: 0.75,
                delay: idx * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="py-8 sm:py-10 md:py-12 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 lg:gap-12 relative items-center"
            >
              {/* Index marker */}
              <div className="md:col-span-2 relative flex items-center shrink-0">
                <span className="font-dosis font-bold text-base sm:text-lg md:text-xl tracking-[0.28em] text-[#F2613F] select-none">
                  {p.number}
                </span>
              </div>

              {/* Principle Name */}
              <div className="md:col-span-5 flex items-center">
                <h3 className="font-fraunces text-2xl sm:text-3xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-[var(--text-primary)]">
                  {p.name}
                </h3>
              </div>

              {/* Tagline / Statement */}
              <div className="md:col-span-5 flex items-center md:pl-8 lg:pl-12 xl:pl-16">
                <p className="font-bitter italic text-lg sm:text-xl md:text-xl lg:text-2xl text-[var(--text-secondary)] leading-snug">
                  {p.tagline}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AboutSection03Thinking;
