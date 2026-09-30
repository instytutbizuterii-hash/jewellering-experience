# Biżufitting Experience

Wersja: **0.1.17**

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie

Projekt jest statyczny. Publikuj zawartość katalogu `REPO/` przez GitHub Pages / zwykły hosting statyczny.

## v0.1.17 — CTA → Matte Continuity

- usunięto poprzedni pill / pulse / halo CTA,
- CTA jest lekką typografią z ręcznie rysowaną kreską,
- 2-sekundowy HOLD steruje 60-klatkowym początkiem matte,
- COMMIT nie restartuje efektu: po HOLD przechodzimy bezpośrednio do pełnej klatki 8,
- dalsze 50 klatek używa niezmienionych czterech atlasów matte z v0.1.13,
- cancel cofa prelude zamiast gwałtownie usuwać plamę,
- origin tuszu ma osobny anchor i nie zależy od środka prostokąta buttona,
- `HISTORIA / 01` i dalszy story pozostają bez zmian.

## Struktura

```text
REPO/
├── .gitignore
├── index.html
├── README.md
├── VERSION
├── assets/
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
