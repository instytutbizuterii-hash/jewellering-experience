# Biżufitting Experience

Wersja: **0.1.9**

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie

Projekt jest statyczny. Otwórz `index.html` lokalnie albo opublikuj zawartość katalogu `REPO/` przez GitHub Pages.

## v0.1.9 — Ink Merge / Gravity Refinement

- zachowano CTA hold, perimeter progress, splash flight i impact z v0.1.8,
- usunięto model dripów `moving head + thin trail`,
- po impact kropla staje się częścią trwałej masy tuszu,
- spływanie powstaje przez dokładanie zachodzących na siebie lobes pod istniejącą masą,
- lokalne połączenia są szerokie i pozostają w persistent ink buffer,
- sąsiednie obszary łączą się przez wspólną geometrię zamiast poruszających się „główek”,
- coverage korzysta z tego samego modelu masy, bez globalnego fade do czerni,
- finalny snap do idealnej czerni występuje dopiero po faktycznym pokryciu ekranu,
- renderer pozostaje deterministyczny (`seed: 1808`), time-based i ma DPR cap = 2,
- `hold-cta.js`, wordmark `Biżufitting`, intro, historia oraz restart nie zostały przebudowane.

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
