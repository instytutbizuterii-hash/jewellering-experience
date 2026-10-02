# Biżufitting Experience

Wersja: **0.1.20** — build **r8.8**, cache token `0.1.20-r8.8`.

## r8.8 — Story Camera v1
Po blackoutcie użytkownik trafia bezpośrednio do jednej dużej, szkicowej sceny. Zamiast scrollowanej sekcji `HISTORIA / 01` działa teraz sterowana kamera z pięcioma zaplanowanymi punktami.

- jedna master scene: `assets/story/master-scene-v0.1.20-r8.8.webp`,
- 5 punktów kamery `01–05`,
- ruch `translate3d + scale`,
- nawigacja tylko przyciskiem — bez swipe i bez swobodnego panoramowania,
- stały dolny panel narracyjny z numerem, tytułem, placeholderem tekstu, postępem i CTA,
- panel wygasa na czas przejścia i wraca po zatrzymaniu kamery,
- ostatni punkt pozwala wrócić do `01` w celu testowania pełnej trasy.

Intro pozostaje z r8.7: oryginalny HOLD 24 klatki / 1000 ms, matte bez zmian oraz plamy `.94 → 1 / 8s`.

## Aktywna struktura runtime
```text
REPO/
├── index.html
├── src/
│   ├── app.js
│   ├── hold-cta.js
│   ├── matte-transition.js
│   └── styles.css
└── assets/
    ├── cta/
    │   └── hold-ink-atlas-v0.1.20-r6.png
    ├── intro-paper/
    │   ├── paper-fibers-v0.1.20-r8.png
    │   ├── intro-ink-details-v0.1.20-r8.3.png
    │   ├── intro-ink-full-left-v0.1.20-r8.2.webp
    │   └── intro-ink-full-right-v0.1.20-r8.2.webp
    ├── ink-sprite/
    │   ├── ink-matte-alpha-v0.1.20-r3-atlas-1.png
    │   ├── ink-matte-alpha-v0.1.20-r3-atlas-2.png
    │   ├── ink-matte-alpha-v0.1.20-r3-atlas-3.png
    │   └── ink-matte-alpha-v0.1.20-r3-atlas-4.png
    └── story/
        └── master-scene-v0.1.20-r8.8.webp
```

Publikuj zawartość `REPO/` przez GitHub Pages albo inny hosting statyczny.
