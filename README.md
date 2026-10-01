# Biżufitting Experience

Wersja: **0.1.20** — corrected candidate, cache token `0.1.20-r2`.

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie
Projekt jest statyczny. Publikuj zawartość katalogu `REPO/` przez GitHub Pages / zwykły hosting statyczny.

## v0.1.20 — fixed-origin dual-source blackout
- baza funkcjonalna: `v0.1.19.1`,
- plamy intro startują w skali `0.88` i przez ok. `4.7 s` bardzo powoli rosną do skali `1.0`,
- CTA nadal jest triggerem HOLD,
- obie plamy pozostają na swoich pozycjach: lewy górny i prawy dolny obszar,
- podczas HOLD żadna plama nie jest przesuwana,
- blackout rośnie z dwóch stałych originów przy użyciu istniejących full-matte atlasów,
- dwa pola tuszu nakładają się i naturalnie tworzą jedną czarną masę,
- brak centralnego `mergeOrigin`, trzeciej plamy i resetu do środka,
- `100% HOLD` = pełna czerń; pod nią montuje się `HISTORIA / 01`,
- cancel przewija efekt do początku bez zmiany geometrii,
- `hold-cta.js`, `app.js`, dekoracje i cztery full-matte atlasy pozostały bez zmian względem wejściowej v0.1.20,
- stary `ink-hold-atlas.png` pozostaje w paczce historycznie, ale corrected runtime HOLD go nie używa.

## Struktura
```text
REPO/
├── index.html
├── README.md
├── VERSION
├── assets/
│   ├── ink-decor/
│   ├── ink-prelude/      # legacy/currently unused by HOLD
│   └── ink-sprite/       # current dual-source matte source
└── src/
    ├── app.js
    ├── hold-cta.js
    ├── matte-transition.js
    └── styles.css
```
