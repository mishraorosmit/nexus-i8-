import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  ChevronLeft,
  FileJson,
  Share2,
  Check,
  Loader2,
  AlertTriangle,
  Lock,
  Radio,
  FileWarning,
  RotateCcw,
} from 'lucide-react';
import { toBlob, toPng } from 'html-to-image';
import { TeamMember } from '../types';
import { teamMembers, getMemberBySlug, normalizeMemberJson, getMemberShareUrl } from '../data/members';
import { useRouter } from '../router';
import { HangingCard } from './HangingCard';
import { JsonInputModal } from './JsonInputModal';

export interface MemberProfilePageProps {
  /**
   * The matched team member object.
   */
  member?: TeamMember | null;
  /**
   * The route slug parameter from URL
   */
  memberSlug?: string;
  /**
   * Optional slug alias for backward compatibility
   */
  slug?: string;
}

/**
 * ============================================================================
 * ONE DEDICATED PAGE PER MEMBER: MemberProfilePage
 * ============================================================================
 * Pure, focused presentation of the member's physical ID Card.
 * The ID card is the only primary element on screen.
 * Supports direct tap/click to flip, keyboard (← / → / Space / F / S / J), touch swipe,
 * Web Share API sharing with high-res badge image generation (like Spotify cards),
 * and seamless JSON input/drag-and-drop to immediately render any person's card.
 */
