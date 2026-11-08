import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
      name: 'box-timer-settings',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ voiceOn: s.voiceOn }),
    },
  ),
);
