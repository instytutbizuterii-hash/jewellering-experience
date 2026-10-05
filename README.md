# Biżufitting Experience

Wersja: **0.1.20** — build **r8.10**, cache token `0.1.20-r8.10`.

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## r8.10 — nowy kaligraficzny wordmark + prawdziwe rysowanie maską
- stary ręcznie zbudowany SVG napisu został zastąpiony nowym kaligraficznym wariantem dostarczonym przez użytkownika,
- dokładny wygląd pędzla jest zachowany jako przezroczysty artwork PNG osadzony wewnątrz SVG, zamiast agresywnej autowektoryzacji,
- animacja nadal jest wektorowa: 14 ścieżek maski + 4 punkty prowadzą kolejność pisania od lewej do prawej,
- istniejący mechanizm `getTotalLength()` / `strokeDashoffset` w `app.js` został zachowany, więc napis jest faktycznie odsłaniany po ścieżkach, a nie przez wipe lub opacity,
- finalna maska odsłania 100% pikseli artworku przy `progress = 1`,
- r8.9 Story Camera, HOLD, blackout i intro `.94 → 1 / 8s` pozostają funkcjonalnie bez zmian.

## r8.9 — smooth story reveal + camera
- końcówka blackoutu nie odcina już sceny: po pełnej czerni działa miękki `900 ms` reveal do Master Scene,
- czarna warstwa podtrzymuje pełną czerń między końcem matte a początkiem sceny, więc nie ma pojedynczej klatki z nagłym obrazem,
- ruch Story Camera został zwolniony z `820 ms` do `1280 ms` i ma łagodniejszy easing `cubic-bezier(.45,0,.20,1)`,
- pozycje i zoom wszystkich 5 punktów kamery są bez zmian,
- dolny panel nie przesuwa już tekstu w pionie; stara i nowa treść zmieniają się wyłącznie przez opacity,
- HOLD pozostaje 24-klatkowy / 1000 ms, a intro `.94 → 1 / 8s`.

## Runtime
Publikuj zawartość katalogu `REPO/` przez GitHub Pages lub zwykły hosting statyczny.
