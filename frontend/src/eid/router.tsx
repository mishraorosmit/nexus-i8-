import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { teamMembers, normalizeMemberJson } from './data/members';
import { fetchMemberByIdentifier, fetchAllMembers, EidError, isValidIdentifierFormat, isStrictUniqueIdFormat } from './data/api';
import { TeamMember } from './types';

export type RouteType = 'member' | 'not-found' | 'error';

export interface RouteState {
  type: RouteType;
  slug?: string;
  identifier?: string;
  member?: TeamMember;
  membersList: TeamMember[];
  isLoading: boolean;
  error?: EidError | null;
}

interface RouterContextValue {
  pathname: string;
  route: RouteState;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  customMember: TeamMember | null;
  setCustomMember: (member: TeamMember | null) => void;
  loadMemberFromJson: (jsonInput: unknown) => TeamMember;
  membersList: TeamMember[];
  retry: () => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

function getJsonFromUrl(): TeamMember | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const jsonStr = params.get('json') || params.get('data') || params.get('member');
    if (jsonStr) {
      const parsed = JSON.parse(jsonStr);
      return normalizeMemberJson(parsed);
    }
  } catch (err) {
    console.warn('Could not parse member JSON from URL:', err);
  }
  return null;
}

export interface ParsedRoute {
  identifier: string;
  slugPair?: string;
}

/**
 * Extracts target member identifier from URL pathname, query parameters, or hash.
 */
export function parseIdentifierFromUrl(
  pathname: string,
  search: string = '',
  hash: string = ''
): ParsedRoute {
  // 1. Check query parameter: ?id=NX-026 or ?uniqueId=NX-026
  if (search) {
    try {
      const params = new URLSearchParams(search);
      const queryId = params.get('id') || params.get('uniqueId') || params.get('memberId');
      if (queryId) {
        return { identifier: queryId.trim() };
      }
    } catch {}
  }

  // 2. Check hash route fallback: #/NX-026, #/memberID/orosmit-mishra/NX-026
  let path = pathname;
  if (hash && hash.startsWith('#/')) {
    path = hash.slice(1);
  }

  // Normalize path
  let clean = path.trim().split('?')[0].split('#')[0];
  if (!clean.startsWith('/')) {
    clean = '/' + clean;
  }
  clean = clean.replace(/\/+$/, '');

  // Root or /team -> Default to primary operative NX-001
  if (!clean || clean === '/' || clean === '/team' || clean === '/memberID') {
    return { identifier: 'NX-001', slugPair: 'jitesh-raj' };
  }

  // Canonical E-ID Route: /memberID/:slug/:uniqueId
  if (clean.startsWith('/memberID/')) {
    const segments = clean.slice('/memberID/'.length).split('/').filter(Boolean);
    if (segments.length >= 2) {
      if (isStrictUniqueIdFormat(segments[0]) && !isStrictUniqueIdFormat(segments[1])) {
        return { identifier: segments[0], slugPair: segments[1] };
      }
      return { slugPair: segments[0], identifier: segments[1] };
    }
    if (segments.length === 1) {
      return { identifier: segments[0] };
    }
  }

  // /team/:identifier
  if (clean.startsWith('/team/')) {
    const id = clean.slice('/team/'.length);
    if (id) {
      return { identifier: id };
    }
  }

  // General multi-segment route: /:slug/:id e.g. /orosmit-mishra/NX-026
  const segments = clean.slice(1).split('/').filter(Boolean);
  if (segments.length >= 2) {
    if (isStrictUniqueIdFormat(segments[0]) && !isStrictUniqueIdFormat(segments[1])) {
      return { identifier: segments[0], slugPair: segments[1] };
    }
    return { slugPair: segments[0], identifier: segments[1] };
  }

  // Root level single identifier (e.g. /NX-026, /NX-001, /orosmit-mishra)
  if (segments.length === 1) {
    return { identifier: segments[0] };
  }

  return { identifier: 'NX-001', slugPair: 'jitesh-raj' };
}

