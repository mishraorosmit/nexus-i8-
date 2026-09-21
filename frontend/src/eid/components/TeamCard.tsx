import React, { useState } from 'react';
import { ShieldCheck, RotateCw, Share2 } from 'lucide-react';
import { TeamMember } from '../types';
import { QrCode } from './QrCode';
import { resolveImageUrl, handleImageFallbackError } from '../../data/cloudinaryMap.ts';

interface TeamCardProps {
  member: TeamMember;
  flipped?: boolean;
  onFlipToggle?: () => void;
  onShare?: () => void;
}

// EID card background images resolve through Cloudinary CDN with local fallback.
const CARD_FRONT_THEME = resolveImageUrl('/images/eid/nexus-card-theme.png');
const CARD_BACK_THEME = resolveImageUrl('/images/eid/nexus-card-back-theme.png');

export const TeamCard: React.FC<TeamCardProps> = ({
  member,
  flipped,
  onFlipToggle,
  onShare,
}) => {
  const [internalFlipped, setInternalFlipped] = useState(false);
  const isFlipped = flipped !== undefined ? flipped : internalFlipped;

  const [, idNumber] = member.id.includes('-') ? member.id.split('-') : ['NX', member.id];

  const handleCardClick = (e: React.MouseEvent) => {
    // If the click is on an action button or link, let that element handle it
    if ((e.target as HTMLElement).closest('button, a')) {
      return;
    }
    if (onFlipToggle) {
      onFlipToggle();
    } else {
      setInternalFlipped(prev => !prev);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (onFlipToggle) {
        onFlipToggle();
      } else {
        setInternalFlipped(prev => !prev);
      }
    }
  };

  return (
    <div
      id={`card-assembly-${member.id}`}
      role="region"
      aria-label={`ID Badge for ${member.name}. ${isFlipped ? 'Back side visible' : 'Front side visible'}. Press space or enter to flip.`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={handleCardClick}
      className="w-[330px] h-[524px] relative select-none rounded-2xl box-border perspective-1200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#FF5A1F]/50 focus:ring-offset-2 focus:ring-offset-[#0A0A0A] shrink-0"
    >
      {/* 3D Flippable Container */}
      <div
        className={`relative w-full h-full transform-style-3d card-flipper ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* =================================================================== */}
        {/* 1. FRONT SIDE OF ID BADGE                                          */}
        {/* =================================================================== */}
        <div
          id={`card-front-${member.id}`}
          className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden backface-hidden badge-shadow-resting group-hover:badge-shadow-hover transition-all duration-300 border border-black/20"
        >
          {/* Front Theme Background */}
          <img
            src={CARD_FRONT_THEME}
            alt=""
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none z-0"
            loading="eager"
            draggable={false}
            onError={handleImageFallbackError}
          />

          {/* Satin Polycarbonate Specular Surface Sheen */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.04] via-transparent to-white/[0.07] pointer-events-none z-10" />

          {/* Subtle Card Outer Bevel Ring */}
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20 pointer-events-none z-20" />

          {/* Top Slot Hole (Punched for Lanyard Ring attachment) */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <div className="w-8 h-2 rounded-full bg-[#181614] border border-black/30 shadow-inner flex items-center justify-center">
              <div className="w-6 h-0.5 rounded-full bg-black/95" />
            </div>
          </div>

          {/* Top Right Technical ID Tag */}
          <div className="absolute top-3.5 right-3.5 z-20 pointer-events-none">
            <div className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-xs border border-black/25 text-[7.5px] font-mono-tech text-[#F5F5F0] font-semibold flex items-center gap-1 shadow-xs">
              <span className="w-1 h-1 rounded-full bg-[#FF5A1F]" />
              <span>NX-{idNumber}</span>
            </div>
          </div>

          {/* Top Left Department Indicator & Status */}
          <div className="absolute top-3.5 left-3.5 z-20 pointer-events-none flex items-center gap-1.5">
            <div className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs border border-black/25 text-[7px] font-mono-tech text-[#DCDCD5] uppercase tracking-wider shadow-xs">
              {member.department}
            </div>
            {Boolean(((member as any).status || '').toUpperCase() === 'ALUMNI') && (
              <div className="px-1.5 py-0.5 rounded-md bg-indigo-950/80 backdrop-blur-xs border border-indigo-500/40 text-[6.5px] font-mono-tech text-indigo-300 uppercase tracking-widest font-bold shadow-xs">
                ALUMNI
              </div>
            )}
          </div>

          {/* ================= MIDDLE CONTENT SECTION ================= */}
          <div className="absolute top-[75px] left-0 right-0 z-20 flex flex-col items-center px-4">
            {/* Member Photo Portrait — Enlarged, Integrated Industrial Badging Frame */}
            <div className="relative w-[clamp(184px,60%,204px)] h-[clamp(184px,60%,204px)] aspect-square rounded-[22px] overflow-hidden border-2 border-[#1C1A17] bg-[#141412] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.38),0_4px_10px_rgba(0,0,0,0.18)] shrink-0 ring-1 ring-white/10">
              <img
                src={member.photo || member.image}
                alt={member.name}
                className="w-full h-full object-cover grayscale contrast-115 brightness-95 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                style={{ objectPosition: member.imagePosition || 'center 20%' }}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={handleImageFallbackError}
              />

              {/* Industrial crosshairs overlay */}
              <div className="absolute inset-0 pointer-events-none border border-white/[0.08]">
                <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-white/60" />
                <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-white/60" />
                <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-white/60" />
                <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-white/60" />
              </div>

              {/* Verification shield icon */}
              <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#0A0A0A]/85 backdrop-blur-xs border border-white/15 shadow-xs">
                <ShieldCheck className="w-3 h-3 text-[#FF5A1F]" />
              </div>
            </div>

            {/* Member Name & Core Pillar */}
            <div className="mt-3.5 text-center w-full px-3">
              <h3 className="font-display font-extrabold text-[20.5px] text-[#141412] tracking-tight leading-tight group-hover:text-black transition-colors">
                {member.name}
              </h3>

              {/* Discipline & Core Pillar */}
              {member.corePillar && (
                <div className="flex items-center justify-center gap-1.5 text-[8.5px] sm:text-[9px] font-mono-tech font-medium text-[#4A4A43] tracking-wider uppercase mt-1.5">
                  <span className="truncate max-w-[260px]">{member.corePillar}</span>
                </div>
              )}
            </div>
          </div>

          {/* ================= BOTTOM ORANGE SECTION ================= */}
          {/* Left side is preserved for the printed motto “We build. ship. deploy. Together.” 2025 - 29 */}
          {/* Right side houses Station, Barcode & NX Identification */}
          <div className="absolute top-[362px] right-4 z-20 flex flex-col items-end text-right">
            <div className="text-[7.5px] font-mono-tech text-[#FDEEE9]/75 tracking-wider uppercase">
              STATION // {member.nodeLocation}
            </div>

            {/* Precision Industrial Barcode */}
            <div className="flex items-center justify-end gap-0.5 opacity-90 mt-1">
              <div className="w-0.5 h-4 bg-[#FDEEE9]" />
              <div className="w-1.5 h-4 bg-[#FDEEE9]" />
              <div className="w-0.5 h-4 bg-transparent" />
              <div className="w-1 h-4 bg-[#FDEEE9]" />
              <div className="w-0.5 h-4 bg-[#FDEEE9]" />
              <div className="w-0.5 h-4 bg-transparent" />
              <div className="w-1.5 h-4 bg-[#FDEEE9]" />
              <div className="w-0.5 h-4 bg-[#FDEEE9]" />
              <div className="w-1 h-4 bg-[#FDEEE9]" />
            </div>
            <div className="text-[7px] font-mono-tech text-[#FDEEE9]/80 tracking-widest mt-0.5">
              NX-{idNumber}
            </div>
          </div>

          {/* Bottom Rail between the two dark divider lines of the theme */}
          <div className="absolute bottom-[24px] left-0 right-0 px-6 z-20 flex items-center justify-between text-[7.5px] font-mono-tech text-[#FDEEE9]/90 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-2.5 h-2.5 text-[#FDEEE9]" />
              <span>NEXUS ID SYSTEM</span>
            </div>

            <div className="flex items-center gap-2.5">
              {onShare && (
                <button
                  type="button"
                  id={`btn-card-share-${member.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare();
                  }}
                  className="flex items-center gap-1 text-[#FDEEE9]/90 hover:text-white transition-colors cursor-pointer touch-manipulation group/share"
                  title="Share digital badge link (Web Share API)"
                  aria-label="Share digital badge link"
                >
                  <Share2 className="w-2.5 h-2.5 text-[#FF5A1F] group-hover/share:scale-115 transition-transform" />
                  <span className="font-semibold">SHARE</span>
                </button>
              )}

              <div className="flex items-center gap-1 text-[#FDEEE9]/85">
                <RotateCw className="w-2.5 h-2.5 text-[#FF5A1F]" />
                <span>TAP TO FLIP</span>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. BACK SIDE OF ID BADGE                                           */}
        {/* =================================================================== */}
        <div
          id={`card-back-${member.id}`}
          className="absolute inset-0 w-full h-full rounded-2xl overflow-hidden backface-hidden rotate-y-180 badge-shadow-resting group-hover:badge-shadow-hover transition-all duration-300 border border-black/20"
        >
          {/* Back Theme Background (Exact match to uploaded art in id theme) */}
          <img
            src={CARD_BACK_THEME}
            alt=""
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none z-0"
            loading="lazy"
            draggable={false}
            onError={handleImageFallbackError}
          />

          {/* Satin Polycarbonate Specular Surface Sheen */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.04] via-transparent to-white/[0.07] pointer-events-none z-10" />

          {/* Subtle Card Outer Bevel Ring */}
          <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/20 pointer-events-none z-20" />

          {/* Top Slot Hole (Punched for Lanyard Ring attachment) */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <div className="w-8 h-2 rounded-full bg-[#181614] border border-black/30 shadow-inner flex items-center justify-center">
              <div className="w-6 h-0.5 rounded-full bg-black/95" />
            </div>
          </div>

          {/* Middle QR Code Box - Fitted precisely into the theme's designated cream space */}
          <div
            className="absolute flex items-center justify-center bg-[#F6D7B3] z-20 pointer-events-auto"
            style={{
              top: '33.31%',
              left: '25.25%',
              width: '49.45%',
              height: '33.34%',
            }}
          >
            <QrCode
              value={
                typeof window !== 'undefined' && window.location?.origin
                  ? `${window.location.origin}${member.qrUrl?.startsWith('/') ? member.qrUrl : `/${member.qrUrl || `memberID/${member.slug}/${member.id}`}`}`
                  : (member.qrUrl || `/memberID/${member.slug}/${member.id}`)
              }
              size={142}
              darkColor="#120D09"
              lightColor="#F6D7B3"
              margin={2}
            />
          </div>

          {/* Bottom Section: Kind Special Word (just one word) & Quote below the code */}
          <div
            className="absolute left-0 right-0 z-20 flex flex-col items-center justify-center text-center px-6 select-text pointer-events-auto"
            style={{
              top: '67%',
              bottom: '4%',
            }}
          >
            {/* Kind Special Word (One Word Only, no headings) */}
            <div className="font-mono-tech uppercase tracking-[0.28em] text-[13px] font-black text-[#1A0E08] drop-shadow-xs">
              {member.specialWord}
            </div>

            {/* Member Quote below the code with proper padding and spacing */}
            <p className="mt-2.5 text-[10.5px] leading-[1.6] text-[#221008] font-medium italic max-w-[270px] text-center">
              &ldquo;{member.quote || member.whyNexus || member.message}&rdquo;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
