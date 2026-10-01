# Biżufitting Experience

Wersja: **0.1.20** — corrected build r3, cache token `0.1.20-r3`.

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie
Projekt jest statyczny. Publikuj zawartość katalogu `REPO/` przez GitHub Pages / zwykły hosting statyczny.

## v0.1.20 r3 — CTA HOLD + autonomous fixed-origin blackout
- plamy intro startują w skali `0.88` i przez ok. `4.7 s` bardzo powoli rosną do skali `1.0`,
- CTA pozostaje triggerem HOLD,
- podczas HOLD główna animacja blackoutu **nie startuje**; reaguje tylko ręcznie rysowana kreska CTA,
- anulowanie HOLD cofa tylko feedback CTA,
- pełny HOLD uruchamia niezależną animację blackoutu: `57` klatek / `2000 ms` / gamma `3.2`,
- po commit późniejsze puszczenie palca nie wpływa na animację,
- obie plamy pozostają na stałych pozycjach: lewy górny i prawy dolny obszar,
- blackout rośnie z dwóch stałych originów i naturalnie łączy się przez ekspansję,
- runtime matte ma prawdziwą przezroczystość; intro pozostaje widoczne tam, gdzie nie dotarł tusz,
- brak centralnego `mergeOrigin`, trzeciej plamy, białej planszy i zależności od `mix-blend-mode:multiply`,
- frame `43+` jest pełną czernią; pod nim montuje się `HISTORIA / 01`,
- `hold-cta.js` pozostaje niezmieniony.

## Struktura
```text
REPO/
├── index.html
├── README.md
├── VERSION
├── assets/
│   ├── ink-decor/
│   ├── ink-prelude/      # historycznie; nie steruje bieżącym HOLD
│   └── ink-sprite/       # transparentne atlasy obecnego blackoutu
└── src/
    ├── app.js
    ├── hold-cta.js
    ├── matte-transition.js
    └── styles.css
```
