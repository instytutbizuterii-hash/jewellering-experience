# Biżufitting Experience

Wersja: **0.1.18**

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie

Projekt jest statyczny. Publikuj zawartość katalogu `REPO/` przez GitHub Pages / zwykły hosting statyczny.

## v0.1.18 — Intro Ink Language

- usunięto dekoracyjne okręgi `intro-orbit` i okrągłe rozświetlenie z prawego górnego obszaru intro,
- dodano dwa statyczne, organiczne ślady tuszu w górnych narożnikach,
- ślady pochodzą bezpośrednio z wczesnych klatek tego samego `ink-hold-atlas.png`, który reaguje podczas HOLD,
- dekoracje są osobnymi lekkimi PNG z przezroczystością i nie są powiązane z rendererem HOLD,
- CTA → HOLD → matte → blackout z v0.1.17 pozostaje bez zmian,
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
│   │   ├── intro-ink-left.png
│   │   └── intro-ink-right.png
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

Dokumentacja, QA i historia znajdują się wyłącznie w `Outside_REPO/` paczki wydaniowej.
