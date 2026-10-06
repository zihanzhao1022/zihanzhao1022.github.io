import { describe, expect, it } from 'vitest';
import { StorageLike, isExpiringSoon, loadSession, safeReturnHash, saveSession } from './session';

const memoryStorage = () => {
  const data = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
  return { data, storage };
};

const session = { token: 'ghu_x', login: 'zihanzhao1022', avatarUrl: 'https://avatars.example/x', expiresAt: 10_000 };

describe('session storage', () => {
  it('round-trips a valid session', () => {
    const { storage } = memoryStorage();
    saveSession(session, storage);
    expect(loadSession(storage, 5_000)).toEqual(session);
  });

  it('drops expired sessions', () => {
    const { data, storage } = memoryStorage();
    saveSession(session, storage);
    expect(loadSession(storage, 10_000)).toBeNull();
    expect(data.size).toBe(0);
  });

  it('ignores malformed data', () => {
    const { storage } = memoryStorage();
    storage.setItem('homepage-editor-session', '{not json');
    expect(loadSession(storage, 0)).toBeNull();
    storage.setItem('homepage-editor-session', JSON.stringify({ token: 1 }));
    expect(loadSession(storage, 0)).toBeNull();
  });

  it('survives storage that throws', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    const broken: StorageLike = { getItem: blocked, setItem: blocked, removeItem: blocked };
    expect(() => saveSession(session, broken)).not.toThrow();
    expect(loadSession(broken, 0)).toBeNull();
  });
});

describe('isExpiringSoon', () => {
  it('warns within 15 minutes of expiry', () => {
    expect(isExpiringSoon({ ...session, expiresAt: 20 * 60_000 }, 0)).toBe(false);
    expect(isExpiringSoon({ ...session, expiresAt: 14 * 60_000 }, 0)).toBe(true);
  });
});

describe('safeReturnHash', () => {
  it('keeps internal routes', () => {
    expect(safeReturnHash('#/publications')).toBe('#/publications');
    expect(safeReturnHash('#/')).toBe('#/');
  });

  it('falls back to the home page for anything else', () => {
    expect(safeReturnHash('')).toBe('#/');
    expect(safeReturnHash(undefined)).toBe('#/');
    expect(safeReturnHash('#//evil.example')).toBe('#/');
    expect(safeReturnHash('#/x"><script>')).toBe('#/');
    expect(safeReturnHash('https://evil.example')).toBe('#/');
  });
});
