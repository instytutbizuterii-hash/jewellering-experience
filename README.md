# Biżufitting Experience

Wersja: **0.1.7**

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie

Projekt jest statyczny. Otwórz `index.html` lokalnie albo opublikuj zawartość katalogu `REPO/` przez GitHub Pages.

## v0.1.7 — Ink Transition System

- usunięto lewo→prawo jako wizualny progress przytrzymania,
- przytrzymanie buduje organiczny ink seed w środku CTA,
- po 100% uruchamia się jedna sekwencja Canvas 2D: splash → bleed/drips → flood → pełna czerń,
- blackout wejściowy wynika z tuszu; nie jest osobnym opacity fade'em,
- geometria splashy jest deterministyczna przez stały seed,
- Canvas ma DPR cap 2 i nie tworzy DOM particles,
- hold używa pointer capture, więc drobny ruch palca poza CTA nie anuluje gestu,
- po commit wejście jest jednokierunkowe i nie może uruchomić się drugi raz,
- `prefers-reduced-motion` omija intensywną animację tuszu i przechodzi spokojnie do pełnej czerni,
- prosty `.blackout` pozostał wyłącznie dla restartu.

## Struktura

```text
REPO/
├── .gitignore
├── index.html
├── README.md
├── VERSION
└── src/
    ├── app.js
    ├── ink-transition.js
    └── styles.css
```

Dokumentacja robocza nie należy do repozytorium produkcyjnego i znajduje się w `Outside_REPO/` paczki wydaniowej.
