# Biżufitting Experience

Wersja: **0.1.20** — build **r8.5**, cache token `0.1.20-r8.5`.

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## v0.1.20 r8.5 — 48 klatek HOLD CTA + cleanup runtime
- animacja HOLD CTA została rozbudowana z 24 do 48 klatek i nadal trwa pełne `2000 ms`,
- sekwencja HOLD używa teraz dwóch atlasów po 24 klatki: `hold-ink-atlas-v0.1.20-r8.5-1.png` i `hold-ink-atlas-v0.1.20-r8.5-2.png`,
- rozwój tuszu jest rozciągnięty na cały czas przytrzymania, dzięki czemu nie zamiera wizualnie po około `0.7 s`,
- `src/app.js` przełącza atlas po klatce 24 i mapuje progres liniowo na 48 realnych stanów,
- subtelne skalowanie dużych plam intro z r8.4 pozostaje bez zmian,
- stare `hold-ink-atlas-v0.1.20-r6.png` zostało usunięte z aktywnego runtime.

## Aktywna struktura runtime
```text
REPO/
├── index.html
├── src/
│   ├── app.js
│   ├── hold-cta.js
│   ├── matte-transition.js
│   └── styles.css
└── assets/
    ├── cta/
    │   ├── hold-ink-atlas-v0.1.20-r8.5-1.png
    │   └── hold-ink-atlas-v0.1.20-r8.5-2.png
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

## Uruchomienie
Projekt jest statyczny. Publikuj zawartość katalogu `REPO/` przez GitHub Pages / zwykły hosting statyczny.
