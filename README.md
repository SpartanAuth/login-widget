# SpartanAuth Widgets

A collection of drop-in web components for authentication, built with [SolidJS](https://www.solidjs.com/) and packaged as custom elements using [`solid-element`](https://github.com/solidjs/solid/tree/main/packages/solid-element). These widgets connect to a [SpartanAuth](https://www.spartanauth.com) backend and can be embedded in any modern web application regardless of framework.

## Widgets

| Custom Element | Description |
|---|---|
| `<spartan-login>` | Full login form supporting password, WebAuthn (passkeys), OTP/MFA, self-sign-up, and password reset flows |
| `<spartan-invite>` | Invitation completion form — lets invited users set their password using a one-time code |
| `<spartan-account-settings>` | Authenticated account settings panel for managing passkeys and MFA registrations (email & SMS) |

## Installation

```bash
npm install @masonitestudios/spartanauth-widgets
```

Then import the library in your project (this registers all three custom elements):

```js
import '@masonitestudios/spartanauth-widgets';
```

The library exposes both UMD (`dist/sa-widgets.umd.js`) and ES module (`dist/sa-widgets.mjs`) builds.

## Usage

### Login Widget

```html
<spartan-login
  domain="https://auth.yourdomain.com"
  sector="your-sector-id"
  start-mode="password"
  locale="en"
  redirect="/app"
  styles="">
</spartan-login>
```

**Attributes:**

| Attribute | Default | Description |
|---|---|---|
| `domain` | `http://127.0.0.1:11000` | SpartanAuth API base URL |
| `sector` | *(admin sector)* | Sector ID for your application |
| `start-mode` | `password` | Initial login mode — `password` or `webauthn` |
| `locale` | `en` | UI language (`en`, `fr`, `es`, `ja`) |
| `redirect` | `""` | URL to navigate to after successful login |
| `styles` | `""` | Custom CSS injected into the widget's shadow DOM |

**Features:**
- Password and WebAuthn (passkey) login
- MFA / OTP challenge flow (email & SMS) with automatic registration picker when multiple methods are enrolled
- Self-service sign-up (when enabled on the sector)
- Password reset via emailed code
- Emits a `spartan-login` CustomEvent on success with `{ token, transactionID }` in `event.detail`
- Stores the JWT in `localStorage` under `spartan-token`

### Invite Widget

```html
<spartan-invite
  domain="https://auth.yourdomain.com"
  sector="your-sector-id"
  sub="user-sub-from-invite"
  email="user@example.com"
  locale="en"
  redirect="/login">
</spartan-invite>
```

**Attributes:**

| Attribute | Default | Description |
|---|---|---|
| `domain` | `http://127.0.0.1:11000` | SpartanAuth API base URL |
| `sector` | *(admin sector)* | Sector ID |
| `sub` | `""` | User ID from the invitation (falls back to `?sub=` URL query param) |
| `email` | `""` | Invited user's email (displayed as context) |
| `locale` | `en` | UI language |
| `redirect` | `""` | URL to navigate to after successful registration |
| `styles` | `""` | Custom CSS injected into the widget's shadow DOM |

The widget can also read the OTP code from the URL hash (e.g. `#invite?otp=ABC123`), making it easy to build one-click invite links.

**Events:** Emits a `spartan-invite-complete` CustomEvent on success with `{ sub, success }` in `event.detail`.

### Account Settings Widget

```html
<spartan-account-settings
  domain="https://auth.yourdomain.com"
  sector="your-sector-id"
  locale="en"
  redirect="/"
  show-web-authn="true"
  redirect-on-unauthenticated="true">
</spartan-account-settings>
```

**Attributes:**

| Attribute | Default | Description |
|---|---|---|
| `domain` | `http://127.0.0.1:11000` | SpartanAuth API base URL |
| `sector` | *(admin sector)* | Sector ID |
| `locale` | `en` | UI language |
| `redirect` | `/` | Redirect target (used when user is not authenticated) |
| `show-web-authn` | `true` | Show the passkey management section |
| `redirect-on-unauthenticated` | `true` | Automatically redirect unauthenticated users |
| `styles` | `""` | Custom CSS injected into the widget's shadow DOM |

**Features:**
- List, add, and remove WebAuthn passkeys
- List, add, validate, and remove MFA registrations (email & SMS OTP)
- MFA verification modal with one-time code input
- Reads the JWT from `localStorage` (`spartan-token`) for authenticated API calls

## Styling

All widgets render inside Shadow DOM. To override internal styles, pass a CSS string via the `styles` attribute:

```html
<spartan-login styles=".login-frame button { background-color: #00f000; }"></spartan-login>
```

## Internationalization

The widgets ship with translations for **English**, **French**, **Spanish**, and **Japanese** (`en`, `fr`, `es`, `ja`). Set the `locale` attribute to switch languages.

## Project Structure

```
library/           → Widget library (publishable package)
  src/
    components/
      login-widget.tsx          → <spartan-login>
      invite-widget.tsx         → <spartan-invite>
      auth-settings.tsx         → <spartan-account-settings>
      spartanToken.ts           → JWT helpers (localStorage)
      banana.ts                 → i18n setup (banana-i18n)
    i18n/                       → Translation files (en, fr, es, ja)
    App.tsx                     → Registers all widgets
    index.tsx                   → Library entry point
  vite.config.ts                → Vite library build config

example/basic-app/ → Example app demonstrating all three widgets
  index.html                    → Login & invite page
  app.html                      → Protected page with account settings

mockup/            → Static HTML/CSS mockups for design reference
```

## Development

### Prerequisites

- Node.js
- npm (or pnpm / yarn)

### Library

```bash
cd library
npm install
npm run build
```

The build outputs to `library/dist/` as both UMD and ESM formats.

### Example App

```bash
cd example/basic-app
npm install
npm start
```

Opens at [http://localhost:5173](http://localhost:5173). The example links to the library via a local file reference, so build the library first.

## Key Dependencies

| Package | Purpose |
|---|---|
| [solid-js](https://www.solidjs.com/) | Reactive UI framework |
| [solid-element](https://github.com/solidjs/solid/tree/main/packages/solid-element) | Custom element wrapper for Solid components |
| [@github/webauthn-json](https://github.com/nicbarker/webauthn-json) | WebAuthn browser API helpers |
| [banana-i18n](https://github.com/nicbarker/banana-i18n) | MediaWiki-style i18n |
| [jwt-decode](https://github.com/nicbarker/jwt-decode) | JWT decoding for token expiry checks |
| [Vite](https://vitejs.dev/) | Build tool & dev server |

## License

[Apache 2.0](LICENSE)