export const MemberProfilePage: React.FC<MemberProfilePageProps> = ({
  member: initialMember,
  memberSlug,
  slug,
}) => {
  const { route, navigate, setCustomMember, retry, membersList } = useRouter();
  const [breezeTrigger] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSharingImage, setIsSharingImage] = useState(false);

  // Non-blocking touch swipe tracking for turning pages
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  // Strict member resolution: The card MUST ONLY appear if:
  // 1. There is NO route error.
  // 2. Both slug and uniqueId are provided and correspond to each other.
  const expectedSlug = (memberSlug || slug || route.slug || '').toLowerCase().trim();
  const expectedId = (route.identifier || '').toUpperCase().trim();
  const targetSlug = expectedSlug || expectedId;

  let resolvedMember: TeamMember | undefined = undefined;

  // Never resolve member if the route is in an error state
  if (route.type !== 'error' && !route.error) {
    if (initialMember) {
      resolvedMember = initialMember;
    } else if (route.member) {
      resolvedMember = route.member;
    }
  }

  // Strictly enforce that BOTH slug and unique ID must match the member record
  if (resolvedMember) {
    const memberSlugClean = (resolvedMember.slug || '').toLowerCase().trim();
    const memberIdClean = (resolvedMember.id || '').toUpperCase().trim();

    if (expectedSlug && memberSlugClean !== expectedSlug) {
      resolvedMember = undefined;
    }
    if (expectedId && memberIdClean !== expectedId) {
      resolvedMember = undefined;
    }
  }

  const member: TeamMember | undefined = resolvedMember;

  // Reset flip state when navigating between members
  useEffect(() => {
    setIsCardFlipped(false);
  }, [member?.id]);

  // Auto-dismiss toast feedback
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Dynamic responsive scale calculation so the ID card fits on mobile phones with shorter screens
  const [scale, setScale] = useState(1);
  const strapHeight = member?.positioning?.strapHeight ?? 70;

  useEffect(() => {
    const updateScale = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      const vw = window.visualViewport?.width || window.innerWidth;

      const effectiveStrap = vh < 640 ? Math.min(strapHeight, 36) : strapHeight;
      const totalAssemblyHeight = 524 + effectiveStrap + 32;
      const totalAssemblyWidth = 330;

      const paddingY = vh < 600 ? 12 : 24;
      const paddingX = 16;

      const availH = Math.max(160, vh - paddingY);
      const availW = Math.max(160, vw - paddingX);

      const scaleH = availH / totalAssemblyHeight;
      const scaleW = availW / totalAssemblyWidth;

      const computedScale = Math.min(1, scaleH, scaleW);
      setScale(computedScale);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateScale);
      window.visualViewport.addEventListener('scroll', updateScale);
    }

    return () => {
      window.removeEventListener('resize', updateScale);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateScale);
        window.visualViewport.removeEventListener('scroll', updateScale);
      }
    };
  }, [strapHeight]);

  const activeList = membersList && membersList.length > 0 ? membersList : teamMembers;
  const currentIndex = member
    ? activeList.findIndex((m) => m.id === member.id || m.slug === member.slug)
    : -1;

  // Dynamic document metadata update
  useEffect(() => {
    if (member) {
      document.title = `NEXUS E-ID — ${member.name} (${member.id})`;
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute(
          'content',
          `ID Card for ${member.name} (${member.id}) — ${member.designation} at NEXUS.`
        );
      }
    } else {
      document.title = 'NEXUS — Member Page Not Found';
    }

    return () => {
      document.title = 'NEXUS Team';
    };
  }, [member]);

  /**
   * Spotify-style Web Share API & Image Generator
   * Captures the current visible side of the physical ID badge with current operative data
   * and shares the high-res image file via Web Share API, with seamless download fallback.
   */
  const handleShare = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!member || isSharingImage) return;

    setIsSharingImage(true);
    setToastMessage('Preparing badge image...');

    const shareUrl = getMemberShareUrl(member);
    const sideName = isCardFlipped ? 'back' : 'front';
    const fileName = `nexus-badge-${member.slug || member.id}-${sideName}.png`;

    try {
      const targetEl =
        document.getElementById(isCardFlipped ? `card-back-${member.id}` : `card-front-${member.id}`) ||
        document.getElementById(`card-assembly-${member.id}`);

      let imageFile: File | null = null;
      let dataUrl: string | null = null;

      if (targetEl) {
        try {
          const blob = await toBlob(targetEl, {
            pixelRatio: 2.5,
            cacheBust: true,
            filter: (node) => !(node as HTMLElement)?.classList?.contains?.('group/share'),
          });

          if (blob) {
            imageFile = new File([blob], fileName, { type: 'image/png' });
          }
          dataUrl = await toPng(targetEl, {
            pixelRatio: 2.5,
            cacheBust: true,
            filter: (node) => !(node as HTMLElement)?.classList?.contains?.('group/share'),
          });
        } catch (captureErr) {
          console.warn('DOM to image capture failed, attempting link share:', captureErr);
        }
      }

      // 1. Try Native Web Share API with image file attachment
      if (imageFile && typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [imageFile] })) {
        try {
          await navigator.share({
            files: [imageFile],
            title: `NEXUS ID // ${member.name} (${member.id})`,
            text: `${member.name} // ${member.corePillar || 'Digital Identity Badge on NEXUS'}`,
            url: shareUrl,
          });
          setToastMessage('Badge shared successfully');
          setIsSharingImage(false);
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            setIsSharingImage(false);
            setToastMessage(null);
            return;
          }
        }
      }

      // 2. Try Native Web Share API without file (standard link/text share)
      const shareData = {
        title: `NEXUS ID // ${member.name} (${member.id})`,
        text: `${member.name} // ${member.corePillar || 'Digital Identity Badge on NEXUS'}`,
        url: shareUrl,
      };

      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData)) {
        try {
          await navigator.share(shareData);
          setToastMessage('Badge link shared');
          setIsSharingImage(false);
          return;
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            setIsSharingImage(false);
            setToastMessage(null);
            return;
          }
        }
      }

      // 3. Fallback for Desktop / browsers without Web Share: Download badge image + copy deep link
      if (dataUrl) {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setToastMessage(dataUrl ? 'Badge image saved & link copied' : 'Link copied to clipboard');
    } catch (err) {
      console.error('Failed to share badge:', err);
      setToastMessage('Ready to share');
    } finally {
      setIsSharingImage(false);
    }
  };

  // Keyboard navigation & JSON/Share hotkeys (Space / F / S / J / ← / →)
  useEffect(() => {
    if (!member) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }
      if (e.key === ' ' || e.key === 'f' || e.key === 'F' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setIsCardFlipped((prev) => !prev);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleShare();
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        setIsJsonModalOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [member]);

  // Drag-and-drop listener for .json files
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDraggingFile(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (e.clientX === 0 && e.clientY === 0) {
        setIsDraggingFile(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);
      const file = e.dataTransfer?.files[0];
      if (file && (file.name.endsWith('.json') || file.type.includes('json'))) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            const parsed = JSON.parse(content);
            const data = Array.isArray(parsed) ? parsed[0] : parsed;
            const normalized = normalizeMemberJson(data);
            setCustomMember(normalized);
          } catch (err) {
            console.error('Failed to parse dropped JSON file:', err);
          }
        };
        reader.readAsText(file);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [setCustomMember]);

  // Touch swipe handling strictly toggles card flip for the current member (prevents viewing other members)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length === 1 && member) {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);

      if (Math.abs(deltaX) > 50 && deltaY < 50) {
        setIsCardFlipped((prev) => !prev);
      }
    }
  };

  const effectiveStrap = typeof window !== 'undefined' && window.innerHeight < 640 ? Math.min(strapHeight, 36) : strapHeight;
  const unscaledAssemblyHeight = 524 + effectiveStrap + 32;

  // =========================================================================
  // 1. HIGH-FIDELITY INDUSTRIAL LOADING SKELETON
  // Matches exact card geometry (330px x 524px) & lanyard without generic spinner
  // =========================================================================
  if (route.isLoading && !member) {
    return (
      <div
        id="nexus-member-loading"
        className="w-full h-full max-w-lg mx-auto flex flex-col items-center justify-center box-border text-[#F5F5F0] overflow-hidden relative"
      >
        <div
          className="flex flex-col items-center justify-center transition-all duration-150 ease-out will-change-transform"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            height: `${unscaledAssemblyHeight * scale}px`,
            width: `${330 * scale}px`,
          }}
        >
          <div className="w-[330px] flex flex-col items-center shrink-0">
            {/* Ceiling Rail Simulation */}
            <div className="w-full max-w-[340px] h-1.5 bg-gradient-to-r from-transparent via-[#2a2a2a] to-transparent rounded-full mb-1 relative flex items-center justify-center shrink-0">
              <div className="w-14 h-1 bg-[#4a4a4a] rounded-full shadow-xs" />
            </div>

            {/* Simulated Lanyard Strap */}
            <div
              className="w-5 bg-gradient-to-b from-[#181818] via-[#222222] to-[#141414] border-x border-white/[0.06] shadow-md flex items-end justify-center relative shrink-0"
              style={{ height: `${effectiveStrap}px` }}
            >
              <div className="w-3.5 h-3.5 rounded-full border border-white/20 bg-[#0E0E0E] -mb-1.5 z-10" />
            </div>

            {/* Industrial Skeleton Card */}
            <div className="w-[330px] h-[524px] rounded-2xl bg-[#0D0D0D] border border-white/[0.08] relative overflow-hidden shadow-2xl flex flex-col items-center p-6 box-border shrink-0">
              {/* Card Outer Bevel Ring */}
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none" />

              {/* Top slot hole */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                <div className="w-8 h-2 rounded-full bg-[#181614] border border-black/30 shadow-inner flex items-center justify-center">
                  <div className="w-6 h-0.5 rounded-full bg-black/95" />
                </div>
              </div>

              {/* Top status tags */}
              <div className="w-full flex items-center justify-between mt-3">
                <div className="px-2 py-0.5 rounded-md bg-black/70 border border-white/10 text-[7px] font-mono-tech text-[#A0A096] uppercase tracking-wider animate-pulse">
                  AUTHENTICATING
                </div>
                <div className="px-2 py-0.5 rounded-md bg-black/80 border border-white/10 text-[7.5px] font-mono-tech text-[#F5F5F0] flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-[#FF5A1F] animate-ping" />
                  <span>NX // DOSSIER</span>
                </div>
              </div>

              {/* Photo skeleton box */}
              <div className="relative w-[122px] h-[122px] rounded-2xl border-2 border-[#1E1C1A] bg-[#141412] mt-6 flex items-center justify-center overflow-hidden shrink-0">
                <ShieldCheck className="w-8 h-8 text-[#FF5A1F]/30 animate-pulse" />
                <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 border-t border-l border-[#FF5A1F]/40" />
                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 border-t border-r border-[#FF5A1F]/40" />
                <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 border-b border-l border-[#FF5A1F]/40" />
                <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 border-b border-r border-[#FF5A1F]/40" />
              </div>

              {/* Text skeleton lines */}
              <div className="w-full flex flex-col items-center mt-5 space-y-2.5">
                <div className="h-5 w-44 rounded bg-white/[0.08] animate-pulse" />
                <div className="h-2.5 w-28 rounded bg-[#FF5A1F]/25 animate-pulse" />
                <div className="h-2 w-36 rounded bg-white/[0.05] animate-pulse" />
              </div>

              {/* Retrieval Status Shimmer Badge */}
              <div className="mt-8 px-3 py-1.5 rounded-full bg-[#141414] border border-[#FF5A1F]/30 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A1F] animate-ping" />
                <span className="text-[8.5px] font-mono-tech text-[#D4D4CC] tracking-[0.15em] uppercase">
                  RETRIEVING OPERATIVE DOSSIER...
                </span>
              </div>

              {/* Bottom technical barcode skeleton */}
              <div className="w-full mt-auto flex items-end justify-between pt-5 border-t border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[8px] font-mono-tech text-[#FF5A1F] tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A1F] animate-pulse" />
                  <span>NEXUS ID SYSTEM</span>
                </div>
                <div className="flex items-center gap-0.5 opacity-40">
                  <div className="w-0.5 h-3 bg-white" />
                  <div className="w-1.5 h-3 bg-white" />
                  <div className="w-0.5 h-3 bg-white" />
                  <div className="w-1 h-3 bg-white" />
                  <div className="w-0.5 h-3 bg-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. ERROR STATES (INVALID ID, NOT FOUND, INACTIVE, BACKEND UNAVAILABLE, MALFORMED)
  // Preserves existing tactile design language & ID geometry
  // =========================================================================
  if (!member) {
    const isMismatch =
      route.error?.type === 'SLUG_MISMATCH' ||
      (Boolean(expectedSlug) && Boolean(expectedId) && expectedSlug !== '' && expectedId !== '');
    const errorType = route.error?.type || (isMismatch ? 'SLUG_MISMATCH' : 'NOT_FOUND');
    const errorMessage = route.error?.message;

    let IconComponent = ShieldCheck;
    let badgeText = 'NEXUS ARCHIVE // PAGE NOT FOUND';
    let titleText = 'MEMBER NOT FOUND';
    let defaultDetail = 'The requested personnel identity does not exist in the NEXUS collective.';

    if (errorType === 'INVALID_ID') {
      IconComponent = AlertTriangle;
      badgeText = 'NEXUS SECURITY // FORMAT REJECTED';
      titleText = 'INVALID IDENTIFIER';
      defaultDetail = `The identifier "${route.identifier || targetSlug}" does not match the required NEXUS specification (expected format: NX-XXX).`;
    } else if (errorType === 'SLUG_MISMATCH') {
      IconComponent = AlertTriangle;
      badgeText = 'SECURITY // SLUG MISMATCH DETECTED';
      titleText = 'CREDENTIAL MISMATCH';
      defaultDetail = `The member slug "${expectedSlug}" does not correspond to permanent identifier "${expectedId}". Both must be correctly combined.`;
    } else if (errorType === 'INACTIVE') {
      IconComponent = Lock;
      badgeText = 'SECURITY // ACCESS SUSPENDED';
      titleText = 'CREDENTIAL REVOKED';
      defaultDetail = 'This operative credential has been deactivated or marked inactive in the registry.';
    } else if (errorType === 'NETWORK_ERROR') {
      IconComponent = Radio;
      badgeText = 'COMMUNICATION LINK // SEVERED';
      titleText = 'SERVICE UNAVAILABLE';
      defaultDetail = 'Unable to establish a secure link to the NEXUS core authentication service.';
    } else if (errorType === 'MALFORMED') {
      IconComponent = FileWarning;
      badgeText = 'CORRUPTED DOSSIER // PARSE FAULT';
      titleText = 'MALFORMED RECORD';
      defaultDetail = 'Member payload contains corrupted or incomplete identity parameters.';
    }

    return (
      <div
        id="nexus-member-not-found"
        className="w-full max-w-md mx-auto px-4 min-[390px]:px-6 py-16 text-center space-y-6 box-border"
      >
        <div className="w-14 h-14 rounded-xl bg-[#111111] border border-white/[0.08] flex items-center justify-center mx-auto text-[#FF5A1F] shadow-xs">
          <IconComponent className="w-7 h-7" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono-tech text-[#FF5A1F] tracking-[0.2em] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A1F] animate-pulse" />
            <span>{badgeText}</span>
          </div>

          <h1 className="font-display font-black text-2xl text-[#F5F5F0] tracking-tight">
            {titleText}
          </h1>

          <p className="text-xs text-[#8A8A82] max-w-xs mx-auto leading-relaxed">
            {errorMessage || defaultDetail}
            {targetSlug && (
              <span className="block mt-1.5 font-mono-tech text-[#D4D4CC] text-[11px] bg-[#121212] px-2 py-1 rounded border border-white/[0.06]">
                REQUESTED COMBINATION: "{expectedSlug || '?'}/{expectedId || '?'}"
              </span>
            )}
          </p>
        </div>

        <div className="pt-2 space-y-2">
          {errorType === 'SLUG_MISMATCH' && (route.error?.canonicalUrl || route.error?.correctSlug) && (
            <button
              id="btn-navigate-canonical"
              type="button"
              onClick={() => navigate(route.error?.canonicalUrl || `/${route.error?.correctSlug}/${expectedId}`)}
              className="w-full py-3.5 px-4 rounded-lg bg-[#FF5A1F] hover:bg-[#E04B14] active:bg-[#C84119] text-xs font-mono-tech text-black font-bold transition-colors min-h-[44px] touch-manipulation shadow-md flex items-center justify-center gap-2 cursor-pointer mb-2"
            >
              <span>NAVIGATE TO OFFICIAL DOSSIER ({expectedId})</span>
            </button>
          )}

          {errorType === 'NETWORK_ERROR' && (
            <button
              id="btn-retry-connection"
              type="button"
              onClick={retry}
              className="w-full py-3 px-4 rounded-lg bg-[#FF5A1F]/15 hover:bg-[#FF5A1F]/25 active:bg-[#FF5A1F]/30 border border-[#FF5A1F]/40 text-xs font-mono-tech text-[#FF5A1F] font-semibold transition-colors min-h-[44px] touch-manipulation shadow-xs flex items-center justify-center gap-2 cursor-pointer mb-2"
            >
              <RotateCcw className="w-4 h-4 text-[#FF5A1F]" />
              <span>RETRY SECURE CONNECTION</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. DYNAMIC OPERATIVE PHYSICAL HANGING ID BADGE (PRIMARY FOCUS)
  // =========================================================================
  return (
    <article
      id={`member-single-page-${member.slug || member.id}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-full h-full max-w-lg mx-auto flex flex-col items-center justify-center box-border text-[#F5F5F0] overflow-hidden relative"
    >
      {/* Toast Feedback (Spotify-style link copied notification) */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-5 z-50 px-4 py-2 rounded-full bg-[#141414]/95 border border-[#FF5A1F]/50 text-[#F5F5F0] font-mono-tech text-xs shadow-2xl flex items-center gap-2 backdrop-blur-md animate-bounce-short"
        >
          <Check className="w-3.5 h-3.5 text-[#FF5A1F]" />
          <span className="font-semibold text-[11px] tracking-wide uppercase">{toastMessage}</span>
        </div>
      )}

      {/* File Drag & Drop Indicator Overlay */}
      {isDraggingFile && (
        <div className="absolute inset-2 z-40 rounded-2xl border-2 border-dashed border-[#FF5A1F] bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 animate-pulse">
          <FileJson className="w-12 h-12 text-[#FF5A1F] mb-2" />
          <h3 className="font-mono-tech font-bold text-sm text-white uppercase tracking-wider">
            Drop JSON File Here
          </h3>
          <p className="text-[11px] font-mono-tech text-[#A0A096] mt-1">
            Instantly outputs the physical ID card for this person
          </p>
        </div>
      )}

      {/* Hanging Badge Assembly */}
      <section
        id="hanging-badge-section"
        aria-label={`Physical ID badge for ${member.name}`}
        className="relative flex flex-col items-center justify-center w-full h-full my-auto"
      >
        {/* Dynamic Scale Wrapper that ensures perfect fit on all mobile screens */}
        <div
          className="flex flex-col items-center justify-center transition-all duration-150 ease-out will-change-transform"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            height: `${unscaledAssemblyHeight * scale}px`,
            width: `${330 * scale}px`,
          }}
        >
          <div className="w-[330px] flex flex-col items-center shrink-0">
            {/* Ceiling Rail Simulation */}
            <div className="w-full max-w-[340px] h-1.5 bg-gradient-to-r from-transparent via-[#2a2a2a] to-transparent rounded-full mb-1 relative flex items-center justify-center shrink-0">
              <div className="w-14 h-1 bg-[#4a4a4a] rounded-full shadow-xs" />
            </div>

            {/* Hanging Assembly with ID Badge */}
            <div className="w-full flex justify-center shrink-0">
              <HangingCard
                member={member}
                index={currentIndex !== -1 ? currentIndex : 0}
                breezeTrigger={breezeTrigger}
                isFlipped={isCardFlipped}
                onFlipToggle={() => setIsCardFlipped((prev) => !prev)}
                onShare={handleShare}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Floating Share Action Pill Button */}
      <div className="fixed bottom-3 z-30 flex items-center justify-center pointer-events-auto">
        <button
          id="btn-share-badge-pill"
          type="button"
          disabled={isSharingImage}
          onClick={handleShare}
          className="group px-3.5 py-1.5 rounded-full bg-[#121212]/90 hover:bg-[#1C1C1C] active:bg-[#252525] disabled:opacity-60 border border-white/10 hover:border-[#FF5A1F]/50 text-xs font-mono-tech text-[#DCDCD5] hover:text-white transition-all duration-200 shadow-xl flex items-center gap-2 cursor-pointer backdrop-blur-md"
          title="Share Badge Image & Deep Link (Hotkey: S)"
          aria-label={`Share digital badge for ${member.name}`}
        >
          {isSharingImage ? (
            <Loader2 className="w-3.5 h-3.5 text-[#FF5A1F] animate-spin" />
          ) : (
            <Share2 className="w-3.5 h-3.5 text-[#FF5A1F] group-hover:scale-110 transition-transform duration-200" />
          )}
          <span className="font-lovelo font-bold tracking-wider text-[11px] uppercase pt-0.5">
            {isSharingImage ? 'GENERATING...' : 'SHARE BADGE'}
          </span>
        </button>
      </div>

      {/* JSON Input Modal (Accessible via drag & drop or 'J' hotkey) */}
      <JsonInputModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        currentMember={member}
        onApplyJson={(customMember) => {
          setCustomMember(customMember);
        }}
      />
    </article>
  );
};
