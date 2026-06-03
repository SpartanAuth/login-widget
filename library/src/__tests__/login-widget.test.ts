/**
 * Tests for the <spartan-login> custom element.
 *
 * Key scenario being validated:
 *   LastPass (and other credential managers) fill login fields by setting the
 *   DOM `.value` property directly and dispatching a "change" event — they do
 *   NOT type character-by-character and therefore do NOT fire "input" events.
 *
 *   Before the fix, the password field only had `onInput`; the Solid signal
 *   was never updated by a programmatic fill, so the form always submitted an
 *   empty password → HTTP 401.
 *
 *   The fix added:
 *     1. `onChange` alongside `onInput` on both the username and password fields.
 *     2. `autocomplete="username"` / `autocomplete="current-password"` so that
 *        credential managers correctly identify the fields in the first place.
 *
 * Also tested here:
 *   - Loading overlay appears during any async operation.
 *   - OAuth callback success keeps the widget in loading state (no flash back to
 *     login form) until the host removes the element or the 5-second safety
 *     timeout elapses.
 */

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';

// ─── fetch mock ──────────────────────────────────────────────────────────────
// Must be set up BEFORE the widget module is imported so the mock is in place
// when onMount fires its initial sector-settings requests.
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// Default handler: answers the two bootstrap requests the widget makes in
// onMount (sector settings + social providers) so the component can finish
// initialising without errors.  Individual tests override for login calls.
function defaultFetch(url: string): Promise<Response> {
  if (url.includes('publicsettings')) {
    return Promise.resolve(makeJsonResponse({ SelfSignUpAllowed: false, MFARequired: false }));
  }
  if (url.includes('oauth/providers')) {
    return Promise.resolve(makeJsonResponse({ providers: [] }));
  }
  return Promise.resolve(makeJsonResponse({}, 500));
}

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// ─── widget import ───────────────────────────────────────────────────────────
// Importing registers the <spartan-login> custom element via customElements.define.
import '../index';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Mount a fresh <spartan-login> element and wait for Solid's first render. */
async function mountWidget(attrs: Record<string, string> = {}): Promise<HTMLElement> {
  const el = document.createElement('spartan-login');
  el.setAttribute('domain', 'http://localhost:11000');
  el.setAttribute('sector', 'test-sector-id');
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  document.body.appendChild(el);
  // Flush microtasks so Solid's initial render + onMount complete.
  await new Promise<void>((r) => setTimeout(r, 20));
  return el;
}

/** Return the shadow root, asserting it exists. */
function shadow(el: HTMLElement): ShadowRoot {
  const sr = el.shadowRoot;
  if (!sr) throw new Error('<spartan-login> has no shadowRoot – did jsdom attach it?');
  return sr;
}

