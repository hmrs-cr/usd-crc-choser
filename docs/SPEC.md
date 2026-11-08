# Application Specification: USD vs CRC Payment Optimizer

## 1. Project Overview
A client-side web application designed to help users who earn their salary in USD determine the most cost-effective currency (USD or CRC) to use for a transaction. The app will compare two given prices, fetch real-time exchange rates, store calculation history locally, and keep working offline as an installable Progressive Web App (PWA).

## 2. Technical Stack
*   **Structure:** HTML5
*   **Styling:** Plain CSS3 (Responsive design, Mobile-first approach, light/dark via `prefers-color-scheme`)
*   **Logic:** Vanilla JavaScript (ES6+)
*   **Frameworks/Libraries:** None. Strictly plain HTML/CSS/JS.
*   **Offline:** Service Worker + Web App Manifest (PWA).
*   **Hosting:** GitHub Pages (HTTPS, required for the Service Worker). All paths must be relative so the app works under a sub-path (e.g. `/usd-crc-choser/`).

## 3. Financial Logic & User Persona
*   **Persona:** The user earns in USD and lives in Costa Rica (expenses in CRC).
*   **Exchange Rate Dynamics:** To pay in CRC, the user must convert their USD to CRC. Therefore, the applicable exchange rate is the **Buy Rate (Tipo de Cambio de Compra)** — the amount of CRC the bank gives the user for 1 USD.
*   **Calculation Logic:**
    1. Input 1: Merchant's price in USD ($P_{usd}$)
    2. Input 2: Merchant's price in CRC ($P_{crc}$)
    3. Input 3: Bank Buy Rate ($FX_{buy}$) obtained per Section 5.
    4. Equivalent USD cost if paying in CRC: $Cost_{crc\_in\_usd} = P_{crc} / FX_{buy}$
    5. **Decision:**
       * If $Cost_{crc\_in\_usd} < P_{usd}$: Recommend paying in **CRC**.
       * Otherwise (including a tie, $P_{usd} = Cost_{crc\_in\_usd}$): Recommend paying in **USD**.
       * Show the user exactly how much they save in USD by choosing the optimal currency ($|P_{usd} - Cost_{crc\_in\_usd}|$, rounded to 2 decimals; $0.00 on a tie).

## 4. Screens & User Interface
The UI must be responsive, featuring a clean, modern interface that works seamlessly as a mobile web app and scales elegantly for desktop.

### Global
*   **Language:** Bilingual **English / Spanish** with an EN | ES toggle in the header. The choice persists in `localStorage` (`fx_lang`); default is the browser language, falling back to English. Number/currency formatting follows the language (`en-US` / `es-CR`, `$` and `₡`).
*   **Offline indicator:** An "Offline" chip in the header when the device has no connection.

### Screen 1: Calculator (Main View)
*   **Header:** App title, navigation toggle (Calculator / History), and language toggle.
*   **Exchange Rate Display:** A small widget displaying the current USD/CRC buy rate, a **source badge** (Bank / Hacienda / Manual / Cached), and the timestamp (or age) of the last fetch. Include a manual "Refresh Rate" button.
*   **Inputs:**
    *   Number input for "Price in USD".
    *   Number input for "Price in CRC".
    *   Manual exchange rate input (shown when automatic sources fail or when offline; see Section 5).
*   **Action:** "Calculate & Save" button.
*   **Output/Result Card:**
    *   Clearly highlights the recommended currency to use.
    *   Displays the equivalent costs side-by-side.
    *   Shows total savings in USD.

### Screen 2: History View
*   **Header:** Title and navigation toggle (Back to Calculator).
*   **Data Table / List:** A chronological list of past calculations (newest first), with an empty-state message.
*   **History Item Details:** Date/Time, USD Price, CRC Price, Exchange Rate used, and the Recommended Currency.
*   **Action:** "Clear History" button to wipe local storage (with a confirmation prompt).

## 5. External API Integration
The buy rate is resolved through a **fallback chain**, each step with a timeout (~6 s) and `try/catch`:

