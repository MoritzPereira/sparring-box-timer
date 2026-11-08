/**
 * Sparring-Rotation: Wer boxt in welcher Runde gegen wen?
 *
 * Kreis-Verfahren (Round-Robin): Der erste Platz bleibt fest, alle anderen rücken pro Runde
 * eine Position weiter. Gepaart wird jeweils von außen nach innen (1. gegen Letzten, 2. gegen
 * Vorletzten …). So trifft innerhalb eines Zyklus jeder genau einmal auf jeden.
 * Bei ungerader Anzahl sitzt der feste Platz ein „Freilos“ – wer ihm gegenübersteht, hat Pause.
 * Dadurch setzt jeder genau einmal pro Zyklus aus, nie zweimal hintereinander.
 * Gibt es mehr Runden als ein Zyklus hat, beginnt die Rotation von vorn.
 */
import type { Preset } from './presets';

export const MIN_FIGHTERS = 3;
export const MAX_FIGHTERS = 12;

export type Bout = [string, string];
export type Pairing = { bouts: Bout[]; resting: string[] };

/** Namen säubern: trimmen, leere und doppelte (ohne Groß/Klein) entfernen. */
export function cleanFighters(names: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names ?? []) {
    const name = raw.trim();
    const key = name.toLocaleLowerCase('de');
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.slice(0, MAX_FIGHTERS);
}

/** Teilnehmer, wenn die Rotation aktiv ist (ab 3 Leuten), sonst null. */
export function rotationOf(p: Pick<Preset, 'fighters'>): string[] | null {
  const f = cleanFighters(p.fighters);
  return f.length >= MIN_FIGHTERS ? f : null;
}

/** Nach so vielen Runden hat jeder einmal gegen jeden geboxt. */
export function cycleLength(count: number): number {
  return count % 2 === 0 ? count - 1 : count;
}

/** Paarungen für Runde `round` (1-basiert). */
export function pairingFor(fighters: readonly string[], round: number): Pairing {
  const slots: (string | null)[] = fighters.length % 2 === 1 ? [null, ...fighters] : [...fighters];
  const m = slots.length;
  if (m < 2) return { bouts: [], resting: [...fighters] };

  const k = (round - 1) % (m - 1);
  const moving = slots.slice(1);
  const rotated = [...moving.slice(moving.length - k), ...moving.slice(0, moving.length - k)];
  const order = [slots[0], ...rotated];

  const bouts: Bout[] = [];
  const resting: string[] = [];
  for (let i = 0; i < m / 2; i++) {
    const a = order[i];
    const b = order[m - 1 - i];
    if (a === null) resting.push(b!);
    else if (b === null) resting.push(a);
    else bouts.push([a, b]);
  }
  return { bouts, resting };
}

/** Kurzform für Mitteilungen: „Perry vs. Kai · Tobi vs. Jonas · Pause: Micha“ */
export function pairingText(p: Pairing): string {
  const parts = p.bouts.map(([a, b]) => `${a} vs. ${b}`);
  if (p.resting.length) parts.push(`Pause: ${p.resting.join(', ')}`);
  return parts.join(' · ');
}

/** Text für die Sprachansage – ein fließender Satz statt vieler kurzer (klingt weniger abgehackt). */
export function pairingSpeech(p: Pairing, round: number): string {
  const bouts = p.bouts.map(([a, b]) => `${a} gegen ${b}`).join(', ');
  const rest = p.resting.length ? ` – ${p.resting.join(' und ')} ${p.resting.length > 1 ? 'haben' : 'hat'} Pause` : '';
  return `Runde ${round}: ${bouts}${rest}.`;
}
