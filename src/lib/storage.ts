import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** Präfix aller gespeicherten Daten. Bis v1.1.0 hieß die App „Box-Timer“ (Präfix `box-timer-`). */
export const STORAGE_PREFIX = 'sparring-box-timer-';
const LEGACY_PREFIX = 'box-timer-';

/**
 * AsyncStorage für Zustand-persist. Fehlt ein Eintrag unter dem neuen Namen,
 * wird einmalig der alte (`box-timer-…`) gelesen – so gehen gespeicherte Presets
 * nach der Umbenennung nicht verloren. Beim nächsten Speichern landet alles unter dem neuen Namen.
 */
export const appStorage = createJSONStorage(() => ({
  getItem: async (key: string) =>
    (await AsyncStorage.getItem(key)) ??
    (key.startsWith(STORAGE_PREFIX) ? AsyncStorage.getItem(LEGACY_PREFIX + key.slice(STORAGE_PREFIX.length)) : null),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
}));