function getInitialPath(): string {
  const defaultPath = '/memberID/jitesh-raj/NX-001';
  if (typeof window === 'undefined') return defaultPath;
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    return window.location.hash.slice(1);
  }
  const curr = window.location.pathname;
  if (!curr || curr === '/' || curr === '/team' || curr === '/team/' || curr === '/memberID' || curr === '/memberID/') {
    return defaultPath;
  }
  return curr + (window.location.search || '');
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pathname, setPathname] = useState<string>(getInitialPath);
  const [customMember, setCustomMember] = useState<TeamMember | null>(null);
  const [membersList, setMembersList] = useState<TeamMember[]>(teamMembers);
  const [retryCount, setRetryCount] = useState<number>(0);

  const [route, setRoute] = useState<RouteState>(() => {
    const urlMember = getJsonFromUrl();
    if (urlMember) {
      return {
        type: 'member',
        slug: urlMember.slug,
        identifier: urlMember.id,
        member: urlMember,
        membersList: teamMembers,
        isLoading: false,
        error: null,
      };
    }
    return {
      type: 'member',
      membersList: teamMembers,
      isLoading: true,
      error: null,
    };
  });

  const requestIdRef = useRef<number>(0);

  // Synchronize browser history events
  useEffect(() => {
    const handlePopState = () => {
      let currentPath = window.location.pathname || '/memberID/jitesh-raj/NX-001';
      if (window.location.hash && window.location.hash.startsWith('#/')) {
        currentPath = window.location.hash.slice(1);
      }
      setPathname(currentPath + (window.location.search || ''));
      const urlMember = getJsonFromUrl();
      if (urlMember) {
        setCustomMember(urlMember);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // Fetch full directory list from backend on mount
  useEffect(() => {
    let isMounted = true;
    fetchAllMembers().then((list) => {
      if (isMounted && list.length > 0) {
        setMembersList(list);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Resolve active member dynamically when pathname or customMember changes
  useEffect(() => {
    // 1. If custom member was manually provided via JSON injection or drag-and-drop
    if (customMember) {
      setRoute({
        type: 'member',
        slug: customMember.slug,
        identifier: customMember.id,
        member: customMember,
        membersList,
        isLoading: false,
        error: null,
      });
      return;
    }

    // 2. If URL includes ?json=...
    const urlMember = getJsonFromUrl();
    if (urlMember) {
      setRoute({
        type: 'member',
        slug: urlMember.slug,
        identifier: urlMember.id,
        member: urlMember,
        membersList,
        isLoading: false,
        error: null,
      });
      return;
    }

    // 3. Extract identifier from current URL
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    let { identifier, slugPair } = parseIdentifierFromUrl(pathname, search, hash);

    // If identifier is an NX ID but slugPair was omitted (e.g. /NX-001 or /memberID/NX-001), auto-resolve known slug
    if (identifier && !slugPair && isStrictUniqueIdFormat(identifier)) {
      const match =
        membersList.find((m) => m.id.toLowerCase() === identifier.toLowerCase()) ||
        teamMembers.find((m) => m.id.toLowerCase() === identifier.toLowerCase());
      if (match) {
        slugPair = match.slug;
      }
    }

    // Enforce that unique ID must be provided and properly formatted
    if (!identifier || !isStrictUniqueIdFormat(identifier)) {
      setRoute({
        type: 'error',
        identifier: identifier || '',
        slug: slugPair,
        membersList,
        isLoading: false,
        error: {
          type: 'INVALID_ID',
          message: 'The permanent unique ID must conform to the required format (expected NX-XXX).',
          identifier: identifier || '',
        },
      });
      return;
    }

    // Set loading state
    const currentReqId = ++requestIdRef.current;
    setRoute((prev) => ({
      ...prev,
      type: 'member',
      identifier,
      slug: slugPair,
      membersList,
      isLoading: true,
      error: null,
    }));

    // Perform dynamic fetch from NEXUS Backend
    fetchMemberByIdentifier(identifier, slugPair).then((result) => {
      // Discard stale responses if user navigated elsewhere
      if (requestIdRef.current !== currentReqId) return;

      if (result.success && result.data) {
        // Auto-canonicalize URL to /memberID/:slug/:uniqueId if route was non-canonical
        const canonical = `/memberID/${result.data.slug}/${result.data.id}`;
        if (typeof window !== 'undefined' && window.location.pathname !== canonical && !window.location.hash) {
          window.history.replaceState({ fromApp: true }, '', canonical);
        }

        setRoute({
          type: 'member',
          slug: result.data.slug,
          identifier: result.data.id,
          member: result.data,
          membersList,
          isLoading: false,
          error: null,
        });
      } else {
        // If error is SLUG_MISMATCH, automatically canonicalize to official URL
        if (result.error?.type === 'SLUG_MISMATCH' && result.error.canonicalUrl) {
          if (typeof window !== 'undefined') {
            window.history.replaceState({ fromApp: true }, '', result.error.canonicalUrl);
            setPathname(result.error.canonicalUrl);
            return;
          }
        }

        setRoute({
          type: 'error',
          identifier,
          slug: slugPair,
          member: undefined,
          membersList,
          isLoading: false,
          error: result.error || {
            type: 'NOT_FOUND',
            message: 'Operative record not found in NEXUS registry.',
            identifier,
          },
        });
      }
    });
  }, [pathname, customMember, membersList, retryCount]);

  const navigate = useCallback((to: string, options?: { replace?: boolean }) => {
    let target = to;
    if (!target.startsWith('/') && !target.startsWith('#')) {
      target = '/' + target;
    }

    setCustomMember(null);

    if (options?.replace) {
      window.history.replaceState({ fromApp: true }, '', target);
    } else {
      window.history.pushState({ fromApp: true }, '', target);
    }

    setPathname(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loadMemberFromJson = useCallback((jsonInput: unknown): TeamMember => {
    const parsed = normalizeMemberJson(jsonInput);
    setCustomMember(parsed);
    return parsed;
  }, []);

  const retry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
  }, []);

  return (
    <RouterContext.Provider
      value={{
        pathname,
        route,
        navigate,
        customMember,
        setCustomMember,
        loadMemberFromJson,
        membersList,
        retry,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
};

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return ctx;
}

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  replace?: boolean;
}

export const Link: React.FC<LinkProps> = ({ to, replace, onClick, children, ...rest }) => {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      navigate(to, { replace });
    }
  };

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
};
