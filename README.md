# Biżufitting Experience

Wersja: **0.1.10**

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie

Projekt jest statyczny. Otwórz `index.html` lokalnie albo opublikuj zawartość katalogu `REPO/` przez GitHub Pages.

## v0.1.10 — Continuous Ink Flow

- zachowano CTA hold, perimeter progress, splash flight/impact, wordmark, intro, historię i restart z v0.1.9,
- usunięto skokowe `MASS_GROW_STEPS` i `MASS_BLEED_STEPS`,
- wzrost plam jest odkładany do persistent buffer według **przebytego dystansu krawędzi**, a nie stałej liczby etapów,
- gravity flow korzysta z ciągłych trajektorii i distance-based deposition zamiast uruchamianych kolejno segmentów,
- przepływ ma ciągłą, lekko nieregularną trajektorię bez zależności od FPS,
- usunięto sztuczne cross-cluster bridge lines; łączenie wynika przede wszystkim z overlap wspólnej masy,
- regularny coverage 4×4 zastąpiono kilkoma dużymi, nieregularnymi frontami startującymi częściowo poza viewportem,
- finalny black snap pozostaje wyłącznie technicznym domknięciem po realnym pokryciu ekranu,
- renderer pozostaje Canvas 2D + persistent buffer + seeded PRNG (`seed: 1808`) + DPR cap 2,
- bez `Math.random()` w render loop i bez per-pixel full-screen processing.

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
