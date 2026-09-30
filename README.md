# Biżufitting Experience

Wersja: **0.1.19**

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie

Projekt jest statyczny. Publikuj zawartość katalogu `REPO/` przez GitHub Pages / zwykły hosting statyczny.

## v0.1.19 — Intro Ink Decor / Cache Safety

- odrzucono duet dekoracji v0.1.18 oparty na frame 18 + 25,
- nowe narożniki pochodzą z frame 37 i frame 56 `ink-hold-atlas.png`,
- dekoracje nie są elementami HTML; renderują się przez `.intro::before` / `.intro::after`,
- nowe PNG mają wersjonowane nazwy,
- lokalny CSS i JS są linkowane z `?v=0.1.19`,
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
│   │   ├── intro-ink-left-v0.1.19.png
│   │   └── intro-ink-right-v0.1.19.png
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
