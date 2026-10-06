# Biżufitting Experience

Wersja wykonawcza: **0.1.20-r8.14 candidate**.

Baza tej paczki: przesłany `r8.13 Stage 4 choreography`. Kandydat r8.14 zmienia wyłącznie mechanizm animacji wordmarku oraz token wersji. HOLD, matte, intro stains, assety i Story Camera pozostają bez zmian.

## r8.14 — smooth wordmark
- `real-pen-v3` zamiast runtime `real-pen-v2`,
- 24 fazy i ich timing pozostają bez zmian,
- 24 osobne maski/warstwy artworku zastąpione jedną maską i jednym renderem final-artwork,
- każda faza nadal jest ograniczona swoim `own-*` clipem,
- centerline wygładzony: RDP `0.75 px` + krzywe quadratic,
- round linecap/linejoin podczas aktywnego ruchu,
- fazy jeszcze nierozpoczęte są całkowicie ukryte,
- animator pomija DOM writes dla faz, których progress się nie zmienia,
- po zakończeniu nadal następuje exact `final-lock`.

## Timing intro
Wordmark start `340 ms`, długość osi `6134.6 ms`, copy `5200 / 6050 ms`, CTA `7850 ms`. HOLD, matte i Story Camera bez zmian względem r8.13.

Przed uznaniem r8.14 za bazę wymagany jest test płynności na prawdziwym telefonie. Publikuj zawartość katalogu `REPO/`.
