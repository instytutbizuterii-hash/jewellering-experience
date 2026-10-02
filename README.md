# Biżufitting Experience

Wersja: **0.1.20** — build r8.3, cache token `0.1.20-r8.3`.

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie
Projekt jest statyczny. Publikuj zawartość katalogu repo przez GitHub Pages / zwykły hosting statyczny.

## v0.1.20 r8.3 — poprawka tła detali + pełne plamy intro
- dwie duże dekoracje intro są pełnymi, samodzielnymi plamami tuszu bez prostokątnych zakończeń,
- plamy są pozycjonowane środkiem (`x/y`) i dopiero viewport je kadruje, dzięki czemu nie widać krawędzi assetu,
- mobile używa `svh` także do pionowej pozycji plam, zgodnie z wysokością samego intro,
- wzrost plam `0.88 → 1.0 / 4.7 s` został zachowany, ale odbywa się wokół środka każdej plamy,
- niewidoczne originy blackoutu korzystają z tych samych współrzędnych co plamy intro,
- `intro-ink-details` otrzymał korektę prawej uciętej kropki/plamy i usuwa widoczny artefakt przy krawędzi ekranu,
- każda pełna plama ma dodatkowy transparentny margines wewnątrz assetu, więc także dalekie odpryski nie kończą się na granicy pliku,
- preload wskazuje dokładnie aktywne pliki WebP,
- papierowe tło r8 pozostaje bez zmian; poprawka dotyczy wyłącznie warstwy drobnych detali tuszu,
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
