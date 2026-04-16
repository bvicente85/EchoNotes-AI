import { useState, useCallback, useRef, useEffect } from 'react';

export function useUndoRedo<T>(initialState: T, debounceMs: number = 500) {
  const [state, setState] = useState<T>(initialState);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);
  
  const lastSavedStateRef = useRef<T>(initialState);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    
    // If there's a pending save, save it before undoing
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      // We don't want to save the current state to past if we are undoing, 
      // but we need to make sure the current state is in future
    }

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setPast(newPast);
    setFuture([state, ...future]);
    setState(previous);
    lastSavedStateRef.current = previous;
  }, [past, state, future]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast([...past, state]);
    setFuture(newFuture);
    setState(next);
    lastSavedStateRef.current = next;
  }, [future, state, past]);

  const update = useCallback((newPresent: T) => {
    setState(newPresent);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (JSON.stringify(newPresent) !== JSON.stringify(lastSavedStateRef.current)) {
        setPast(p => [...p, lastSavedStateRef.current]);
        setFuture([]);
        lastSavedStateRef.current = newPresent;
      }
      timeoutRef.current = null;
    }, debounceMs);
  }, [debounceMs]);

  // Handle manual reset (e.g. when report prop changes)
  const reset = useCallback((newState: T) => {
    setState(newState);
    setPast([]);
    setFuture([]);
    lastSavedStateRef.current = newState;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return { 
    state, 
    update, 
    undo, 
    redo, 
    reset,
    canUndo: past.length > 0, 
    canRedo: future.length > 0 
  };
}