1.  **Commercial bank (primary)** — the rate the user actually gets.
    *   `GET` the bank's public XML exchange-rate feed (URL configured in `CONFIG` in `index.html`).
    *   XML response: find the `<country>` element whose `<name>` is `Costa Rica` and read `<buyRateUSD>` (also available: `saleRateUSD`, `buyRateEUR`, `saleRateEUR`).
    *   Parse values tolerantly: trim, replace `,` with `.`, parse as float; reject values ≤ 0.
    *   Note: may be blocked in the browser (CORS / bot filtering); failure must fall through silently to step 2.
2.  **Hacienda / BCCR (secondary)** — official reference rate (CORS-enabled).
    *   `GET https://api.hacienda.go.cr/indicadores/tc/dolar`
    *   JSON response: use `compra.valor` (and `compra.fecha`).
        ```json
        { "venta": { "fecha": "2026-11-08", "valor": 452.13 },
          "compra": { "fecha": "2026-11-08", "valor": 446.56 } }
        ```
3.  **Manual entry (last resort)** — if both APIs fail (or the device is offline), show a manual rate input with a user-friendly error message, **pre-filled with the most recent known rate** (from `fx_last_rate`, otherwise the `fxRateBuy` of the newest history entry).

Every successful fetch is saved to `fx_last_rate` so it can be reused offline.

## 6. Data Storage (Local Storage)
All data must be persisted in the browser's `localStorage` (wrap reads/writes in `try/catch`; corrupt data falls back to defaults).

*   **`fx_calculator_history`** — Array of JSON objects (newest first):
    ```json
    [
      {
        "id": "1697045023123",
        "timestamp": "2026-11-08T10:30:00Z",
        "priceUSD": 100.00,
        "priceCRC": 52000.00,
        "fxRateBuy": 510.50,
        "rateSource": "Hacienda",
        "recommended": "USD",
        "savingsUSD": 1.86
      }
    ]
    ```
    `rateSource` is the bank source code, `"Hacienda"`, `"Manual"`, or `"Cached"`.
*   **`fx_last_rate`** — Most recent successfully fetched rate: `{ "rate": 446.56, "source": "Hacienda", "fetchedAt": "2026-11-08T10:30:00Z" }`.
*   **`fx_lang`** — `"en"` or `"es"`.

## 7. Offline Support (PWA)
The app must be cached as long as possible so it works without a connection.
*   **Service Worker (`sw.js`):**
    *   Versioned cache (e.g. `fx-optimizer-v1`); pre-cache the app shell (`./`, `./index.html`, `./manifest.webmanifest`, `./icon.svg`) on `install`, delete old versions on `activate`, then `clients.claim()`.
    *   Same-origin GET requests: **stale-while-revalidate** (serve from cache immediately, refresh in background). Navigations fall back to the cached `index.html`.
    *   Exchange-rate API requests are **not** cached by the Service Worker; rate caching is handled via `fx_last_rate` so its age is known.
    *   Releasing an update = bumping the cache version.
*   **Persistence:** Call `navigator.storage.persist()` where supported to reduce cache/storage eviction.
*   **Manifest (`manifest.webmanifest`):** `name`, `short_name`, `start_url: "./"`, `scope: "./"`, `display: "standalone"`, theme/background colors, `icon.svg` (purpose `any maskable`). `index.html` links it and includes `theme-color` and Apple home-screen meta tags.
*   **Offline behavior:** Skip network fetches when offline, use the cached rate with a "Cached · {age}" badge, keep the manual rate input editable. Calculation and history work fully offline.
*   Service Worker registration is feature-detected and silently skipped on `file://`.

## 8. Implementation Requirements for Claude
1.  **Files:** The entire application (HTML, CSS, and JS) MUST live in a single `index.html`. The only additional files allowed are those required for offline/PWA support: `sw.js`, `manifest.webmanifest`, and `icon.svg`.
2.  **Modularity:** Ensure JavaScript is well-commented and uses modular functions for API fetching (rate fallback chain), calculating logic, DOM manipulation, i18n, and storage handling within the `<script>` tag.
3.  **Error Handling:** Implement `try/catch` for API calls and invalid inputs (e.g., empty, zero, negative numbers or text in number fields). Show user-friendly error messages in the UI (in the selected language), not just in the console.
