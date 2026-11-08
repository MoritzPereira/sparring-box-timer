import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { onlyBasicVoice, tapFeedback } from '@/lib/feedback';
import { cleanFighters, cycleLength, MAX_FIGHTERS, MIN_FIGHTERS, pairingFor, pairingText } from '@/lib/rotation';
import { colors } from '@/lib/theme';

type Props = {
  fighters: string[];
  rounds: number;
  onChange: (fighters: string[]) => void;
  onRounds: (rounds: number) => void;
};

/** Teilnehmerliste für die Sparring-Rotation. */
export function FighterEditor({ fighters, rounds, onChange, onRounds }: Props) {
  const [name, setName] = useState('');
  const [basicVoice, setBasicVoice] = useState(false);
  useEffect(() => {
    let alive = true;
    onlyBasicVoice().then((b) => alive && setBasicVoice(b));
    return () => {
      alive = false;
    };
  }, []);
  const list = cleanFighters(fighters);
  const active = list.length >= MIN_FIGHTERS;
  const full = list.length >= MAX_FIGHTERS;
  const cycle = cycleLength(list.length);
  const isDuplicate = list.some((f) => f.toLocaleLowerCase('de') === name.trim().toLocaleLowerCase('de'));

  const add = () => {
    const n = name.trim();
    if (!n || full || isDuplicate) return;
    onChange([...list, n]);
    setName('');
    tapFeedback();
  };

  const remove = (i: number) => {
    onChange(list.filter((_, j) => j !== i));
    tapFeedback();
  };

  const round1 = active ? pairingFor(list, 1) : null;

  return (
    <View style={styles.box}>
      <Text style={styles.label}>Sparring-Rotation</Text>
      <Text style={styles.hint}>
        Ab {MIN_FIGHTERS} Leuten zeigt der Timer in jeder Pause, wer als Nächstes gegen wen boxt, und sagt es an. Bei
        ungerader Anzahl setzt jede Runde ein anderer aus.
      </Text>

      {list.map((f, i) => (
        <View key={f} style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {f}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${f} entfernen`}
            onPress={() => remove(i)}
            hitSlop={8}
            style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
          >
            <Text style={styles.removeText}>✕</Text>
          </Pressable>
        </View>
      ))}

      {!full && (
        <View style={styles.row}>
          <TextInput
            value={name}
            onChangeText={setName}
            onSubmitEditing={add}
            submitBehavior="submit"
            placeholder={list.length ? 'Weiterer Name' : 'Name, z. B. Perry'}
            placeholderTextColor={colors.muted}
            style={styles.input}
            returnKeyType="done"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={16}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Teilnehmer hinzufügen"
            onPress={add}
            disabled={!name.trim() || isDuplicate}
            style={({ pressed }) => [styles.addBtn, pressed && styles.pressed, (!name.trim() || isDuplicate) && { opacity: 0.35 }]}
          >
            <Text style={styles.addText}>+</Text>
          </Pressable>
        </View>
      )}
      {isDuplicate && !!name.trim() && <Text style={styles.warn}>„{name.trim()}“ ist schon dabei.</Text>}

      {active && round1 ? (
        <>
          <Text style={styles.info}>
            {round1.bouts.length} {round1.bouts.length === 1 ? 'Paar' : 'Paare'} pro Runde
            {round1.resting.length ? ', einer hat Pause' : ''}. Nach {cycle} Runden hat jeder gegen jeden geboxt.
          </Text>
          <Text style={styles.preview}>Runde 1: {pairingText(round1)}</Text>
          {basicVoice && (
            <Text style={styles.info}>
              Tipp für eine natürlichere Ansage: Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen →
              Deutsch → „Anna (Premium)“ laden.
            </Text>
          )}
          {rounds !== cycle && (
            <Pressable
              accessibilityRole="button"
              onPress={() => onRounds(cycle)}
              style={({ pressed }) => [styles.cycleBtn, pressed && styles.pressed]}
            >
              <Text style={styles.cycleText}>Runden auf {cycle} setzen (jeder gegen jeden)</Text>
            </Pressable>
          )}
        </>
      ) : (
        list.length > 0 && <Text style={styles.info}>Noch {MIN_FIGHTERS - list.length} mehr, dann ist die Rotation aktiv.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    paddingLeft: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '700' },
  remove: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.cardPressed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { color: colors.muted, fontSize: 20, fontWeight: '700' },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 20,
    fontWeight: '600',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.bg,
  },
  addBtn: {
    width: 56,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: '#04130A', fontSize: 30, fontWeight: '800', marginTop: -2 },
  pressed: { opacity: 0.7 },
  warn: { color: colors.warning, fontSize: 14, fontWeight: '600' },
  info: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  preview: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  cycleBtn: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cycleText: { color: colors.accent, fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