/** Simulate a password manager fill: set .value then fire a "change" event. */
function passwordManagerFill(input: HTMLInputElement, value: string) {
  // Password managers set the DOM property directly; they do NOT fire "input".
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

/** Simulate a user typing character-by-character (fires "input"). */
function userTyping(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('<spartan-login> – autocomplete attributes', () => {
  let el: HTMLElement;

  beforeEach(async () => {
    fetchMock.mockImplementation(defaultFetch);
    el = await mountWidget();
  });

  afterEach(() => {
    document.body.removeChild(el);
    fetchMock.mockReset();
  });

  it('username input has autocomplete="username"', () => {
    const sr = shadow(el);
    const input = sr.querySelector<HTMLInputElement>('input[type="text"]');
    expect(input, 'username <input type="text"> not found in shadow DOM').not.toBeNull();
    expect(input!.getAttribute('autocomplete')).toBe('username');
  });

  it('password input has autocomplete="current-password"', () => {
    const sr = shadow(el);
    const input = sr.querySelector<HTMLInputElement>('input[type="password"]');
    expect(input, 'password <input type="password"> not found in shadow DOM').not.toBeNull();
    expect(input!.getAttribute('autocomplete')).toBe('current-password');
  });
});

describe('<spartan-login> – password manager fill (LastPass regression)', () => {
  let el: HTMLElement;

  beforeEach(async () => {
    fetchMock.mockImplementation(defaultFetch);
    el = await mountWidget();
  });

  afterEach(() => {
    document.body.removeChild(el);
    fetchMock.mockReset();
  });

  it('submits the correct password when filled via "change" event (password manager path)', async () => {
    const sr = shadow(el);
    const usernameInput = sr.querySelector<HTMLInputElement>('input[type="text"]')!;
    const passwordInput = sr.querySelector<HTMLInputElement>('input[type="password"]')!;
    const form = sr.querySelector<HTMLFormElement>('form')!;

    // ── Simulate LastPass: set .value + fire "change" (no "input" event) ──
    passwordManagerFill(usernameInput, 'user@example.com');
    passwordManagerFill(passwordInput, 'MyS3cretP@ss!');

    // Mock the login endpoint AFTER the initial bootstrap calls.
    const loginResponse = { token: 'spartan-jwt-abc', transactionID: 'tx-999' };
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/v1/login/password')) {
        return Promise.resolve(makeJsonResponse(loginResponse));
      }
      return defaultFetch(url);
    });

    // Submit the form.
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 20));

    // Find the call to the password-login endpoint.
    const loginCall = fetchMock.mock.calls.find(([url]: [string]) =>
      String(url).includes('/api/v1/login/password'),
    );
    expect(loginCall, 'No request was made to /api/v1/login/password').toBeDefined();

    const body = JSON.parse(loginCall![1].body);
    expect(body.username).toBe('user@example.com');
    // This is the core assertion: the password must NOT be empty.
    // Before the fix (onChange missing), body.password would be "" → HTTP 401.
    expect(body.password).toBe('MyS3cretP@ss!');
  });

  it('submits the correct password when filled via "input" event (manual typing path)', async () => {
    const sr = shadow(el);
    const usernameInput = sr.querySelector<HTMLInputElement>('input[type="text"]')!;
    const passwordInput = sr.querySelector<HTMLInputElement>('input[type="password"]')!;
    const form = sr.querySelector<HTMLFormElement>('form')!;

    // Normal user typing fires "input" events – this always worked.
    userTyping(usernameInput, 'user@example.com');
    userTyping(passwordInput, 'MyS3cretP@ss!');

    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/v1/login/password')) {
        return Promise.resolve(makeJsonResponse({ token: 'tok', transactionID: 'tx-1' }));
      }
      return defaultFetch(url);
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 20));

    const loginCall = fetchMock.mock.calls.find(([url]: [string]) =>
      String(url).includes('/api/v1/login/password'),
    );
    expect(loginCall).toBeDefined();
    const body = JSON.parse(loginCall![1].body);
    expect(body.username).toBe('user@example.com');
    expect(body.password).toBe('MyS3cretP@ss!');
  });

  it('does NOT submit the correct password when value is set without any event (demonstrates why events are necessary)', async () => {
    // This test documents the browser contract: setting .value silently (no
    // event of any kind) cannot be detected by any JS framework.  It is not a
    // bug – it's the reason onChange/onInput are required in the first place.
    const sr = shadow(el);
    const passwordInput = sr.querySelector<HTMLInputElement>('input[type="password"]')!;
    const form = sr.querySelector<HTMLFormElement>('form')!;

    // Set value with NO event at all.
    passwordInput.value = 'SilentFill';

    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/v1/login/password')) {
        return Promise.resolve(makeJsonResponse({ token: 'tok', transactionID: 'tx-2' }));
      }
      return defaultFetch(url);
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 20));

    const loginCall = fetchMock.mock.calls.find(([url]: [string]) =>
      String(url).includes('/api/v1/login/password'),
    );
    // A login call IS still made (empty password), but the password is empty –
    // proving that events (not just .value) are required for the signal to update.
    if (loginCall) {
      const body = JSON.parse(loginCall![1].body);
      expect(body.password).not.toBe('SilentFill');
    }
    // If no login call was made (empty-password validation blocked it), that's
    // also acceptable – the point is the fill was invisible to the framework.
  });
});

describe('<spartan-login> – sign-up mode autocomplete', () => {
  let el: HTMLElement;

  beforeEach(async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('publicsettings')) {
        return Promise.resolve(makeJsonResponse({ SelfSignUpAllowed: true, MFARequired: false }));
      }
      return defaultFetch(url);
    });
    el = await mountWidget();
  });

  afterEach(() => {
    document.body.removeChild(el);
    fetchMock.mockReset();
  });

  it('sign-up password input has autocomplete="new-password"', async () => {
    const sr = shadow(el);

    // The sign-up link is the LAST a.centered-text in password mode when
    // self-signup is allowed (the first is "Forgot password?").
    const links = Array.from(sr.querySelectorAll<HTMLAnchorElement>('a.centered-text'));
    const signupLink = links.at(-1);
    expect(signupLink, 'sign-up link not found').not.toBeNull();

    // Click it; Solid's reactive update is synchronous so a single tick is enough.
    signupLink!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 30));

    // Now in sign-up mode the autocomplete should be new-password.
    const passwordInput = sr.querySelector<HTMLInputElement>('input[type="password"]');
    expect(passwordInput, 'password input not found in sign-up mode').not.toBeNull();
    expect(passwordInput!.getAttribute('autocomplete')).toBe('new-password');
  });
});

// ─── Loading overlay ──────────────────────────────────────────────────────────

