# Biżufitting Experience

Wersja: **0.1.20** — build r6, cache token `0.1.20-r6`.

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie
Projekt jest statyczny. Publikuj zawartość katalogu `REPO/` przez GitHub Pages / zwykły hosting statyczny.

## v0.1.20 r6 — CTA HOLD atlas + autonomous fixed-origin blackout
- plamy intro startują w skali `0.88` i bardzo powoli rosną do `1.0`,
- CTA pozostaje triggerem HOLD,
- HOLD nie uruchamia ani nie scrubuje blackoutu,
- CTA HOLD korzysta z **24-klatkowego atlasu mokrego tuszu** (`6 × 4`, `768 × 176` na klatkę),
- efekt ma ciężki środek pod palcem, organiczny bleed i odpryski widoczne po obu stronach palca,
- anulowanie HOLD resetuje tylko CTA,
- pełny HOLD blokuje finalną klatkę i uruchamia niezależny blackout `57` klatek / `2000 ms` / gamma `3.2`,
- po commit puszczenie palca nie wpływa na blackout,
- obie duże plamy pozostają na stałych pozycjach,
- matte ma prawdziwą przezroczystość; nie ma białej planszy,
- frame `43+` blackoutu jest pełną czernią; pod nim montuje się `HISTORIA / 01`,
- `hold-cta.js` pozostaje niezmieniony.

## Struktura
```text
REPO/
├── index.html
├── README.md
├── VERSION
├── assets/
│   ├── cta/              # 24-klatkowy atlas CTA HOLD
│   ├── ink-decor/
│   ├── ink-prelude/      # historycznie; nie steruje bieżącym HOLD
│   └── ink-sprite/       # transparentne atlasy blackoutu
└── src/
    ├── app.js
    ├── hold-cta.js
    ├── matte-transition.js
    └── styles.css
```
