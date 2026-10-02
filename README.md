# Biżufitting Experience

Wersja: **0.1.20** — build **r8.5.2**, cache token `0.1.20-r8.5.2`.

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## r8.5.2 — poprawiona druga połowa HOLD CTA
- HOLD nadal trwa `2000 ms` i używa 48 klatek,
- klatki 1–24 pozostają bez zmian,
- klatki 25–48 są teraz faktycznym rozwinięciem tuszu: plama delikatnie rośnie, pojawiają się nowe mokre obrzeża, drobne odpryski i odnogi,
- druga połowa nie jest już kopią końcowej klatki pierwszego atlasu,
- atlasy są rozdzielone na dwa pliki po 24 klatki i oba preloadowane,
- mechanizm przejścia do `HISTORIA / 01`, matte i czas HOLD pozostają bez zmian.

## Aktywne atlasy HOLD
```text
assets/cta/hold-ink-atlas-v0.1.20-r8.5.2-1.png  # klatki 1–24
assets/cta/hold-ink-atlas-v0.1.20-r8.5.2-2.png  # klatki 25–48
```

## Uruchomienie
Publikuj zawartość katalogu `REPO/` przez GitHub Pages / zwykły hosting statyczny.
