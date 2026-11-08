import Ionicons from '@expo/vector-icons/Ionicons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { announce, playCue, stopAnnouncement, tapFeedback } from '@/lib/feedback';
import { cancelCues, ensurePermission, scheduleCues } from '@/lib/notify';
import { findPreset, usePresets } from '@/lib/presets';
import { pairingFor, type Pairing } from '@/lib/rotation';
import { useSettings } from '@/lib/settings';
import { colors } from '@/lib/theme';
import { buildTimeline, formatClock, snapshotAt } from '@/lib/timeline';

const HOLD_TO_EXIT_MS = 1200;
const START_DELAY_MS = 600; // kurz Luft holen, bevor der erste Gong kommt
const STALE_CUE_MS = 1500; // ältere Signale (z. B. während gesperrt) nicht nachholen

const KEEP_AWAKE_TAG = 'sparring-box-timer';

export default function TimerScreen() {
  // Display bleibt an, solange der Timer-Screen offen ist.
  useEffect(() => {
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, []);
  const { id } = useLocalSearchParams<{ id: string }>();
  const custom = usePresets((s) => s.custom);
  const [hydrated, setHydrated] = useState(() => usePresets.persist.hasHydrated());
  useEffect(() => usePresets.persist.onFinishHydration(() => setHydrated(true)), []);
  const preset = findPreset(id, custom);
  const timeline = useMemo(() => (preset ? buildTimeline(preset) : null), [preset]);

  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // anchor = absoluter Zeitpunkt (ms) von "Timer-Null", solange der Timer läuft.
  const [anchor, setAnchor] = useState<number | null>(null);
  const [pausedElapsed, setPausedElapsed] = useState(-START_DELAY_MS);
  const [now, setNow] = useState(() => Date.now());
  const lastChecked = useRef(-Infinity);
  const started = useRef(false);

  const running = anchor !== null;
  const elapsed = running ? now - anchor : pausedElapsed;
  const snap = timeline ? snapshotAt(timeline, Math.max(0, elapsed), preset!.warnSec) : null;
  const done = snap?.done ?? false;

  const resume = useCallback(
    (fromElapsed: number) => {
      if (!timeline) return;
      const a = Date.now() - fromElapsed;
      lastChecked.current = fromElapsed - 1;
      setAnchor(a);
      setNow(Date.now());
      scheduleCues(timeline.cues, a, fromElapsed);
    },
    [timeline],
  );

  // Automatisch starten, sobald das Preset da ist.
  useEffect(() => {
    if (!timeline || started.current) return;
    started.current = true;
    ensurePermission().finally(() => resume(-START_DELAY_MS));
  }, [timeline, resume]);

  // Aufräumen beim Verlassen.
  useEffect(
    () => () => {
      cancelCues();
      stopAnnouncement();
    },
    [],
  );

  // Anzeige-Takt + Signale. Die Anzeige rechnet immer Zielzeit − jetzt.
  useEffect(() => {
    if (!running || !timeline) return;
    const tick = () => {
      const t = Date.now();
      const e = t - anchor;
      const isNew = (at: number) => at > lastChecked.current && at <= e;
      const crossed = timeline.cues.filter((c) => isNew(c.at));
      const spoken = timeline.announcements.filter((a) => isNew(a.at));
      lastChecked.current = e;
      const latest = crossed[crossed.length - 1];
      if (latest && e - latest.at < STALE_CUE_MS) playCue(latest.kind);
      const say = spoken[spoken.length - 1];
      if (say && e - say.at < STALE_CUE_MS && useSettings.getState().voiceOn) announce(say.text);
      setNow(t);
      if (e >= timeline.total) {
        setPausedElapsed(timeline.total);
        setAnchor(null);
      }
    };
    tick();
    const iv = setInterval(tick, 100);
    return () => clearInterval(iv);
  }, [running, anchor, timeline]);

  // --- Bedienung: Tippen = Pause/Weiter, lang drücken = Beenden ---
  const voiceOn = useSettings((s) => s.voiceOn);
  const toggleVoice = () => {
    tapFeedback();
    if (voiceOn) stopAnnouncement();
    useSettings.getState().toggleVoice();
  };

  const [hold] = useState(() => new Animated.Value(0));
  const onPressIn = () => {
    Animated.timing(hold, {
      toValue: 1,
      duration: HOLD_TO_EXIT_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  };
  const onPressOut = () => {
    hold.stopAnimation();
    Animated.timing(hold, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };
  const onPress = () => {
    if (done) return exit();
    tapFeedback();
    if (running) {
      // Event-Handler, nicht Render – der React-Compiler-Lint erkennt das hier nicht.
      // eslint-disable-next-line react-hooks/purity
      setPausedElapsed(Date.now() - anchor);
      setAnchor(null);
      cancelCues();
      // Laufende Ansage bewusst NICHT abbrechen – sie wird beim Weitermachen nicht wiederholt.
    } else {
      resume(pausedElapsed);
    }
  };
  const exit = () => {
    cancelCues();
    stopAnnouncement();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (!timeline || !preset) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.bg }]}>
        <Text style={styles.label}>{hydrated ? 'Preset nicht gefunden' : ''}</Text>
        {hydrated && (
          <Pressable onPress={exit} style={styles.backBtn}>
            <Text style={styles.backText}>Zurück</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // --- Darstellung ---
  let bg: string = colors.prep;
  let label = 'GLEICH GEHT’S LOS';
  let sub = `${preset.name} · ${timeline.rounds} Runden`;
  let clockMs = 0;

  if (elapsed < 0) {
    clockMs = timeline.segments[0].end - timeline.segments[0].start;
  } else if (snap && !snap.done) {
    const { segment, remaining, inWarning } = snap;
    clockMs = remaining;
    if (segment.phase === 'prep') {
      label = 'VORBEREITUNG';
      bg = colors.prep;
    } else if (segment.phase === 'round') {
      label = `RUNDE ${segment.round}/${timeline.rounds}`;
      bg = inWarning ? colors.warning : colors.round;
      sub = inWarning ? 'LETZTE SEKUNDEN' : preset.name;
    } else {
      label = 'PAUSE';
      bg = colors.rest;
      sub = `Nächste: Runde ${segment.round + 1}/${timeline.rounds}`;
    }
  }
  if (done) {
    bg = colors.done;
    label = 'FERTIG';
    sub = `${timeline.rounds} Runden geschafft`;
  }

  // Sparring-Rotation: in Vorbereitung/Pause die nächste Runde groß, während der Runde die aktuelle klein.
  let pairing: Pairing | null = null;
  let pairingRound = 1;
  let pairingBig = true;
  if (timeline.fighters && !done) {
    if (snap && !snap.done && elapsed >= 0 && snap.segment.phase !== 'prep') {
      pairingBig = snap.segment.phase === 'rest';
      pairingRound = pairingBig ? snap.segment.round + 1 : snap.segment.round;
    }
    pairing = pairingFor(timeline.fighters, pairingRound);
    if (pairingBig) sub = '';
  }

  const clockText = done ? '0:00' : formatClock(clockMs);
  const landscape = width > height;
  const clockShare = pairing ? (pairingBig ? (landscape ? 0.3 : 0.2) : landscape ? 0.45 : 0.32) : landscape ? 0.62 : 0.42;
  const fontSize = Math.min(width / (clockText.length * 0.6), height * clockShare);
  const lines = pairing ? pairing.bouts.length + (pairing.resting.length ? 1 : 0) + (pairingBig ? 1 : 0) : 0;
  // Schrift so groß wie möglich: begrenzt durch Zeilenanzahl (Höhe) und längste Paarung (Breite).
  const longest = pairing ? Math.max(...pairing.bouts.map(([a, b]) => `${a} vs. ${b}`.length), 8) : 1;
  const boutSize = pairing
    ? Math.min(
        pairingBig ? 52 : 28,
        (height * (pairingBig ? 0.44 : 0.24)) / Math.max(lines, 1) / 1.3,
        ((width - 56) / longest) * 1.7,
      )
    : 0;
  const labelSize = Math.max(28, Math.min(width, height) * 0.09);
  const paused = !running && !done;
  const currentRound = snap && !snap.done ? snap.segment.round : done ? timeline.rounds : 1;

  return (
    <Pressable
      style={[styles.fill, { backgroundColor: bg }]}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={exit}
      delayLongPress={HOLD_TO_EXIT_MS}
      accessibilityRole="button"
      accessibilityLabel={done ? 'Zurück zur Übersicht' : running ? 'Pausieren' : 'Weiter'}
      accessibilityHint="Lange drücken beendet den Timer"
    >
      <StatusBar hidden />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.holdBar,
          { top: insets.top, width: hold.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
      <View
        style={[
          styles.fill,
          styles.center,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, opacity: paused ? 0.55 : 1 },
        ]}
      >
        <Text style={[styles.label, { fontSize: labelSize }]} numberOfLines={1} adjustsFontSizeToFit>
          {label}
        </Text>
        <Text
          style={[styles.clock, { fontSize, lineHeight: fontSize * 1.05 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {clockText}
        </Text>
        {!!sub && (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        )}
        {pairing && (
          <View style={[styles.pairBox, pairingBig && styles.pairBoxBig]}>
            {pairingBig && (
              <Text style={styles.pairTitle} numberOfLines={1}>
                NÄCHSTE: RUNDE {pairingRound}/{timeline.rounds}
              </Text>
            )}
            {pairing.bouts.map(([a, b]) => (
              <Text
                key={`${a}-${b}`}
                style={[styles.bout, { fontSize: boutSize, lineHeight: boutSize * 1.2 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {a}
                <Text style={styles.vs}> vs. </Text>
                {b}
              </Text>
            ))}
            {pairing.resting.length > 0 && (
              <Text style={[styles.resting, { fontSize: boutSize * 0.75 }]} numberOfLines={1} adjustsFontSizeToFit>
                Pause: {pairing.resting.join(', ')}
              </Text>
            )}
          </View>
        )}
        {!pairing && timeline.rounds <= 15 && !landscape && (
          <View style={styles.dots}>
            {Array.from({ length: timeline.rounds }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i + 1 < currentRound || done ? styles.dotDone : i + 1 === currentRound ? styles.dotNow : null,
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {timeline.fighters && !done && (
        <Pressable
          onPress={toggleVoice}
          hitSlop={12}
          accessibilityRole="switch"
          accessibilityState={{ checked: voiceOn }}
          accessibilityLabel="Sprachansage"
          style={({ pressed }) => [
            styles.voiceBtn,
            { top: insets.top + 14, right: insets.right + 14 },
            !voiceOn && styles.voiceBtnOff,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name={voiceOn ? 'volume-high' : 'volume-mute'} size={32} color="#FFFFFF" />
        </Pressable>
      )}

      {paused && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
          <View style={styles.pauseBadge}>
            <Text style={styles.pauseTitle}>{elapsed < 0 ? 'BEREIT' : 'PAUSIERT'}</Text>
            <Text style={styles.pauseHint}>Tippen = weiter · Halten = beenden</Text>
          </View>
        </View>
      )}

      {!paused && (
        <Text pointerEvents="none" style={[styles.hint, { bottom: insets.bottom + 10 }]}>
          {done ? 'Tippen = zurück' : 'Tippen = Pause · Halten = Beenden'}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  label: { color: 'rgba(255,255,255,0.92)', fontWeight: '900', letterSpacing: 2, fontSize: 32 },
  clock: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -4,
    textAlign: 'center',
  },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 24, fontWeight: '700', marginTop: 4 },
  dots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 28, maxWidth: 320 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotDone: { backgroundColor: 'rgba(255,255,255,0.85)' },
  dotNow: { backgroundColor: '#FFFFFF', transform: [{ scale: 1.35 }] },
  pairBox: { alignItems: 'center', marginTop: 16, alignSelf: 'stretch' },
  pairBoxBig: {
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  pairTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 18, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  bout: { color: '#FFFFFF', fontWeight: '900', textAlign: 'center' },
  vs: { color: 'rgba(255,255,255,0.6)', fontWeight: '700' },
  resting: { color: 'rgba(255,255,255,0.75)', fontWeight: '700', marginTop: 4, textAlign: 'center' },
  hint: { position: 'absolute', alignSelf: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' },
  voiceBtn: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  voiceBtnOff: { backgroundColor: 'rgba(0,0,0,0.6)', opacity: 0.85 },
  holdBar: { position: 'absolute', left: 0, height: 8, backgroundColor: '#FFFFFF' },
  pauseBadge: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 28,
    paddingVertical: 20,
    borderRadius: 24,
    alignItems: 'center',
  },
  pauseTitle: { color: '#FFFFFF', fontSize: 40, fontWeight: '900', letterSpacing: 3 },
  pauseHint: { color: 'rgba(255,255,255,0.75)', fontSize: 17, marginTop: 6, fontWeight: '600' },
  backBtn: { marginTop: 20, padding: 16 },
  backText: { color: colors.accent, fontSize: 20, fontWeight: '700' },
});
