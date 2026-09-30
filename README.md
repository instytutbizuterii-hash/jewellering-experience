# Biżufitting Experience

Wersja: **0.1.19.1**

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie

Projekt jest statyczny. Publikuj zawartość katalogu `REPO/` przez GitHub Pages / zwykły hosting statyczny.

## v0.1.19.1 — Intro Ink Decor Position + Black Ink

- baza: `v0.1.19`,
- zachowano assety dekoracji z frame 37 i frame 56 `ink-hold-atlas.png`,
- lewa plama pozostaje w lewym górnym obszarze, ale prawa wraca do **prawego dolnego obszaru** zgodnie z układem oryginalnych orbitów z `v0.1.16`,
- usunięto dodatkowe globalne `opacity` z dekoracji; plamy są renderowane jako czarne z naturalną alfą wynikającą z PNG,
- nowe PNG mają wersjonowane nazwy `*-v0.1.19.1.png`,
- lokalny CSS i JS są linkowane z `?v=0.1.19.1`,
- CTA → HOLD → matte → blackout pozostaje bez zmian,
- `HISTORIA / 01` i dalszy story pozostają poza zakresem tej wersji.

## Struktura

```text
REPO/
├── .gitignore
├── index.html
├── README.md
├── VERSION
├── assets/
│   ├── ink-decor/
│   │   ├── intro-ink-left-v0.1.19.1.png
│   │   └── intro-ink-right-v0.1.19.1.png
│   ├── ink-prelude/
│   │   └── ink-hold-atlas.png
│   └── ink-sprite/
│       ├── ink-matte-atlas-1.png
│       ├── ink-matte-atlas-2.png
│       ├── ink-matte-atlas-3.png
│       └── ink-matte-atlas-4.png
└── src/
    ├── app.js
    ├── hold-cta.js
    ├── matte-transition.js
    └── styles.css
```
