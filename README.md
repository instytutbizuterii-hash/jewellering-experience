# Biżufitting Experience

Wersja: **0.1.6**

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie

Projekt jest statyczny. Otwórz `index.html` lokalnie albo opublikuj zawartość katalogu `REPO/` przez GitHub Pages.

## v0.1.6 — handwriting rebuild

- aktualna nazwa klient-facing: `Biżufitting`,
- nowy, dedykowany wordmark SVG zbudowany jako bezpośrednie ścieżki pisma,
- widoczna kreska i trajektoria animacji są tą samą geometrią — brak maski udającej drogę pióra,
- brak runtime pomiaru fontu, bboxów znaków i generowania geometrii liter,
- kropki `i` / `ż` mają stałe współrzędne wewnątrz tego samego SVG i są odsłaniane jako krótkie ruchy wtórne,
- poprzeczki `f` / `t` są częścią tej samej sekwencji pisania,
- intro pozostaje wycentrowane przez `width: 100%` + `max-width`, bez korekcyjnych offsetów,
- hold CTA, particles, blackout, dark opening, scroll story i restart zachowują dotychczasowy fundament.

## Struktura

```text
REPO/
├── .gitignore
├── index.html
├── README.md
├── VERSION
└── src/
    ├── app.js
    └── styles.css
```

Dokumentacja robocza nie należy do repozytorium produkcyjnego i znajduje się w `Outside_REPO/` paczki wydaniowej.
