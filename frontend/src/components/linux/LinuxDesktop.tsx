/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Project, AppRoute } from '../../types.ts';
import { PROJECTS } from '../../data/nexusData.ts';
import { LinuxWindowData, ContextMenuState, SortMode } from './types.ts';
import { LinuxTopBar } from './LinuxTopBar.tsx';
import { LinuxDock } from './LinuxDock.tsx';
import { LinuxFolderIcon } from './LinuxFolderIcon.tsx';
import { LinuxWindow } from './LinuxWindow.tsx';
import { LinuxProjectView } from './LinuxProjectView.tsx';
import { LinuxTerminal } from './LinuxTerminal.tsx';
import { LinuxFileManager } from './LinuxFileManager.tsx';
import { LinuxSystemInfo, LinuxPropertiesView } from './LinuxSystemInfo.tsx';
import { LinuxContextMenu } from './LinuxContextMenu.tsx';
import { LinuxBootSequence } from './LinuxBootSequence.tsx';
import { LinuxAltTabSwitcher } from './LinuxAltTabSwitcher.tsx';

interface LinuxDesktopProps {
  onRouteChange: (route: AppRoute) => void;
}

// Helper to map public project payload to desktop Project model
function mapPublicProject(p: any): Project {
  return {
    id: p.id || p.slug,
    projectNumber: p.projectNumber || `NXS / ${p.id?.slice(0, 4) || '000'}`,
    title: p.title,
    category: p.category || 'Technology',
    year: p.year || '2026',
    summary: p.summary || '',
    description: p.description || '',
    disciplines: p.disciplines || 'RESEARCH × SOFTWARE',
    status: p.status || 'Active',
    leadStudents: Array.isArray(p.members) && p.members.length > 0 
      ? p.members.map((m: any) => `${m.name}${m.role ? ` (${m.role})` : ''}`)
      : (p.leadStudents || []),
    tags: Array.isArray(p.technologies) ? p.technologies : (p.tags || []),
    deliverables: Array.isArray(p.deliverables) ? p.deliverables : [],
    githubUrl: p.repositoryUrl || p.githubUrl || undefined,
    demoUrl: p.liveUrl || p.demoUrl || undefined,
  };
}

