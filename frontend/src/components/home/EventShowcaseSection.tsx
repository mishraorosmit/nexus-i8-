/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Container } from '../primitives/Container.tsx';
import { SectionLabel } from '../primitives/SectionLabel.tsx';
import { RevealSection, RevealText } from '../motion/MotionPrimitives.tsx';
import { Calendar, Clock, MapPin, Users, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';

export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string;
  eventType: string;
  date: string;
  time: string;
  eventStart: string | null;
  eventEnd: string | null;
  venue: string;
  location: string;
  registrationUrl: string | null;
  registrationEnabled: boolean;
  registrationOpen: boolean;
  capacity: number | null;
  capacityRemaining: number | null;
  isFull: boolean;
  coverImage: string | null;
  coverImageUrl: string | null;
  featured: boolean;
  status: string;
}

export const EventShowcaseSection: React.FC = () => {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModalEvent, setActiveModalEvent] = useState<PublicEvent | null>(null);

  // Modal Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events?limit=6');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        setEvents(json.data);
      }
    } catch {
      // Fallback gracefully without breaking page render
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const openRegistrationModal = (evt: PublicEvent) => {
    setActiveModalEvent(evt);
    setName('');
    setEmail('');
    setPhone('');
    setDepartment('');
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const closeRegistrationModal = () => {
    setActiveModalEvent(null);
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalEvent) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/events/${activeModalEvent.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          department: department.trim() || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          throw new Error('You are already registered for this event with this email.');
        }
        throw new Error(json?.error?.message || json?.message || 'Failed to complete registration.');
      }

      setSubmitSuccess(true);
      // Refresh event list to update capacity count dynamically
      fetchEvents();
    } catch (err: any) {
      setSubmitError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!loading && events.length === 0) {
    return null; // Cleanly omit section if no published events exist
  }

  return (
    <RevealSection
      id="nexus-events-showcase"
      className="w-full py-14 sm:py-18 md:py-22 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)] transition-colors duration-250"
    >
      <Container>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 mb-10 pb-4 sm:pb-5 border-b border-[var(--border-subtle)]">
          <div className="space-y-3">
            <SectionLabel number="05" label="GATHERINGS & SESSIONS" />
            <RevealText
              as="h2"
              staggerMs={45}
              className="font-fraunces font-bold text-4xl sm:text-5xl lg:text-6xl text-[var(--text-primary)] leading-[1.08] tracking-tight uppercase"
            >
              UPCOMING SESSIONS.
            </RevealText>
            <p className="font-bitter text-[var(--text-secondary)] max-w-xl text-sm sm:text-base leading-relaxed">
              Hands-on workshops, deep dives, and collaborative engineering sprints hosted by NEXUS.
            </p>
          </div>
        </div>

        {/* Event Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {events.map((evt) => {
            const displayImage = evt.coverImageUrl || evt.coverImage;
            const isFull = evt.isFull;
            const isOpen = evt.registrationOpen;

            return (
              <div
                key={evt.id}
                id={`event-card-${evt.id}`}
                className="group relative flex flex-col bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
              >
                {/* Event Image Banner */}
                <div className="relative w-full h-44 sm:h-48 bg-neutral-900 overflow-hidden">
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={evt.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-neutral-800 via-neutral-900 to-black flex items-center justify-center text-neutral-600 font-mono text-xs uppercase tracking-widest">
                      NEXUS / SESSION
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider bg-black/80 backdrop-blur-md text-amber-400 rounded border border-amber-500/30">
                      {evt.eventType || 'SESSION'}
                    </span>
                  </div>
                  {evt.featured && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-500 text-black rounded font-medium">
                        FEATURED
                      </span>
                    </div>
                  )}
                </div>

                {/* Event Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[var(--text-secondary)]">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                        {evt.date || 'TBD'}
                      </span>
                      {evt.time && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-neutral-400" />
                          {evt.time}
                        </span>
                      )}
                    </div>

                    <h3 className="font-fraunces font-bold text-xl text-[var(--text-primary)] group-hover:text-amber-500 transition-colors line-clamp-2">
                      {evt.title}
                    </h3>

                    <p className="font-bitter text-xs sm:text-sm text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
                      {evt.shortDescription || evt.description}
                    </p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between text-xs font-mono text-[var(--text-secondary)]">
                      <span className="flex items-center gap-1.5 truncate max-w-[65%]">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate">{evt.venue || evt.location}</span>
                      </span>

                      {typeof evt.capacity === 'number' && evt.capacity > 0 && (
                        <span className="flex items-center gap-1 shrink-0">
                          <Users className="w-3.5 h-3.5 text-neutral-400" />
                          {isFull ? (
                            <span className="text-red-400 font-semibold">Full</span>
                          ) : (
                            <span>{evt.capacityRemaining} left</span>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Registration Button */}
                    <div>
                      {isOpen ? (
                        <button
                          type="button"
                          id={`register-btn-${evt.id}`}
                          onClick={() => openRegistrationModal(evt)}
                          className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-black font-mono font-semibold text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                          Register for Session
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 px-4 bg-neutral-800/60 text-neutral-500 font-mono text-xs uppercase tracking-wider rounded cursor-not-allowed border border-neutral-800 text-center"
                        >
                          {isFull ? 'Capacity Reached' : 'Registration Closed'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Attendee Registration Modal */}
        {activeModalEvent && (
          <div
            id="public-registration-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          >
            <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-2xl overflow-hidden">
              <button
                type="button"
                onClick={closeRegistrationModal}
                className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>

              {submitSuccess ? (
                <div className="py-8 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="font-fraunces font-bold text-2xl text-white">Registration Confirmed</h3>
                  <p className="font-bitter text-sm text-neutral-300 max-w-sm mx-auto">
                    You have been secured a seat for <strong className="text-amber-400">{activeModalEvent.title}</strong>. We look forward to seeing you.
                  </p>
                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={closeRegistrationModal}
                      className="px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-mono text-xs uppercase tracking-wider rounded transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500 font-semibold">
                      {activeModalEvent.eventType} REGISTRATION
                    </span>
                    <h3 className="font-fraunces font-bold text-xl text-white mt-1">
                      {activeModalEvent.title}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-xs font-mono text-neutral-400 mt-2">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-amber-500" />
                        {activeModalEvent.date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                        {activeModalEvent.venue}
                      </span>
                    </div>
                  </div>

                  {submitError && (
                    <div className="p-3 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-xs font-mono text-neutral-300 mb-1">
                        Full Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        id="event-reg-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ada Lovelace"
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:border-amber-500 font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-neutral-300 mb-1">
                        Email Address <span className="text-red-400">*</span>
                      </label>
                      <input
                        id="event-reg-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ada@example.com"
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:border-amber-500 font-sans"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-mono text-neutral-300 mb-1">
                          Phone Number
                        </label>
                        <input
                          id="event-reg-phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:border-amber-500 font-sans"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-mono text-neutral-300 mb-1">
                          Dept / College
                        </label>
                        <input
                          id="event-reg-department"
                          type="text"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder="CSE / ITER"
                          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-sm text-white focus:outline-none focus:border-amber-500 font-sans"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={closeRegistrationModal}
                      className="px-4 py-2 border border-neutral-700 text-neutral-300 hover:bg-neutral-800 rounded font-mono text-xs uppercase tracking-wider transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      id="event-reg-submit"
                      disabled={submitting}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-mono font-semibold text-xs uppercase tracking-wider rounded transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {submitting ? 'Registering...' : 'Confirm Registration'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </Container>
    </RevealSection>
  );
};
