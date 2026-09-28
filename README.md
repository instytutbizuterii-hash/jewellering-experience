# Jewellering Experience — v0.1.4

Interaktywny, mobile-first prototyp doświadczenia Jewellering.

## v0.1.4 — Readable Handwriting + deterministic i-dot

Intro zostało przebudowane w dwóch miejscach:

- wordmark korzysta z czytelniejszego kroju odręcznego `Allura`,
- maska nadal porusza się po kolejnych literach zamiast odsłaniać napis poziomym prostokątem,
- finalny tekst i geometria pisania są rozdzielone: font odpowiada za wygląd, trajektorie odpowiadają za ruch,
- `i` jest renderowane bez kropki, a kropka jest osobnym elementem SVG,
- kropka pozostaje fizycznie ukryta do właściwego momentu animacji, także na telefonie,
- po ukończeniu pisania maska zostaje zdjęta, aby finalny wordmark był zawsze kompletny i czytelny.

Projekt nie wymaga bundlera ani instalacji zależności.

## Uruchomienie lokalne

Otwórz `index.html` w przeglądarce. Połączenie z internetem pozwala pobrać fonty z Google Fonts; przy ich braku aplikacja ma fallback i nie blokuje intro.

## GitHub Pages

Pliki z tego folderu powinny znajdować się bezpośrednio w głównym katalogu repozytorium. GitHub Pages może publikować gałąź `main` z `/ (root)`.
