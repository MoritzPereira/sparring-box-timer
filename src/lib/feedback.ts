/**
 * Sound + Vibration im Vordergrund.
 * Audio-Modus "mixWithOthers": Spotify & Co. laufen weiter, die Glocke wird darübergelegt.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import type { CueKind } from './timeline';

const SOURCES = {
  bell: require('../../assets/sounds/bell.wav'), // Rundenstart: helles Doppel-Klingeln
  bell_end: require('../../assets/sounds/bell_end.wav'), // Rundenende: dasselbe, tiefer
  click: require('../../assets/sounds/click.wav'), // Hinweis vor Rundenende/-start
};

type SoundName = keyof typeof SOURCES;

/** Länge der Dateien (s) + Puffer – so lange lebt ein Player nach dem Abspielen. */
const LIFETIME_MS: Record<SoundName, number> = { bell: 8000, bell_end: 8000, click: 2000 };

/** Welcher Sound bei welchem Ereignis. Dateiname = `${name}.wav` (auch für Mitteilungen). */
export const CUE_SOUND: Record<CueKind, SoundName> = {
  roundStart: 'bell',
  roundEnd: 'bell_end',
  finish: 'bell_end',
  warn: 'click',
  getReady: 'click',
};

/*
 * Wiedergabe ohne Zurückspulen: Ein einmal abgespielter Player wird NIE wiederverwendet.
 * Pro Sound liegt immer ein frischer, vorgeladener Player bereit ("armed").
 * Beim Signal wird er abgespielt, sofort ein neuer vorgeladen, und der alte nach dem
 * Ausklingen freigegeben. So kann sich nichts in die Quere kommen – egal wie viele
 * Runden, und auch wenn zwei Signale kurz hintereinander kommen.
 */
const armed: Partial<Record<SoundName, AudioPlayer>> = {};
let ready = false;

function create(name: SoundName): AudioPlayer | undefined {
  try {
    const p = createAudioPlayer(SOURCES[name]);
    p.volume = 1;
    return p;
  } catch (e) {
    console.warn(`Sound ${name} konnte nicht geladen werden`, e);
    return undefined;
  }
}

export async function initAudio() {
  if (ready) return;
  ready = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
    });
  } catch (e) {
    console.warn('Audio-Modus konnte nicht gesetzt werden', e);
  }
  for (const name of Object.keys(SOURCES) as SoundName[]) armed[name] = create(name);
  loadVoice();
}

function play(name: SoundName) {
  // Bereitliegenden Player nehmen; falls keiner da ist (z. B. Fehler beim Laden), sofort neu erzeugen.
  const p = armed[name] ?? create(name);
  armed[name] = create(name); // nächsten schon vorladen
  if (!p) return;
  try {
    p.play();
  } catch (e) {
    console.warn(`Sound ${name} konnte nicht abgespielt werden`, e);
  }
  setTimeout(() => {
    try {
      p.release();
    } catch {}
  }, LIFETIME_MS[name]);
}

export function playCue(kind: CueKind) {
  play(CUE_SOUND[kind]);
  vibrate(kind);
}

function vibrate(kind: CueKind) {
  if (Platform.OS === 'web') return;
  const run = async () => {
    if (kind === 'warn' || kind === 'getReady') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (kind === 'finish') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };
  run().catch(() => {});
}

export function tapFeedback() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

/*
 * Sprachansage (Paarungen der Sparring-Rotation). Läuft wie die Glocke über die Musik.
 * Stimme: bevorzugt „Anna“ (Deutsch) in der besten installierten Qualität
 * (Premium > Erweitert > Standard). Fehlt Anna, die beste andere deutsche Stimme.
 */
const PREFERRED_VOICE = 'anna';
let voiceId: string | undefined;
let voiceQuality: 0 | 1 | 2 = 0; // 0 = Standard, 1 = Erweitert, 2 = Premium
let voicePromise: Promise<void> | null = null;

function qualityOf(v: Speech.Voice): 0 | 1 | 2 {
  const id = v.identifier.toLowerCase();
  if (id.includes('premium')) return 2;
  if (id.includes('enhanced') || v.quality === Speech.VoiceQuality.Enhanced) return 1;
  return 0;
}

function loadVoice(): Promise<void> {
  voicePromise ??= (async () => {
    try {
      const voices = (await Speech.getAvailableVoicesAsync()).filter((v) => v.language?.toLowerCase().startsWith('de'));
      const score = (v: Speech.Voice) =>
        qualityOf(v) * 10 + (v.name.toLowerCase().startsWith(PREFERRED_VOICE) ? 5 : 0) + (v.language === 'de-DE' ? 1 : 0);
      const best = voices.sort((a, b) => score(b) - score(a))[0];
      if (best) {
        voiceId = best.identifier;
        voiceQuality = qualityOf(best);
      }
    } catch (e) {
      console.warn('Stimmen konnten nicht geladen werden', e);
    }
  })();
  return voicePromise;
}

/** true, wenn nur die einfache Standard-Stimme verfügbar ist (Hinweis zum Laden anzeigen). */
export async function onlyBasicVoice(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await loadVoice();
  return voiceQuality === 0;
}

export function announce(text: string) {
  try {
    Speech.stop();
    Speech.speak(text, { language: 'de-DE', voice: voiceId, rate: 0.95 });
  } catch (e) {
    console.warn('Ansage fehlgeschlagen', e);
  }
}

export function stopAnnouncement() {
  try {
    Speech.stop();
  } catch {}
}
