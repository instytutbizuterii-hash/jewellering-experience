# Biżufitting Experience

Wersja: **0.1.20**

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie

Projekt jest statyczny. Publikuj zawartość katalogu `REPO/` przez GitHub Pages / zwykły hosting statyczny.

## v0.1.20 — Dual-source ink story

- baza: `v0.1.19.1`,
- plamy intro startują w skali `0.88` i przez ok. `4.7 s` bardzo powoli rosną do obecnej skali 1.0,
- wzrost startuje razem z handwritingiem; przy typowym preloadzie kończy się tuż przed pojawieniem CTA,
- CTA nadal jest triggerem HOLD, ale nie jest już geometrycznym originem obrazu,
- podczas HOLD statyczne plamy są bezszwowo zastępowane ich dynamicznymi kopiami,
- lewa plama z lewego górnego i prawa z prawego dolnego obszaru poruszają się do środka viewportu,
- od `42%` HOLD w środku zaczyna rozwijać się istniejący 60-klatkowy prelude,
- około końcówki HOLD źródła są absorbowane przez centralną masę tuszu,
- `100% HOLD` kończy się na prelude frame 60, a COMMIT kontynuuje istniejący full matte bez resetu,
- cancel przewija całą dwupunktową choreografię z powrotem,
- restart ponownie uruchamia powolny wzrost plam intro,
- `hold-cta.js` i wszystkie atlasy pozostały niezmienione,
- copy i dalsza `HISTORIA / 01` pozostają poza zakresem tej wersji.

## Struktura

```text
REPO/
├── .gitignore
├── index.html
├── README.md
├── VERSION
├── assets/
│   ├── ink-decor/
│   │   ├── intro-ink-left-v0.1.20.png
│   │   └── intro-ink-right-v0.1.20.png
│   ├── ink-prelude/
│   │   └── ink-hold-atlas.png
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
