/**
 * Pure, testable token storage utility with expiration tracking.
 * Supports dependency-injected storage for deterministic unit tests.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StoredTokenRecord {
  token: string;
  expiresAt: number;
}

export const TOKEN_STORAGE_KEY = 'hvr_gdrive_access_token';
export const USER_STORAGE_KEY = 'hvr_gdrive_user_profile';

export interface StoredUserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export function createTokenStore(
  getStorage: () => StorageLike | null = () =>
    typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  nowFn: () => number = () => Date.now()
) {
  let memoryToken: string | null = null;
  let memoryExpiresAt: number = 0;

  function readRecord(): StoredTokenRecord | null {
    const now = nowFn();
    if (memoryToken && memoryExpiresAt > now) {
      return { token: memoryToken, expiresAt: memoryExpiresAt };
    }

    const storage = getStorage();
    if (!storage) return null;

    try {
      const raw = storage.getItem(TOKEN_STORAGE_KEY);
      if (!raw) return null;

      // Support JSON { token, expiresAt } format
      if (raw.startsWith('{')) {
        const parsed = JSON.parse(raw) as Partial<StoredTokenRecord>;
        if (parsed.token && typeof parsed.expiresAt === 'number') {
          if (parsed.expiresAt <= now) {
            memoryToken = null;
            memoryExpiresAt = 0;
            storage.removeItem(TOKEN_STORAGE_KEY);
            return null;
          }
          memoryToken = parsed.token;
          memoryExpiresAt = parsed.expiresAt;
          return { token: parsed.token, expiresAt: parsed.expiresAt };
        }
      }

      // Backwards-compatible migration: if a bare token string was stored without expiry,
      // treat it as valid for 50 minutes from first read and upgrade its format.
      const fallbackExpiresAt = now + 50 * 60 * 1000;
      memoryToken = raw;
      memoryExpiresAt = fallbackExpiresAt;
      storage.setItem(
        TOKEN_STORAGE_KEY,
        JSON.stringify({ token: raw, expiresAt: fallbackExpiresAt })
      );
      return { token: raw, expiresAt: fallbackExpiresAt };
    } catch {
      return null;
    }
  }

  function saveToken(token: string | null, expiresInSeconds: number = 3600): void {
    const storage = getStorage();
    if (!token) {
      memoryToken = null;
      memoryExpiresAt = 0;
      try {
        storage?.removeItem(TOKEN_STORAGE_KEY);
      } catch {}
      return;
    }

    // Subtract a 60-second safety margin from expiry
    const safeTtlSeconds = Math.max(60, expiresInSeconds - 60);
    const expiresAt = nowFn() + safeTtlSeconds * 1000;
    memoryToken = token;
    memoryExpiresAt = expiresAt;

    try {
      storage?.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ token, expiresAt }));
    } catch {}
  }

  function getValidToken(): string | null {
    const rec = readRecord();
    return rec ? rec.token : null;
  }

  function isTokenExpired(): boolean {
    return getValidToken() === null;
  }

  function saveUserProfile(user: Partial<StoredUserProfile>): void {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify({
          uid: user.uid || 'google-user',
          displayName: user.displayName || 'Google User',
          email: user.email || null,
          photoURL: user.photoURL || null,
        })
      );
    } catch {}
  }

  function getUserProfile(): StoredUserProfile | null {
    const storage = getStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(USER_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as StoredUserProfile;
    } catch {
      return null;
    }
  }

  function clearAll(): void {
    memoryToken = null;
    memoryExpiresAt = 0;
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.removeItem(TOKEN_STORAGE_KEY);
      storage.removeItem(USER_STORAGE_KEY);
    } catch {}
  }

  return {
    saveToken,
    getValidToken,
    isTokenExpired,
    saveUserProfile,
    getUserProfile,
    clearAll,
  };
}
