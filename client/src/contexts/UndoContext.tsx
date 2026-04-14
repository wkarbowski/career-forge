import React, { createContext, useContext, useCallback, useRef, useEffect, useState, type ReactNode } from 'react';
import type { AppStateContextValue } from './AppStateContext';
import { useAppState } from './AppStateContext';

interface UndoContextValue {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const UndoContext = createContext<UndoContextValue | null>(null);

const MAX_HISTORY = 50;

function snapshot(appState: AppStateContextValue): string {
  return JSON.stringify({
    data: appState.data,
    visibleSections: appState.visibleSections,
    sidebarOrder: appState.sidebarOrder,
  });
}

export function UndoProvider({ children }: { children: ReactNode }) {
  const appState = useAppState();
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const lastSnapshot = useRef<string | null>(null);
  const skipNextCapture = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Capture a snapshot before structural changes
  const captureSnapshot = useCallback(() => {
    if (skipNextCapture.current) {
      skipNextCapture.current = false;
      return;
    }
    const snap = snapshot(appState);
    if (snap === lastSnapshot.current) return;
    if (lastSnapshot.current !== null) {
      undoStack.current.push(lastSnapshot.current);
      if (undoStack.current.length > MAX_HISTORY) {
        undoStack.current.shift();
      }
      redoStack.current = [];
    }
    lastSnapshot.current = snap;
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(false);
  }, [appState]);

  // Watch for structural changes (data array lengths, sidebarOrder, visibleSections)
  const structuralKey = JSON.stringify({
    sections: appState.sidebarOrder,
    visible: appState.visibleSections,
    expCount: appState.data?.experience?.length,
    eduCount: appState.data?.education?.length,
    skillCount: appState.data?.skills?.length,
    langCount: appState.data?.languages?.length,
    compCount: appState.data?.coreCompetencies?.length,
    achCount: appState.data?.achievements?.length,
    customCount: appState.data?.customSections?.length,
  });

  useEffect(() => {
    captureSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuralKey]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const currentSnap = snapshot(appState);
    redoStack.current.push(currentSnap);
    const prevSnap = undoStack.current.pop()!;
    const prev = JSON.parse(prevSnap);

    skipNextCapture.current = true;
    appState.setData(prev.data);
    appState.setVisibleSections(prev.visibleSections);
    appState.setSidebarOrder(prev.sidebarOrder);
    lastSnapshot.current = prevSnap;

    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, [appState]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const currentSnap = snapshot(appState);
    undoStack.current.push(currentSnap);
    const nextSnap = redoStack.current.pop()!;
    const next = JSON.parse(nextSnap);

    skipNextCapture.current = true;
    appState.setData(next.data);
    appState.setVisibleSections(next.visibleSections);
    appState.setSidebarOrder(next.sidebarOrder);
    lastSnapshot.current = nextSnap;

    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }, [appState]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z (only when no contentEditable focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Don't intercept if a contentEditable is focused
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <UndoContext.Provider value={{ undo, redo, canUndo, canRedo }}>
      {children}
    </UndoContext.Provider>
  );
}

export function useUndo(): UndoContextValue {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used within UndoProvider');
  return ctx;
}
