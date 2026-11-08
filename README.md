# USD or CRC? 💵 ⇄ ₡

A small offline-capable web app that tells you whether to pay in **US dollars or Costa Rican colones** when a merchant quotes both prices.

Built for people who **earn in USD and spend in Costa Rica**: paying in colones means your bank converts your dollars at its *buy rate* (tipo de cambio de compra), so the "cheaper" price isn't always obvious.

> **Example:** a store asks $100 or ₡45,000. At a bank buy rate of ₡441, ₡45,000 costs you $102.04, so paying **$100 in USD saves you $2.04**.

## Features

- **Instant recommendation**: enter both prices and see which currency costs you less, with your savings in USD.
- **Live exchange rate**, with fallbacks:
  1. **Commercial bank** buy rate (the rate you actually get)
  2. **Hacienda / BCCR** official buy rate, if the bank rate is unavailable
  3. **Manual entry**, pre-filled with the last known rate
- **History** of past calculations, stored only on your device.
- **Works offline** and can be **installed to your home screen** (PWA).
- **English / Español** toggle.
- Light and dark mode, mobile-first design.
- No accounts, no tracking, no backend, no dependencies.

## How the decision works

```
CRC cost in USD = price in CRC ÷ buy rate
If CRC cost in USD < price in USD  → pay in CRC
Otherwise (including ties)         → pay in USD
Savings = |price in USD − CRC cost in USD|
```

Comparisons are made at cent precision, so a tie never recommends an unnecessary conversion.

## Getting started

No build step: it's plain HTML, CSS and JavaScript.

```bash
git clone https://github.com/hmrs-cr/usd-crc-choser.git
cd usd-crc-choser
python3 -m http.server 8000
# open http://localhost:8000
```

> Opening `index.html` directly (`file://`) works for calculations, but offline caching needs `http://localhost` or HTTPS.

All paths are relative, so the app works from a sub-path without any configuration.

## Project structure

```
index.html             The entire app (HTML + CSS + JS)
sw.js                  Service worker: offline cache (stale-while-revalidate)
manifest.webmanifest   PWA manifest (installable app)
icon.svg               App icon
docs/SPEC.md           Full application specification
```

## Data & privacy

Everything stays in your browser's `localStorage`:

| Key | Contents |
| --- | --- |
| `fx_calculator_history` | Your saved calculations |
| `fx_last_rate` | Last fetched exchange rate (used offline) |
| `fx_lang` | Language preference |

The only network requests go to the exchange-rate sources: a commercial bank's public rate feed and `api.hacienda.go.cr` (Hacienda).

## Adding a bank

Rate sources live in the `RATE_PROVIDERS` registry in [`index.html`](index.html). To add a bank, add one entry:

```js
mybank: {
  kind: 'bank',               // shows up in the bank selector
  name: 'My Bank',            // full name in the selector
  label: 'MYBANK',            // short code on the badge and in history
  url: 'https://example.com/rates.json',
  async fetchRate(http) {     // return the USD *buy* rate in CRC
    const data = await http.fetchJSON(this.url);
    return http.cleanFloat(data.usd.buy);
  },
},
```

`http` provides `fetchText`, `fetchJSON`, `parseXML` and `cleanFloat`, with a built-in timeout. Throw on failure, and the app falls back to Hacienda and then to manual entry.

Once two or more banks exist, a **Bank** selector appears automatically, and the user's choice is saved. The default is `CONFIG.DEFAULT_BANK`.

The bank's endpoint must allow cross-origin requests (CORS), because the app runs entirely in the browser.

## Updating the app

The service worker caches the app aggressively so it works offline. After changing any file, bump `CACHE_VERSION` in [`sw.js`](sw.js) so installed copies pick up the new version.

## Disclaimer

Exchange rates come from public sources and may differ from the rate your bank or card issuer applies at the moment of payment, including any fees. Use the result as a guide, not financial advice.
