# Biżufitting Experience

Wersja: **0.1.11**

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie

Projekt jest statyczny. Otwórz `index.html` lokalnie albo opublikuj zawartość katalogu `REPO/` przez GitHub Pages.

## v0.1.11 — Unified Ink Field / Connected Saturation

- zachowano bez zmian CTA hold, perimeter progress, splash flight/impact, wordmark, intro, historię i restart z v0.1.10,
- usunięto osobny `createCoverageMasses()` oraz niezależne blackoutowe masy coverage,
- flow, merge i pełne zakrycie ekranu korzystają teraz z **jednego persistent Ink Field**,
- późny wzrost tuszu powstaje wyłącznie z istniejących impact masses przez connected expansion,
- każdy frontier startuje wewnątrz istniejącej masy i odkłada kolejne organiczne lobes z realnym overlapem,
- siły przechodzą płynnie od gravity-dominant flow do lateral spread / hole seeking bez przełączenia renderera,
- dodano lekki analityczny coverage tracker na coarse gridzie; brak full-resolution `getImageData()` w render loop,
- `COVERED` wynika z geometrycznego gate: wysokie realne pokrycie + brak dużej jasnej wyspy,
- fixed watchdog pozostaje wyłącznie fail-safe; normalny przebieg kończy się przez gate geometryczny,
- finalny `fillRect` pozostaje tylko technicznym snapem po praktycznie pełnym pokryciu,
- renderer pozostaje Canvas 2D + persistent buffer + seeded PRNG (`seed: 1808`) + DPR cap 2,
- brak `Math.random()` w render loop i brak osobnego opacity blackout layer.

## Struktura

```text
REPO/
├── .gitignore
├── index.html
├── README.md
├── VERSION
└── src/
    ├── app.js
    ├── hold-cta.js
    ├── ink-transition.js
    └── styles.css
```

Dokumentacja robocza, audyty i materiały QA należą wyłącznie do `Outside_REPO/` paczki wydaniowej.
