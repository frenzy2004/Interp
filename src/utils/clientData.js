"use client";

const AUTH_STORAGE_KEYS = [
  'interp_auth_token',
  'interp_user',
];

const ACCOUNT_DATA_STORAGE_KEYS = [
  'interp_sessions',
];

const NON_ACCOUNT_STORAGE_KEYS = [
  'interp_sound_enabled',
  'interp_voice_model',
];

const removeKeys = (keys) => {
  if (typeof window === 'undefined') return;
  try {
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore storage errors
  }
};

export const clearAuthStorage = () => {
  removeKeys(AUTH_STORAGE_KEYS);
};

export const clearAccountDataStorage = () => {
  removeKeys(ACCOUNT_DATA_STORAGE_KEYS);
};

export const clearNonAccountStorage = () => {
  removeKeys(NON_ACCOUNT_STORAGE_KEYS);
};

export const clearClientData = async () => {
  if (typeof window === 'undefined') return;

  clearAuthStorage();
  clearAccountDataStorage();
  clearNonAccountStorage();

  try {
    sessionStorage.clear();
  } catch {
    // Ignore storage errors
  }

  // Clear any cached API responses or assets that might include account data
  try {
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch {
    // Ignore cache errors
  }

  // Clear IndexedDB databases for this origin (defensive cleanup)
  try {
    if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
      const dbs = await indexedDB.databases();
      await Promise.all(
        dbs
          .map((db) => db.name)
          .filter(Boolean)
          .map((name) => new Promise((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }))
      );
    }
  } catch {
    // Ignore IDB errors
  }
};

export default {
  clearAuthStorage,
  clearAccountDataStorage,
  clearNonAccountStorage,
  clearClientData,
};
