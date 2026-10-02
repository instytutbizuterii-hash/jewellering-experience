# Biżufitting Experience

Wersja: **0.1.20** — build r8.2, cache token `0.1.20-r8.2`.

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie
Projekt jest statyczny. Publikuj zawartość katalogu repo przez GitHub Pages / zwykły hosting statyczny.

## v0.1.20 r8.2 — pełne plamy intro + spójne pochodzenie matte
- dwie duże dekoracje intro są pełnymi, samodzielnymi plamami tuszu bez prostokątnych zakończeń,
- plamy są pozycjonowane środkiem (`x/y`) i dopiero viewport je kadruje, dzięki czemu nie widać krawędzi assetu,
- mobile używa `svh` także do pionowej pozycji plam, zgodnie z wysokością samego intro,
- wzrost plam `0.88 → 1.0 / 4.7 s` został zachowany, ale odbywa się wokół środka każdej plamy,
- niewidoczne originy blackoutu korzystają z tych samych współrzędnych co plamy intro,
- `intro-ink-details` i papier r8 pozostają bez zmian,
- każda pełna plama ma dodatkowy transparentny margines wewnątrz assetu, więc także dalekie odpryski nie kończą się na granicy pliku,
- preload wskazuje dokładnie aktywne pliki WebP,
- CTA HOLD, atlas blackoutu, timing przejścia i `matte-transition.js` pozostają funkcjonalnie bez zmian.

## Struktura
```text
REPO/
├── index.html
├── README.md
├── VERSION
├── assets/
│   ├── cta/              # 24-klatkowy atlas CTA HOLD
│   ├── intro-paper/      # papier + aktywne pełne plamy intro
│   ├── ink-decor/        # historyczne warianty dekoracji
│   ├── ink-prelude/      # historycznie; nie steruje bieżącym HOLD
│   └── ink-sprite/       # transparentne atlasy blackoutu
└── src/
    ├── app.js
    ├── hold-cta.js
    ├── matte-transition.js
    └── styles.css
```