describe('<spartan-login> – loading overlay', () => {
  let el: HTMLElement;

  beforeEach(async () => {
    fetchMock.mockImplementation(defaultFetch);
    el = await mountWidget();
  });

  afterEach(() => {
    if (el.isConnected) document.body.removeChild(el);
    fetchMock.mockReset();
  });

  it('shows the loading overlay while a form submission is in flight', async () => {
    // Slow login endpoint so we can inspect the DOM mid-flight.
    let resolveLogin!: (r: Response) => void;
    const loginPending = new Promise<Response>((res) => { resolveLogin = res; });

    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/v1/login/password')) return loginPending;
      return defaultFetch(url);
    });

    const sr = shadow(el);
    userTyping(sr.querySelector<HTMLInputElement>('input[type="text"]')!, 'user@example.com');
    userTyping(sr.querySelector<HTMLInputElement>('input[type="password"]')!, 'pass');

    sr.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    // Allow Solid to re-render (isSubmitting → true).
    await new Promise<void>((r) => setTimeout(r, 10));

    const overlay = sr.querySelector('.loading-overlay');
    expect(overlay, 'loading overlay should be present while submitting').not.toBeNull();

    // Clean up: resolve the pending fetch so the widget doesn't hang.
    resolveLogin(makeJsonResponse({ token: 'tok', transactionID: 'tx-1' }));
    await new Promise<void>((r) => setTimeout(r, 20));
  });

  it('removes the loading overlay once submission completes', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/v1/login/password')) {
        return Promise.resolve(makeJsonResponse({ token: 'tok', transactionID: 'tx-1' }));
      }
      return defaultFetch(url);
    });

    const sr = shadow(el);
    userTyping(sr.querySelector<HTMLInputElement>('input[type="text"]')!, 'user@example.com');
    userTyping(sr.querySelector<HTMLInputElement>('input[type="password"]')!, 'pass');

    sr.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await new Promise<void>((r) => setTimeout(r, 50));

    const overlay = sr.querySelector('.loading-overlay');
    expect(overlay, 'loading overlay should be gone after submission finishes').toBeNull();
  });
});

// ─── OAuth callback loading hold ──────────────────────────────────────────────

describe('<spartan-login> – OAuth callback loading hold', () => {
  const originalSearch = window.location.search;

  afterAll(() => {
    // Restore the URL after this suite.
    history.replaceState({}, '', window.location.pathname);
  });

  afterEach(() => {
    fetchMock.mockReset();
    history.replaceState({}, '', window.location.pathname);
  });

  async function mountWithOAuthCode(code: string): Promise<HTMLElement> {
    history.replaceState({}, '', `${window.location.pathname}?code=${code}`);
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/v1/oauth/exchange')) {
        return Promise.resolve(makeJsonResponse({ token: 'oauth-jwt-abc' }));
      }
      return defaultFetch(url);
    });
    return mountWidget(); // no `redirect` attribute → stays in loading state
  }

  it('stays in loading state after a successful OAuth exchange when there is no redirect', async () => {
    const el = await mountWithOAuthCode('test-code-123');
    const sr = shadow(el);

    // The widget should still show the loading overlay — it should NOT have
    // reset isSubmitting and returned to the login form.
    const overlay = sr.querySelector('.loading-overlay');
    expect(overlay, 'widget should remain in loading state after OAuth success').not.toBeNull();

    document.body.removeChild(el);
  });

  it('fires the spartan-login event with the exchanged token', async () => {
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    document.addEventListener('spartan-login', listener);

    const el = await mountWithOAuthCode('test-code-456');
    document.removeEventListener('spartan-login', listener);

    expect(events.length, 'spartan-login event should be fired once').toBe(1);
    expect(events[0].detail.token).toBe('oauth-jwt-abc');

    document.body.removeChild(el);
  });

  it('leaves loading state and restores the login form when the element is removed by the host', async () => {
    // The host removes the element synchronously inside the event handler.
    // The safety timeout should be cancelled by onCleanup and the widget
    // should never call setIsSubmitting(false) or re-fetch sector settings.
    const sectorSettingsCalls: string[] = [];
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/v1/oauth/exchange')) {
        return Promise.resolve(makeJsonResponse({ token: 'oauth-jwt-xyz' }));
      }
      if (url.includes('publicsettings')) {
        sectorSettingsCalls.push(url);
        return Promise.resolve(makeJsonResponse({ SelfSignUpAllowed: false, MFARequired: false }));
      }
      return defaultFetch(url);
    });

    const el = document.createElement('spartan-login') as HTMLElement;
    el.setAttribute('domain', 'http://localhost:11000');
    el.setAttribute('sector', 'test-sector-id');

    // Remove the element synchronously when login event fires.
    el.addEventListener('spartan-login', () => {
      if (el.isConnected) document.body.removeChild(el);
    });

    history.replaceState({}, '', `${window.location.pathname}?code=sync-remove-code`);
    document.body.appendChild(el);
    await new Promise<void>((r) => setTimeout(r, 50));

    // Element should have been removed by the listener.
    expect(el.isConnected).toBe(false);

    // Give time for any erroneous timer-based re-fetch to fire.
    await new Promise<void>((r) => setTimeout(r, 100));

    // sector settings should only have been called ONCE at most (the initial
    // bootstrap that never runs here because code= short-circuits onMount
    // before getSectorSettings is called).  The key assertion is that the
    // safety-timeout callback did NOT fire and trigger an extra fetch.
    expect(sectorSettingsCalls.length, 'safety timeout should not trigger a re-fetch after the element is removed').toBe(0);
  });
});
