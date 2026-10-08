/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Container } from '../components/primitives/Container.tsx';
import { SectionLabel } from '../components/primitives/SectionLabel.tsx';
import { PrimaryButton, SecondaryButton } from '../components/primitives/Button.tsx';
import { NexusIcon } from '../components/brand/NexusLogo.tsx';
import { RevealSection, RevealText } from '../components/motion/MotionPrimitives.tsx';
import { ColorBends } from '../components/motion/ColorBends.tsx';
import { AppRoute } from '../types.ts';
import { CheckCircle2, Clock, MapPin, Mail, ArrowRight } from 'lucide-react';

interface ContactPageProps {
  onRouteChange: (route: AppRoute) => void;
}

type ContactIntent = 'COLLABORATE WITH US' | 'ASK A QUESTION';

/**
 * CONTACT PAGE
 * Clear purpose:
 * - COLLABORATE WITH US
 * - ASK A QUESTION
 *
 * Includes:
 * - Simple form
 * - Meeting times / location
 * - What to expect after reaching out
 */
export const ContactPage: React.FC<ContactPageProps> = ({ onRouteChange }) => {
  const [intent, setIntent] = useState<ContactIntent>('COLLABORATE WITH US');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [majorOrAffiliation, setMajorOrAffiliation] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          intent,
          majorOrAffiliation,
          message,
        }),
      });

      const body = await res.json();
      if (!res.ok || body.error) {
        throw new Error(body.error?.message || 'Failed to submit message. Please try again.');
      }

      setReferenceId(body.data?.reference_id || null);
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main id="nexus-contact-page" className="w-full bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Header with Atmospheric ColorBends Shader Backdrop */}
      <RevealSection className="relative pt-20 md:pt-28 pb-16 md:pb-24 border-b border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-primary)]">
        {/* Generative ColorBends Interactive Background */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-screen dark:mix-blend-screen overflow-hidden">
          <ColorBends
            colors={['#F2613F', '#F26504', '#481E14', '#FF7A45', '#0C0C0C']}
            rotation={90}
            speed={0.2}
            scale={1}
            frequency={1}
            warpStrength={1}
            mouseInfluence={1}
            noise={0.15}
            parallax={0.5}
            iterations={1}
            intensity={1.5}
            bandWidth={6}
            transparent
            color="#F2613F"
          />
        </div>

        <Container className="relative z-10">
          <div className="max-w-4xl space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <SectionLabel number="05" label="GET IN TOUCH" />
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs font-dosis tracking-[0.2em] uppercase border border-[rgba(242,97,63,0.3)]">
                <NexusIcon size="xs" />
                <span>OPEN SESSIONS</span>
              </span>
            </div>
            <RevealText
              as="h1"
              staggerMs={40}
              className="font-fraunces font-bold text-4xl sm:text-5xl lg:text-6xl text-[var(--text-primary)] leading-[1.08] tracking-tight"
            >
              Reach out, collaborate, or connect.
            </RevealText>
            <p className="font-bitter text-lg text-[var(--text-secondary)] leading-relaxed max-w-3xl">
              Pitch a collaborative proposal, partner with our squads, or connect with our student collective — we would love to hear from you.
            </p>
          </div>
        </Container>
      </RevealSection>

      {/* Main Grid: Purpose Selection + Simple Form & Studio Details */}
      <section className="py-20 md:py-28 border-b border-[var(--border-subtle)]">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Left Column: Form & Purpose (7 cols) */}
            <div className="lg:col-span-7 space-y-8">
              {/* Purpose Selector */}
              <div className="space-y-3">
                <span className="font-dosis text-xs uppercase tracking-[0.2em] text-[var(--text-muted)] font-bold block">
                  SELECT PURPOSE:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['COLLABORATE WITH US', 'ASK A QUESTION'] as ContactIntent[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setIntent(p);
                        setSubmitted(false);
                      }}
                      className={`relative p-4 text-xs font-dosis font-bold tracking-[0.2em] uppercase transition-all duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] text-left rounded-[2px] cursor-pointer select-none group overflow-hidden ${
                        intent === p
                          ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[#F2613F] shadow-xs'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)] hover:text-[var(--text-primary)] hover:-translate-y-0.5 hover:shadow-xs'
                      } active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F2613F]`}
                    >
                      {/* Top-Right Corner Reticle on Hover */}
                      <span
                        className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#F2613F] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                        aria-hidden="true"
                      />
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] tracking-widest text-[#F2613F] flex items-center gap-1.5 font-bold">
                          <span className={`w-1.5 h-1.5 rounded-full ${intent === p ? 'bg-[#F2613F]' : 'border border-[#F2613F]'}`} />
                          {intent === p ? 'ACTIVE' : 'SELECT'}
                        </span>
                      </div>
                      <span className="transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 block">
                        {p}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Simple Form */}
              <div className="p-8 sm:p-10 bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs">
                {submitted ? (
                  <div className="py-10 text-center space-y-5">
                    <CheckCircle2 className="w-12 h-12 text-[#F2613F] mx-auto" />
                    <h3 className="font-fraunces text-2xl sm:text-3xl font-bold uppercase tracking-tight text-[var(--text-primary)]">
                      MESSAGE DISPATCHED
                    </h3>
                    {referenceId && (
                      <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--bg-elevated)] border border-[rgba(242,97,63,0.4)] text-xs font-mono">
                        <span className="text-[var(--text-muted)]">TRACKING REF:</span>
                        <span className="font-bold text-[#F2613F] tracking-wider">{referenceId}</span>
                      </div>
                    )}
                    <p className="font-bitter text-base max-w-md mx-auto text-[var(--text-muted)] leading-relaxed">
                      Thank you, <span className="font-bold text-[var(--text-primary)]">{fullName}</span>. Your note regarding <span className="font-dosis font-bold text-[#F2613F] tracking-[0.16em]">{intent}</span> has been received by student leads.
                    </p>
                    <div className="pt-4 flex flex-wrap justify-center gap-4">
                      <SecondaryButton
                        label="SEND ANOTHER MESSAGE"
                        onClick={() => {
                          setSubmitted(false);
                          setReferenceId(null);
                          setSubmitError(null);
                          setFullName('');
                          setEmail('');
                          setMajorOrAffiliation('');
                          setMessage('');
                        }}
                      />
                      <PrimaryButton
                        label="EXPLORE PROJECTS →"
                        onClick={() => onRouteChange('/projects')}
                      />
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="pb-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                      <h2 className="font-dosis text-sm font-bold uppercase tracking-[0.2em] text-[var(--text-primary)] flex items-center gap-2">
                        <NexusIcon size="xs" />
                        <span>{intent}</span>
                      </h2>
                      <span className="font-dosis text-xs text-[#F2613F] font-bold tracking-[0.18em]">
                        STUDENT DESK
                      </span>
                    </div>

                    {submitError && (
                      <div className="p-3 bg-red-950/30 border border-red-500/40 text-red-400 text-xs font-mono flex items-center gap-2">
                        <span>⚠</span>
                        <span>{submitError}</span>
                      </div>
                    )}

                    {/* Name */}
                    <div className="space-y-2">
                      <label
                        htmlFor="contact-fullName"
                        className="block font-dosis text-xs uppercase tracking-[0.2em] text-[var(--text-primary)] font-bold"
                      >
                        Your Name *
                      </label>
                      <input
                        id="contact-fullName"
                        type="text"
                        required
                        placeholder="Your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--bg-subsurface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm font-bitter focus:outline-none focus:border-[#F2613F] focus:bg-[var(--bg-surface)] transition-all duration-200"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <label
                        htmlFor="contact-email"
                        className="block font-dosis text-xs uppercase tracking-[0.2em] text-[var(--text-primary)] font-bold"
                      >
                        Email Address *
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        placeholder="your.email@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--bg-subsurface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm font-bitter focus:outline-none focus:border-[#F2613F] focus:bg-[var(--bg-surface)] transition-all duration-200"
                      />
                    </div>

                    {/* Major / Affiliation */}
                    <div className="space-y-2">
                      <label
                        htmlFor="contact-major"
                        className="block font-dosis text-xs uppercase tracking-[0.2em] text-[var(--text-primary)] font-bold"
                      >
                        {intent === 'COLLABORATE WITH US'
                          ? 'Department / Organization / Lab'
                          : 'Role / Major / Affiliation'}
                      </label>
                      <input
                        id="contact-major"
                        type="text"
                        placeholder="e.g. Electrical Engineering & Design, 2nd Year"
                        value={majorOrAffiliation}
                        onChange={(e) => setMajorOrAffiliation(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--bg-subsurface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm font-bitter focus:outline-none focus:border-[#F2613F] focus:bg-[var(--bg-surface)] transition-all duration-200"
                      />
                    </div>

                    {/* Message / Motivation */}
                    <div className="space-y-2">
                      <label
                        htmlFor="contact-message"
                        className="block font-dosis text-xs uppercase tracking-[0.2em] text-[var(--text-primary)] font-bold"
                      >
                        {intent === 'COLLABORATE WITH US'
                          ? 'Tell us about the project or collaboration idea'
                          : 'Your Question'}
                      </label>
                      <textarea
                        id="contact-message"
                        rows={4}
                        required
                        placeholder={
                          intent === 'COLLABORATE WITH US'
                            ? 'Outline the idea, event, or cross-discipline initiative you have in mind...'
                            : 'How can we help? Ask about meeting times, lab access, equipment, etc.'
                        }
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--bg-subsurface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] text-sm font-bitter focus:outline-none focus:border-[#F2613F] focus:bg-[var(--bg-surface)] transition-all duration-200 resize-none"
                      />
                    </div>

                    <div className="pt-2">
                      <PrimaryButton
                        type="submit"
                        disabled={isSubmitting}
                        label={isSubmitting ? 'TRANSMITTING...' : `SUBMIT ${intent}`}
                        className="w-full sm:w-auto"
                      />
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Right Column: Meeting Times, Location & What to Expect (5 cols) */}
            <div className="lg:col-span-5 space-y-8">
              {/* Meeting Times & Location Card */}
              <div className="p-8 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-6">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                  <SectionLabel number="05.1" label="STUDIO SCHEDULE" />
                  <NexusIcon size="xs" />
                </div>

                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 font-dosis text-xs uppercase font-bold text-[var(--text-primary)] tracking-[0.2em]">
                      <Clock className="w-4 h-4 text-[#F2613F]" />
                      <span>MEETING TIMES</span>
                    </div>
                    <div className="pl-6 space-y-1 text-sm font-bitter text-[var(--text-muted)]">
                      <p className="text-[var(--text-primary)] font-bold">
                        Thursdays: 6:00 PM – 9:00 PM
                      </p>
                      <p className="text-xs">Critiques, Lightning Talks & Team Matching</p>
                      <p className="text-[var(--text-primary)] font-bold pt-2">
                        Saturdays: 1:00 PM – 5:00 PM
                      </p>
                      <p className="text-xs">Open Build Sprint & Hardware Lab</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-4 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 font-dosis text-xs uppercase font-bold text-[var(--text-primary)] tracking-[0.2em]">
                      <MapPin className="w-4 h-4 text-[#F2613F]" />
                      <span>LOCATION</span>
                    </div>
                    <div className="pl-6 text-sm font-bitter text-[var(--text-muted)] space-y-1">
                      <p className="text-[var(--text-primary)] font-bold">Design & Technology Pavilion</p>
                      <p>Studio Lab 204 • North Campus</p>
                      <p className="text-xs text-[var(--text-muted)] pt-1 leading-relaxed">
                        Open access door — ring the NEXUS bell on the 2nd floor corridor.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-4 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 font-dosis text-xs uppercase font-bold text-[var(--text-primary)] tracking-[0.2em]">
                      <Mail className="w-4 h-4 text-[#F2613F]" />
                      <span>STUDENT INBOX</span>
                    </div>
                    <div className="pl-6 font-dosis text-sm font-bold tracking-[0.16em]">
                      <a
                        href="mailto:nexus@college.edu"
                        className="text-[#F2613F] hover:underline"
                      >
                        nexus@college.edu
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* What to Expect After Reaching Out */}
              <div className="p-8 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                  <span className="font-dosis text-xs uppercase tracking-[0.2em] text-[#F2613F] font-bold">
                    WHAT TO EXPECT
                  </span>
                  <span className="font-dosis text-xs tracking-[0.18em] text-[var(--text-muted)] font-semibold">NEXT STEPS</span>
                </div>

                <ol className="space-y-4 pt-2 font-bitter text-xs text-[var(--text-secondary)]">
                  <li className="flex items-start gap-3">
                    <span className="px-2 py-0.5 bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-dosis font-bold tracking-wider text-xs">01</span>
                    <p className="leading-relaxed">
                      <strong className="text-[var(--text-primary)] block font-bold mb-0.5 text-sm">Quick Review:</strong>
                      A student squad lead reads every message within 48 hours during term time.
                    </p>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="px-2 py-0.5 bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-dosis font-bold tracking-wider text-xs">02</span>
                    <p className="leading-relaxed">
                      <strong className="text-[var(--text-primary)] block font-bold mb-0.5 text-sm">Direct Response:</strong>
                      We’ll email you directly with details on current cohorts, squad matching, or answers to your inquiry.
                    </p>
                  </li>

                  <li className="flex items-start gap-3">
                    <span className="px-2 py-0.5 bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-dosis font-bold tracking-wider text-xs">03</span>
                    <p className="leading-relaxed">
                      <strong className="text-[var(--text-primary)] block font-bold mb-0.5 text-sm">Studio Invitation:</strong>
                      You’ll be invited to visit our next open studio session to meet team members in person and see active projects.
                    </p>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
};