export const LinuxDesktop: React.FC<LinuxDesktopProps> = ({ onRouteChange }) => {
  const [isBooting, setIsBooting] = useState(true);
  const [projectsList, setProjectsList] = useState<Project[]>(PROJECTS);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [windows, setWindows] = useState<LinuxWindowData[]>([]);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [highestZIndex, setHighestZIndex] = useState(10);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    targetType: 'desktop',
  });

  // Fetch live published projects from backend API
  useEffect(() => {
    let isMounted = true;
    fetch('/api/projects?limit=50')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!isMounted) return;
        if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
          setProjectsList(json.data.map(mapPublicProject));
        }
      })
      .catch(() => {
        // Fallback to static PROJECTS
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Alt+Tab state
  const [altTabOpen, setAltTabOpen] = useState(false);
  const [altTabIndex, setAltTabIndex] = useState(0);

  // Focus Window Helper
  const focusWindow = useCallback(
    (id: string) => {
      setActiveWindowId(id);
      setWindows((prev) =>
        prev.map((win) => {
          if (win.id === id) {
            const nextZ = highestZIndex + 1;
            setHighestZIndex(nextZ);
            return { ...win, zIndex: nextZ, isMinimized: false };
          }
          return win;
        })
      );
    },
    [highestZIndex]
  );

  // Open Project Window
  const openProjectWindow = useCallback(
    (project: Project) => {
      const windowId = `win-project-${project.id}`;
      const existing = windows.find((w) => w.id === windowId);

      if (existing) {
        focusWindow(windowId);
        return;
      }

      // Compute initial responsive position
      const isMobile = window.innerWidth < 768;
      const width = isMobile ? window.innerWidth - 20 : Math.min(840, window.innerWidth - 80);
      const height = isMobile ? window.innerHeight - 100 : Math.min(620, window.innerHeight - 120);
      const x = isMobile ? 10 : Math.max(30, 80 + (windows.length % 5) * 28);
      const y = isMobile ? 40 : Math.max(50, 60 + (windows.length % 5) * 28);

      const nextZ = highestZIndex + 1;
      setHighestZIndex(nextZ);

      const newWindow: LinuxWindowData = {
        id: windowId,
        type: 'project',
        title: project.title,
        project,
        filePath: `/home/nexus/projects/${project.title.toLowerCase()}`,
        x,
        y,
        width,
        height,
        zIndex: nextZ,
        isMinimized: false,
        isMaximized: false,
      };

      setWindows((prev) => [...prev, newWindow]);
      setActiveWindowId(windowId);
    },
    [windows, highestZIndex, focusWindow]
  );

  // Open Terminal Window
  const openTerminal = useCallback(() => {
    const windowId = 'win-terminal';
    const existing = windows.find((w) => w.id === windowId);

    if (existing) {
      focusWindow(windowId);
      return;
    }

    const isMobile = window.innerWidth < 768;
    const width = isMobile ? window.innerWidth - 20 : 640;
    const height = isMobile ? window.innerHeight - 100 : 420;
    const x = isMobile ? 10 : Math.max(40, window.innerWidth / 2 - 320);
    const y = isMobile ? 40 : Math.max(60, window.innerHeight / 2 - 210);

    const nextZ = highestZIndex + 1;
    setHighestZIndex(nextZ);

    const newWindow: LinuxWindowData = {
      id: windowId,
      type: 'terminal',
      title: 'NEXUS Terminal',
      x,
      y,
      width,
      height,
      zIndex: nextZ,
      isMinimized: false,
      isMaximized: false,
    };

    setWindows((prev) => [...prev, newWindow]);
    setActiveWindowId(windowId);
  }, [windows, highestZIndex, focusWindow]);

  // Open File Manager Window
  const openFileManager = useCallback(() => {
    const windowId = 'win-file-manager';
    const existing = windows.find((w) => w.id === windowId);

    if (existing) {
      focusWindow(windowId);
      return;
    }

    const isMobile = window.innerWidth < 768;
    const width = isMobile ? window.innerWidth - 20 : 760;
    const height = isMobile ? window.innerHeight - 100 : 500;
    const x = isMobile ? 10 : 100;
    const y = isMobile ? 40 : 80;

    const nextZ = highestZIndex + 1;
    setHighestZIndex(nextZ);

    const newWindow: LinuxWindowData = {
      id: windowId,
      type: 'file-manager',
      title: 'NEXUS Files',
      filePath: '/home/nexus/projects',
      x,
      y,
      width,
      height,
      zIndex: nextZ,
      isMinimized: false,
      isMaximized: false,
    };

    setWindows((prev) => [...prev, newWindow]);
    setActiveWindowId(windowId);
  }, [windows, highestZIndex, focusWindow]);

  // Open System Info
  const openSystemInfo = useCallback(() => {
    const windowId = 'win-system-info';
    const existing = windows.find((w) => w.id === windowId);

    if (existing) {
      focusWindow(windowId);
      return;
    }

    const width = 580;
    const height = 480;
    const x = Math.max(20, window.innerWidth / 2 - width / 2);
    const y = Math.max(50, window.innerHeight / 2 - height / 2);

    const nextZ = highestZIndex + 1;
    setHighestZIndex(nextZ);

    const newWindow: LinuxWindowData = {
      id: windowId,
      type: 'system-info',
      title: 'About NEXUS OS',
      x,
      y,
      width,
      height,
      zIndex: nextZ,
      isMinimized: false,
      isMaximized: false,
    };

    setWindows((prev) => [...prev, newWindow]);
    setActiveWindowId(windowId);
  }, [windows, highestZIndex, focusWindow]);

  // Open Properties Window
  const openProperties = useCallback(
    (project: Project) => {
      const windowId = `win-properties-${project.id}`;
      const existing = windows.find((w) => w.id === windowId);

      if (existing) {
        focusWindow(windowId);
        return;
      }

      const width = 460;
      const height = 400;
      const x = Math.max(30, window.innerWidth / 2 - width / 2);
      const y = Math.max(60, window.innerHeight / 2 - height / 2);

      const nextZ = highestZIndex + 1;
      setHighestZIndex(nextZ);

      const newWindow: LinuxWindowData = {
        id: windowId,
        type: 'properties',
        title: `${project.title} — Properties`,
        project,
        x,
        y,
        width,
        height,
        zIndex: nextZ,
        isMinimized: false,
        isMaximized: false,
      };

      setWindows((prev) => [...prev, newWindow]);
      setActiveWindowId(windowId);
    },
    [windows, highestZIndex, focusWindow]
  );

  // Close Window
  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    setActiveWindowId((prevActive) => (prevActive === id ? null : prevActive));
  }, []);

  // Minimize Window
  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w))
    );
    setActiveWindowId((prevActive) => (prevActive === id ? null : prevActive));
  }, []);

  // Maximize / Restore Window
  const maximizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMaximized: !w.isMaximized } : w))
    );
  }, []);

  // Move Window
  const moveWindow = useCallback((id: string, x: number, y: number) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, x, y } : w))
    );
  }, []);

  // Sort Projects
  const handleSort = useCallback((mode: SortMode) => {
    setProjectsList((prev) => {
      const copy = [...prev];
      if (mode === 'name') return copy.sort((a, b) => a.title.localeCompare(b.title));
      if (mode === 'year') return copy.sort((a, b) => b.year.localeCompare(a.year));
      if (mode === 'category') return copy.sort((a, b) => a.category.localeCompare(b.category));
      return copy;
    });
  }, []);

  // Refresh Desktop
  const handleRefresh = useCallback(() => {
    fetch('/api/projects?limit=50')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
          setProjectsList(json.data.map(mapPublicProject));
        } else {
          setProjectsList([...PROJECTS]);
        }
      })
      .catch(() => {
        setProjectsList([...PROJECTS]);
      });
    setSelectedFolderId(null);
  }, []);

  // Keyboard Shortcuts (Ctrl+Alt+T, Alt+Tab, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open Terminal: Ctrl+Alt+T
      if (e.ctrlKey && e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        openTerminal();
      }

      // Close context menu: Escape
      if (e.key === 'Escape') {
        setContextMenu((prev) => ({ ...prev, isOpen: false }));
        setAltTabOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openTerminal]);

  // Intercept right-click context menu exclusively on Linux Desktop
  const handleDesktopContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      targetType: 'desktop',
    });
  };

  const handleFolderContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFolderId(project.id);
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      targetType: 'project-folder',
      targetProject: project,
    });
  };

  const handleDesktopClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).id === 'linux-desktop-canvas') {
      setSelectedFolderId(null);
      setContextMenu((prev) => ({ ...prev, isOpen: false }));
    }
  };

  // Active window title for top bar
  const activeWin = windows.find((w) => w.id === activeWindowId && !w.isMinimized);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#0C0C0C] text-[#F5EFE6] overflow-hidden select-none flex flex-col font-sans z-30">
      {/* Boot sequence overlay */}
      {isBooting && <LinuxBootSequence onComplete={() => setIsBooting(false)} />}

      {/* Top System Bar */}
      <LinuxTopBar
        activeWindowTitle={activeWin?.title}
        onRouteChange={onRouteChange}
        onOpenTerminal={openTerminal}
        onOpenFileManager={openFileManager}
        onOpenSystemInfo={openSystemInfo}
        openWindowsCount={windows.length}
      />

      {/* Main Desktop Canvas Area */}
      <div
        id="linux-desktop-canvas"
        onClick={handleDesktopClick}
        onContextMenu={handleDesktopContextMenu}
        className="flex-1 w-full h-full relative pt-10 pb-12 overflow-hidden"
        style={{
          backgroundColor: '#0C0C0C',
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(242,97,63,0.03) 0%, transparent 70%),
            linear-gradient(rgba(245,239,230,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245,239,230,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 40px 40px, 40px 40px',
        }}
      >
        {/* Subtle Architectural Coordinate Watermark */}
        <div className="absolute top-12 right-6 pointer-events-none opacity-20 font-mono text-[10px] text-[#857E74] text-right space-y-0.5 hidden sm:block">
          <div>LAT 37.7749 // LNG -122.4194</div>
          <div>COMPOSITOR: NEXUS_WM_V2</div>
          <div>VFS_STATUS: MOUNTED_RO</div>
        </div>

        {/* Center Minimal NEXUS Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
          <span className="font-fraunces font-bold text-[18vw] text-[#F5EFE6] tracking-tighter">
            NEXUS
          </span>
        </div>

        {/* Project Folders Grid */}
        <div className="p-3 sm:p-6 grid grid-cols-3 xs:grid-cols-4 sm:grid-flow-col sm:grid-rows-3 md:grid-rows-4 auto-cols-max gap-2 sm:gap-6 z-10 relative overflow-y-auto max-h-[calc(100vh-100px)]">
          {projectsList.map((project, index) => (
            <LinuxFolderIcon
              key={project.id}
              project={project}
              index={index}
              isSelected={selectedFolderId === project.id}
              onClick={(e) => {
                e.stopPropagation();
                const isMobile = window.innerWidth < 768;
                if (isMobile) {
                  // On mobile touch, first tap selects & opens, or if already selected opens
                  setSelectedFolderId(project.id);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                  openProjectWindow(project);
                } else {
                  setSelectedFolderId(project.id);
                  setContextMenu((prev) => ({ ...prev, isOpen: false }));
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                openProjectWindow(project);
              }}
              onContextMenu={handleFolderContextMenu}
            />
          ))}
        </div>

        {/* Floating Instruction Chip for first-time visitors */}
        <div className="absolute bottom-14 right-6 bg-[#181818]/95 border border-[rgba(245,239,230,0.10)] rounded-[3px] p-3 text-[11px] font-mono text-[#857E74] shadow-lg max-w-xs pointer-events-none hidden md:block">
          <div className="text-[#F2613F] font-bold mb-1">💡 WORKSPACE CONTROLS</div>
          <div>• Double-click any project folder to view details & code</div>
          <div>• Right-click desktop for Terminal, Sort, and Tools</div>
          <div>• Click 'Exit Workspace' in top bar to return to website</div>
        </div>

        {/* Window Manager Stage */}
        {windows.map((win) => {
          const isActive = win.id === activeWindowId;

          return (
            <LinuxWindow
              key={win.id}
              window={win}
              isActive={isActive}
              onFocus={focusWindow}
              onClose={closeWindow}
              onMinimize={minimizeWindow}
              onMaximize={maximizeWindow}
              onMove={moveWindow}
            >
              {win.type === 'project' && win.project && (
                <LinuxProjectView project={win.project} />
              )}

              {win.type === 'terminal' && (
                <LinuxTerminal
                  onOpenProject={openProjectWindow}
                  onClose={() => closeWindow(win.id)}
                  projects={projectsList}
                />
              )}

              {win.type === 'file-manager' && (
                <LinuxFileManager
                  onOpenProject={openProjectWindow}
                  projects={projectsList}
                />
              )}

              {win.type === 'system-info' && <LinuxSystemInfo />}

              {win.type === 'properties' && win.project && (
                <LinuxPropertiesView project={win.project} />
              )}
            </LinuxWindow>
          );
        })}

        {/* Context Menu Component */}
        <LinuxContextMenu
          state={contextMenu}
          onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
          onOpenTerminal={openTerminal}
          onOpenFileManager={openFileManager}
          onOpenSystemInfo={openSystemInfo}
          onOpenProject={openProjectWindow}
          onOpenProperties={openProperties}
          onSort={handleSort}
          onRefresh={handleRefresh}
          onReturnToWeb={() => onRouteChange('/')}
        />

        {/* Alt+Tab Switcher HUD */}
        {altTabOpen && (
          <LinuxAltTabSwitcher
            windows={windows}
            selectedIndex={altTabIndex}
          />
        )}
      </div>

      {/* Bottom Taskbar Dock */}
      <LinuxDock
        windows={windows}
        activeWindowId={activeWindowId}
        onFocusWindow={focusWindow}
        onMinimizeWindow={minimizeWindow}
        onCloseWindow={closeWindow}
        onOpenTerminal={openTerminal}
        onOpenFileManager={openFileManager}
        onOpenSystemInfo={openSystemInfo}
      />
    </div>
  );
};
