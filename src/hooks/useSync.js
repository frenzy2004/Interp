import { useState, useRef, useCallback, useEffect } from 'react';
import { syncTasks, isLoggedIn } from '../utils/api';
import { useAuth } from './useAuth';

export function useSync({
  tasks,
  dailyFocus,
  tags,
  setTasks,
  setDailyFocus,
  setGlobalTags,
  mergeTasks,
  hasPersistedTasks = false,
  hasPersistedDailyFocus = false,
  hasPersistedTags = false,
  isOnline = true
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);

  const { isAuthenticated } = useAuth();

  // Refs to hold latest state for the sync function to avoid re-creation loops
  const tasksRef = useRef(tasks);
  const tagsRef = useRef(tags);
  const dailyFocusRef = useRef(dailyFocus);
  const lastSyncAtRef = useRef(lastSyncAt);
  const syncLockRef = useRef(false);
  const isRemoteUpdate = useRef(false);
  const syncTimeoutRef = useRef(null);
  const hasSyncedRef = useRef(false);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { tagsRef.current = tags; }, [tags]);
  useEffect(() => { dailyFocusRef.current = dailyFocus; }, [dailyFocus]);
  useEffect(() => { lastSyncAtRef.current = lastSyncAt; }, [lastSyncAt]);

  useEffect(() => {
    if (!isAuthenticated) {
      hasSyncedRef.current = false;
    }
  }, [isAuthenticated]);

  const performSync = useCallback(async () => {
    // Use ref-based lock to prevent concurrent syncs
    // Don't even try if we are offline
    if (!isLoggedIn() || syncLockRef.current || !isOnline) {
      return;
    }

    syncLockRef.current = true;
    setSyncing(true);
    setSyncError(null);

    try {
      const shouldSuppressPayload =
        !hasSyncedRef.current &&
        !hasPersistedTasks &&
        !hasPersistedDailyFocus &&
        !hasPersistedTags;

      const payloadTasks = shouldSuppressPayload ? [] : tasksRef.current;
      const payloadDailyFocus = shouldSuppressPayload ? null : dailyFocusRef.current;
      const payloadTags = shouldSuppressPayload ? null : tagsRef.current;

      const result = await syncTasks(
        payloadTasks,
        payloadDailyFocus,
        payloadTags,
        lastSyncAtRef.current
      );

      if (result.success) {
        hasSyncedRef.current = true;
        // Mark update as remote so we don't trigger the debounced sync
        isRemoteUpdate.current = true;

        if (result.tasks) {
          // Use mergeTasks instead of replacing everything
          if (mergeTasks) {
            mergeTasks(result.tasks);
          } else if (setTasks) {
            // Fallback if mergeTasks not available (shouldn't happen with updated useTasks)
            setTasks(result.tasks);
          }
        }

        if (result.dailyFocus && setDailyFocus) {
          setDailyFocus(result.dailyFocus);
        }

        if (result.userTags && setGlobalTags) {
          setGlobalTags(result.userTags);
        }

        setLastSyncAt(result.syncedAt || Date.now());

        // Reset the flag after state updates have settled
        setTimeout(() => {
          isRemoteUpdate.current = false;
        }, 1000);
      }
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncError(err.message);
    } finally {
      setSyncing(false);
      syncLockRef.current = false;
    }
  }, [
    mergeTasks,
    setTasks,
    setDailyFocus,
    setGlobalTags,
    hasPersistedTasks,
    hasPersistedDailyFocus,
    hasPersistedTags,
    isOnline
  ]);

  // Sync on auth change and periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    // Initial sync with a small delay to let the app settle
    const initialTimeout = setTimeout(() => {
      performSync();
    }, 500);

    // Periodic sync every 30 seconds
    const interval = setInterval(performSync, 30000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [isAuthenticated, performSync]);

  // Immediate sync when coming back online
  useEffect(() => {
    if (isOnline && isAuthenticated) {
      // Clear any pending debounced syncs and sync immediately
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      performSync();
    }
  }, [isOnline, isAuthenticated, performSync]);

  // Debounced sync on local task/tag changes only
  useEffect(() => {
    if (!isAuthenticated) return;

    // Skip if this update came from a sync response
    if (isRemoteUpdate.current) {
      return;
    }

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce local changes (5s for general, 500ms for reorders)
    const isReorder = Array.isArray(tasks) && tasks.some(t => t._syncImmediate);
    const delay = isReorder ? 500 : 5000;

    syncTimeoutRef.current = setTimeout(performSync, delay);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [tasks, tags, dailyFocus, isAuthenticated, performSync]);

  return {
    syncing,
    syncError,
    lastSyncAt,
    performSync
  };
}
