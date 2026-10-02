# Biżufitting Experience

Wersja: **0.1.20** — build **r8.6**, cache token `0.1.20-r8.6`.

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## r8.6 — finalne 48 klatek HOLD + dostrojenie intro
- baza wykonawcza: czyste `r8.4`; odrzucone eksperymenty `r8.5.x` nie są bazą tej paczki,
- klatki HOLD **1–24** są oryginalnym atlasem r6 bez zmian pikselowych,
- klatki **25–48** są zaakceptowaną kontynuacją tej samej plamy,
- HOLD nadal trwa `2000 ms`; renderer obsługuje 48 klatek w dwóch atlasach 6×4,
- oba atlasy są preloadowane; ścieżki runtime są liczone bezpiecznie względem `document.baseURI`,
- duże plamy intro zmieniono zgodnie z ustaleniem z `.975 → 1 / 12s` na **`.94 → 1 / 8s`**,
- matte blackout i handoff do `HISTORIA / 01` pozostają bez zmian.

## Aktywne assety runtime
```text
assets/
├── cta/
│   ├── hold-ink-atlas-v0.1.20-r8.6-1.png   # klatki 1–24
│   └── hold-ink-atlas-v0.1.20-r8.6-2.png   # klatki 25–48
├── intro-paper/
│   ├── paper-fibers-v0.1.20-r8.png
│   ├── intro-ink-details-v0.1.20-r8.3.png
│   ├── intro-ink-full-left-v0.1.20-r8.2.webp
│   └── intro-ink-full-right-v0.1.20-r8.2.webp
└── ink-sprite/
    ├── ink-matte-alpha-v0.1.20-r3-atlas-1.png
    ├── ink-matte-alpha-v0.1.20-r3-atlas-2.png
    ├── ink-matte-alpha-v0.1.20-r3-atlas-3.png
    └── ink-matte-alpha-v0.1.20-r3-atlas-4.png
```

Publikuj zawartość katalogu `REPO/` przez GitHub Pages / zwykły hosting statyczny.
