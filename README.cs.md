# webshot

CLI nastroj pro porizovani celostrankovych screenshotu webovych stranek a jejich ukladani jako optimalizovane JPEG soubory.

## Funkce

- Celostrankove screenshoty se spoustenim lazy-load obsahu (projde celou stranku a aktivuje obsah zalozeny na IntersectionObserver)
- Paralelni zpracovani vice URL (az 4 soucasne)
- Progress bary v realnem case pro kazde URL
- Optimalizovany JPEG vystup pres mozjpeg
- Automaticke doplneni `https://` pokud chybi protokol

## Pozadavky

- [Node.js](https://nodejs.org/) 22+ (spravovany pres [Volta](https://volta.sh/))
- [pnpm](https://pnpm.io/) 10+

## Instalace

```bash
pnpm install
```

Toto zaroven automaticky nainstaluje Chromium pres Playwright.

## Pouziti

```bash
# Jedno URL
pnpm shot https://example.com

# Vice URL (zpracovano paralelne)
pnpm shot https://example.com https://github.com https://nodejs.org
```

Screenshoty se ukladaji do `./screenshots/` jako `<hostname>.jpg` (napr. `example-com.jpg`).

## Jak to funguje

1. Spusti headless Chromium s sirkou 1920px
2. Prejde na URL a pocka na ukonceni sitove aktivity
3. Projde celou stranku scrollovanim pro nacteni lazy-loaded obsahu a animaci
4. Poridi celostrankovy PNG screenshot
5. Prevede na JPEG (kvalita 80) pomoci Sharp s mozjpeg kompresi

## Licence

ISC