import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { appStorage, STORAGE_PREFIX } from './storage';

type SettingsState = {
  /** Sprachansage der Paarungen an/aus (Lautsprecher-Knopf im Timer). */
  voiceOn: boolean;
  toggleVoice: () => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      voiceOn: true,
      toggleVoice: () => set((s) => ({ voiceOn: !s.voiceOn })),
    }),
    {
      name: `${STORAGE_PREFIX}settings`,
      version: 1,
      storage: appStorage,
      partialize: (s) => ({ voiceOn: s.voiceOn }),
    },
  ),
);
