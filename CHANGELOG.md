# Changelog

Alle wesentlichen Änderungen am Sparring Timer (bis v1.0.0 „Box-Timer“). Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach [SemVer](https://semver.org/lang/de/).

## [Unreleased]

### Geändert
- Name jetzt **Sparring Box Timer** (auf dem Homescreen „Sparring Timer“)
- Neues App-Icon: roter Boxhandschuh im rot-blauen Ring (rote und blaue Ecke)

## [1.1.0] – 2026-11-08

### Geändert
- Neuer Name **Sparring Timer** und neues App-Icon
- Nur noch iPhone (kein iPad-Layout im Store)

### Neu: Sparring-Rotation
- Teilnehmer pro Preset eintragen (3–12 Namen)
- Rundeneinteilung nach dem Round-Robin-Verfahren: jeder boxt einmal gegen jeden, bei ungerader Anzahl setzt jede Runde ein anderer aus – nie zweimal hintereinander
- Vorbereitung und Pause zeigen groß die Paarungen der nächsten Runde, während der Runde stehen die aktuellen Paarungen unter der Uhr
- Sprachansage der Paarungen nach der Glocke („Runde 2: Perry gegen Kai …“); läuft bei Pause zu Ende
- Lautsprecher-Knopf oben rechts im Timer schaltet die Ansage an/aus (bleibt gespeichert)
- Mitteilungen bei gesperrtem Handy nennen die Paarungen
- Editor: Vorschau der ersten Runde und „Runden auf N setzen (jeder gegen jeden)“

## [1.0.0] – 2026-11-06

Erste vollständige Version des MVP aus dem [Konzept](docs/KONZEPT.md), auf dem iPhone (Expo Go) getestet.

### Funktionen
- Home mit eigenen Presets und Vorlagen (Amateur, Sparring, Profi, MMA)
- Presets anlegen, bearbeiten, löschen: Runden, Rundenzeit, Pause, Vorbereitung, Hinweiszeit
- Vollbild-Timer mit Farbcodes (Vorbereitung grau, Runde grün, letzte Sekunden orange, Pause blau) und Rundenanzeige
- Handschuh-Modus: Tippen = Pause/Weiter, Halten = Beenden
- Display bleibt während des Timers an
- Signale: helle Glocke zum Rundenstart, tiefe Glocke zum Rundenende, Klack-Klack 10 s vor Rundenende und vor Rundenstart
- Glocke wird über laufende Musik gelegt, Vibration bei jedem Signal
- Signale bei gesperrtem Handy über lokale Mitteilungen
- Timer-Logik über vorausberechnete Zeitstempel (driftfrei)

[Unreleased]: https://github.com/MoritzPereira/box-timer/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/MoritzPereira/box-timer/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/MoritzPereira/box-timer/releases/tag/v1.0.0
