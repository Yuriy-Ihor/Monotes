import { useSyncExternalStore } from 'react';
import { songMeta } from './abcUtils.js';

// Built-in songs: every .abc file in src/songs is bundled into the app.
const rawFiles = import.meta.glob('./songs/*.abc', { as: 'raw' });

const STORAGE_KEY = 'monotes.userSongs';

function loadUserSongs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

let builtIn = [];
let userSongs = loadUserSongs();
let snapshot = null;
const listeners = new Set();

function emit() {
  snapshot = null;
  listeners.forEach((l) => l());
}

async function loadBuiltIn() {
  const entries = await Promise.all(
    Object.entries(rawFiles).map(async ([path, load]) => {
      // Vite 2 inlines raw globs as strings; newer Vite returns loader functions.
      const raw = typeof load === 'function' ? await load() : load;
      // Files checked out with CRLF on Windows.
      const abc = raw.replace(/\r\n?/g, '\n');
      const id = 'b-' + path.split('/').pop().replace(/\.abc$/, '');
      return { id, abc, builtIn: true };
    }),
  );
  builtIn = entries;
  emit();
}

loadBuiltIn();

function saveUserSongs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userSongs));
  } catch (e) {
    alert('Could not save to browser storage: ' + e.message);
  }
}

function withMeta(s) {
  return { ...s, ...songMeta(s.abc) };
}

function getSnapshot() {
  if (!snapshot) {
    snapshot = {
      ready: builtInLoaded(),
      songs: [...userSongs.map(withMeta), ...builtIn.map(withMeta)],
    };
  }
  return snapshot;
}

function builtInLoaded() {
  return builtIn.length > 0 || Object.keys(rawFiles).length === 0;
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useLibrary() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function getSong(id) {
  return getSnapshot().songs.find((s) => s.id === id) || null;
}

export function saveUserSong(id, abc) {
  const now = Date.now();
  if (id && id.startsWith('u-')) {
    const idx = userSongs.findIndex((s) => s.id === id);
    if (idx >= 0) {
      userSongs[idx] = { ...userSongs[idx], abc, updated: now };
      userSongs = [...userSongs];
      saveUserSongs();
      emit();
      return id;
    }
  }
  const newId = 'u-' + now.toString(36) + Math.random().toString(36).slice(2, 6);
  userSongs = [{ id: newId, abc, updated: now }, ...userSongs];
  saveUserSongs();
  emit();
  return newId;
}

export function deleteUserSong(id) {
  userSongs = userSongs.filter((s) => s.id !== id);
  saveUserSongs();
  emit();
}
