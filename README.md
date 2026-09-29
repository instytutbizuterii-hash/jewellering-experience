# Biżufitting Experience

Wersja: **0.1.12**

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie

Projekt jest statyczny. Otwórz `index.html` lokalnie albo opublikuj zawartość katalogu `REPO/` przez GitHub Pages.

## v0.1.12 — Narrative Ink Matte / CTA-to-History Reset

- zachowano intro, SVG handwriting `Biżufitting`, copy oraz dalszą część scroll story,
- całkowicie usunięto runtime Canvas Ink Field z v0.1.7–v0.1.11,
- usunięto `src/ink-transition.js` i `canvas#inkTransition`,
- wejście do historii korzysta teraz z jednego art-directed black-on-white matte video,
- matte jest lokalnym MP4/H.264 900×900, 30 fps, 1.9 s, bez audio,
- matte startuje dokładnie ze środka CTA i skaluje się do najdalszego narożnika viewportu,
- kompozycja używa `mix-blend-mode:multiply`, więc biel pozostaje neutralna, a czerń pochłania intro,
- `hold-cta.js` ma uproszczony state machine: `IDLE → HOLDING → COMMITTED`, bez osobnego completion delay,
- po near-black historii montuje się pod matte; podmiana intro → historia odbywa się pod pełną czernią,
- matte kończy się na czerni, a ta sama czerń jest pierwszym kadrem historii,
- pierwsze elementy historii pojawiają się dopiero po krótkiej pauzie narracyjnej,
- `video.play()` ma fallback do prostego radialnego przejścia,
- `prefers-reduced-motion` pomija ruch matte i przechodzi bezpośrednio do czarnej sceny,
- restart pozostaje osobnym neutralnym blackoutem.

## Struktura

```text
REPO/
├── .gitignore
├── index.html
├── README.md
├── VERSION
├── assets/
│   └── ink-matte.mp4
└── src/
    ├── app.js
    ├── hold-cta.js
    ├── matte-transition.js
    └── styles.css
```

Dokumentacja robocza, audyty, QA i materiały historyczne należą wyłącznie do `Outside_REPO/` paczki wydaniowej.
