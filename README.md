# Biżufitting Experience

Wersja: **0.1.15**

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie

Projekt jest statyczny. Otwórz `index.html` lokalnie albo opublikuj zawartość katalogu `REPO/` przez GitHub Pages.

## v0.1.15 — CTA Hold Soft Pulse Refinement

- spowolniono hold z **1280 ms do 1800 ms**,
- zamiast szybkich 3.5 cyklu zastosowano **3 spokojniejsze narastające wyjścia** z ostatnim maksimum przy commit,
- usunięto ostry czarny obrys CTA podczas hold,
- usunięto rysowany SVG progress-outline; feedback hold jest teraz wyłącznie miękką pulsacją,
- puls jest czarny, ale renderowany przez rozmyte warstwy z `filter: blur(...)`, więc nie ma ostrych krawędzi,
- kolejne wyjścia pulsu mają większy zasięg i większą gęstość,
- samo CTA skaluje się tylko minimalnie; główny ruch odbywa się w rozmytym halo,
- transition sprite z v0.1.13 pozostaje bez zmian.

## v0.1.14 — CTA Hold Pulse Refinement

- zachowano całe przejście sprite z **v0.1.13** bez zmian,
- w czasie hold CTA dodano **narastającą pulsację przód → tył → przód → tył**,
- kolejne wyjścia pulsu są stopniowo większe, zamiast wracać do identycznej amplitudy,
- zewnętrzny obrys/halo wychodzi coraz dalej wraz z postępem hold,
- samo CTA wykonuje tylko subtelne powiększenie, aby efekt był czytelny, ale nadal elegancki,
- progres obrysu został lekko wzmocniony,
- anulowanie hold resetuje puls i wszystkie parametry wizualne do stanu początkowego,
- `prefers-reduced-motion` zachowuje progres hold, ale wyłącza pulsacyjny ruch.

## v0.1.13 — Sprite Ink Matte Integration

- zachowano bazę przejścia z **v0.1.12**: CTA → tusz od środka → pełna czerń → wejście do historii,
- usunięto produkcyjne użycie `assets/ink-matte.mp4`,
- wdrożono zatwierdzony asset **Biżufitting Ink Sprite Candidate v1**,
- przejście działa teraz na **57 lossless klatkach PNG / 30 fps** zamiast pojedynczego MP4,
- sprite jest rozłożony na **4 atlasy 4500×2700** i renderowany jako sekwencja tła,
- zachowano origin startu dokładnie z centrum CTA,
- zachowano near-black cue montujący historię pod matte,
- zachowano fallback radialny oraz reduced-motion,
- nie zmieniano intro, copy, handwriting ani dalszej części scroll story.

## Struktura

```text
REPO/
├── .gitignore
├── index.html
├── README.md
├── VERSION
├── assets/
│   └── ink-sprite/
│       ├── ink-matte-atlas-1.png
│       ├── ink-matte-atlas-2.png
│       ├── ink-matte-atlas-3.png
│       └── ink-matte-atlas-4.png
└── src/
    ├── app.js
    ├── hold-cta.js
    ├── matte-transition.js
    └── styles.css
```

Dokumentacja robocza, QA i materiały przekazane przez użytkownika należą wyłącznie do `Outside_REPO/` paczki wydaniowej.
