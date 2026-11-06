import test from 'node:test';
import assert from 'node:assert/strict';
import { createTokenStore, StorageLike, TOKEN_STORAGE_KEY } from './tokenStore';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

test('P0-2: createTokenStore returns valid token before expiry and null after expiry', () => {
  let currentTime = 1_000_000;
  const storage = createMemoryStorage();
  const store = createTokenStore(() => storage, () => currentTime);

  store.saveToken('ya29.test-token', 3600);
  assert.equal(store.getValidToken(), 'ya29.test-token');
  assert.equal(store.isTokenExpired(), false);

  // Advance 30 minutes -> still valid
  currentTime += 30 * 60 * 1000;
  assert.equal(store.getValidToken(), 'ya29.test-token');

  // Advance past 59-minute safety TTL -> expired, returns null
  currentTime += 30 * 60 * 1000;
  assert.equal(store.getValidToken(), null);
  assert.equal(store.isTokenExpired(), true);
  assert.equal(storage.getItem(TOKEN_STORAGE_KEY), null);
});

test('P0-2: createTokenStore restores token across reload from storage and clears on logout', () => {
  let currentTime = 5_000_000;
  const storage = createMemoryStorage();

  const store1 = createTokenStore(() => storage, () => currentTime);
  store1.saveToken('ya29.persisted', 3600);
  store1.saveUserProfile({
    uid: 'u1',
    displayName: 'Harsha',
    email: 'khvr.1993@gmail.com',
  });

  // Simulate page reload with a fresh store instance backed by the same sessionStorage
  const store2 = createTokenStore(() => storage, () => currentTime);
  assert.equal(store2.getValidToken(), 'ya29.persisted');
  assert.equal(store2.getUserProfile()?.email, 'khvr.1993@gmail.com');

  // Clear on logout
  store2.clearAll();
  assert.equal(store2.getValidToken(), null);
  assert.equal(store2.getUserProfile(), null);
});
