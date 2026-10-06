# Biżufitting Experience — REPO

Wersja wykonawcza: **0.1.20-r8.16 candidate**.

Baza: zaakceptowana płynność `r8.14`, z poprawką jakości samego rysowania wordmarku. HOLD, matte, intro stains, assety i Story Camera pozostają bez zmian.

## r8.16 — writing quality
- finalny artwork SVG pozostaje bez zmian,
- 24 fazy i ich ownership clipy pozostają bez zmian,
- pełna okrągła kreska jest opóźniona względem pozycji pióra, a aktywny czubek prowadzi wąski round nib,
- ruch każdej fazy jest wyrównany według faktycznie odsłanianej powierzchni, więc powroty po już narysowanej kresce nie tworzą długich wizualnych postojów,
- każda faza domyka wyłącznie własne piksele w krótkim końcowym oknie,
- brak przełączenia `animated-artwork → final-lock` po 100%, więc znika końcowy snap.

## Timing
Wordmark: 6134.6 ms, start po 340 ms. Copy: 5200 / 6050 ms. CTA: 7850 ms.

Publikuj zawartość katalogu `REPO/`.
