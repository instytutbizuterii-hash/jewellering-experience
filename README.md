# Biżufitting Experience

Wersja: **0.1.8**

Interaktywne, mobile-first doświadczenie **Biżufitting** uruchamiane głównie przez NFC.

## Uruchomienie

Projekt jest statyczny. Otwórz `index.html` lokalnie albo opublikuj zawartość katalogu `REPO/` przez GitHub Pages.

## v0.1.8 — CTA Hold + Ink Physics Rebuild

- feedback przytrzymania został oddzielony od renderera tuszu,
- CTA pokazuje postęp po obwodzie: dwie ścieżki SVG rosną symetrycznie od dolnego środka,
- ink seed pod palcem został całkowicie usunięty,
- pointer capture, cancel przed 100% oraz jednokierunkowy commit zostały zachowane,
- tusz zaczyna się dopiero po domknięciu CTA i krótkim completion pulse,
- splash ma rzeczywistą fazę lotu: projectile → impact → trwały ślad,
- renderer używa persistent ink buffer, więc plamy, bleed i drips naprawdę akumulują się w czasie,
- drips odkładają ślad segment po segmencie zamiast skalować gotową linię,
- końcowe pokrycie powstaje z wielu organicznych frontów wyrastających z istniejących plam,
- usunięto progresywny pełnoekranowy `fillRect` używany w v0.1.7 jako imitacja blackout,
- finalny snap do idealnej czerni następuje dopiero po wizualnym pokryciu viewportu,
- seed QA: `1808`, DPR cap: `2`, brak `Math.random()` w render loop,
- `prefers-reduced-motion` zachowuje hold, ale pomija intensywną fizykę tuszu.

## Struktura

```text
REPO/
├── .gitignore
├── index.html
├── README.md
├── VERSION
└── src/
    ├── app.js
    ├── hold-cta.js
    ├── ink-transition.js
    └── styles.css
```

Dokumentacja robocza, audyty i materiały QA należą wyłącznie do `Outside_REPO/` paczki wydaniowej.
