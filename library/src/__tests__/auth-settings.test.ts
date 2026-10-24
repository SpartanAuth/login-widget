import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import '../index';

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function fakeJwt(): string {
  const enc = (obj: object) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ exp: 4_000_000_000 })}.sig`;
}

const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

function settingsFetch(url: string, init?: RequestInit): Promise<Response> {
  const value = String(url);
  const method = String(init?.method || 'get').toLowerCase();
  if (value.includes('/password-exposure')) {
    return Promise.resolve(makeJsonResponse({ state: 'clear', breachCount: '0', checkedAt: '0' }));
  }
  if (value.includes('/api/v1/users/self/mfa')) {
    return Promise.resolve(makeJsonResponse({ enforcedByPolicy: false, enabled: false }));
  }
  if (value.includes('/api/v1/users/self')) {
    return Promise.resolve(makeJsonResponse({ email: 'owner@example.com' }));
  }
  if (value.includes('/api/v1/webauthn/registration/list')) {
    return Promise.resolve(makeJsonResponse({ registrations: [] }));
  }
  if (value.includes('/api/v1/otp/list')) {
    return Promise.resolve(makeJsonResponse({ registrations: [] }));
  }
  if (value.includes('/api/v1/totp/begin')) {
    return Promise.resolve(makeJsonResponse({
      transactionID: 'tx-settings',
      registrationID: 'reg-new',
      secret,
      otpauthURL: `otpauth://totp/SpartanAuth:owner@example.com?secret=${secret}`,
    }));
  }
  if (value.includes('/api/v1/totp/finish')) {
    return Promise.resolve(makeJsonResponse({
      transactionID: 'tx-settings',
      recoveryCodes: ['SAVE1111', 'SAVE2222'],
    }));
  }
  if (method === 'delete' && value.includes('/api/v1/totp/')) {
    return Promise.resolve(makeJsonResponse({ message: 'An administrator must turn off required MFA before you can remove your last sign-in method.' }, 403));
  }
  if (method === 'get' && value.includes('/api/v1/totp/')) {
    return Promise.resolve(makeJsonResponse({
      registrations: [{ ID: 'reg-1', DisplayName: 'Phone', Validated: true }],
    }));
  }
  return Promise.resolve(makeJsonResponse({}, 500));
}

async function mountSettings(attrs: Record<string, string> = {}): Promise<HTMLElement> {
  const el = document.createElement('spartan-account-settings');
  el.setAttribute('domain', 'http://localhost:11000');
  el.setAttribute('sector', 'test-sector-id');
  el.setAttribute('redirect-on-unauthenticated', 'false');
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  document.body.appendChild(el);
  await new Promise<void>((r) => setTimeout(r, 40));
  return el;
}

function shadow(el: HTMLElement): ShadowRoot {
  const sr = el.shadowRoot;
  if (!sr) throw new Error('<spartan-account-settings> has no shadowRoot');
  return sr;
}

describe('<spartan-account-settings> – authenticator app', () => {
  beforeEach(() => {
    localStorage.setItem('spartan-token', fakeJwt());
    fetchMock.mockImplementation(settingsFetch);
  });

  afterEach(() => {
    document.body.querySelectorAll('spartan-account-settings').forEach((el) => el.remove());
    fetchMock.mockReset();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('lists authenticator apps by display name for the signed-in user', async () => {
    const el = await mountSettings();
    const sr = shadow(el);
    expect(sr.textContent).toContain('Authenticator app');
    expect(sr.textContent).toContain('Phone');
    expect(sr.textContent).not.toContain(secret);

    const listCall = fetchMock.mock.calls.find(([url, init]) => {
      return String(url).includes('/api/v1/totp/') && String(init?.method || 'get').toLowerCase() === 'get';
    });
    expect(String(listCall?.[0])).toContain('owner%40example.com');
    expect(String(listCall?.[0])).toContain('sectorID=test-sector-id');
    expect(String(listCall?.[1].headers.Authorization)).toContain('bearer ');
  });

  it('hides the authenticator section when show-totp is false', async () => {
    const el = await mountSettings({ 'show-totp': 'false' });
    expect(shadow(el).textContent).not.toContain('Authenticator app');
    const listed = fetchMock.mock.calls.some(([url]) => String(url).includes('/api/v1/totp/'));
    expect(listed).toBe(false);
  });

  it('enrolls an authenticator and shows recovery codes only after a successful verify', async () => {
    const el = await mountSettings();
    const sr = shadow(el);
    const add = Array.from(sr.querySelectorAll('button')).find((button) => button.textContent?.includes('Add authenticator app'));
    expect(add, 'add authenticator button').toBeDefined();
    add!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 20));

    const name = shadow(el).querySelector<HTMLInputElement>('#totpName')!;
    name.value = 'Phone';
    name.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    const register = Array.from(shadow(el).querySelectorAll('button')).find((button) => button.textContent === 'Register');
    register!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 40));

    const enrolling = shadow(el);
    expect(enrolling.querySelector<HTMLInputElement>('input.secret-field')!.value).toBe(secret);
    expect(enrolling.querySelector('.qr svg')).not.toBeNull();
    const beginCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/v1/totp/begin'));
    expect(JSON.parse(String(beginCall?.[1].body))).toMatchObject({
      displayName: 'Phone',
      sectorID: 'test-sector-id',
      email: 'owner@example.com',
    });

    const code = enrolling.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
    code.value = '123456';
    code.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    const verify = Array.from(enrolling.querySelectorAll('button')).find((button) => button.textContent === 'Verify and save');
    verify!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 40));

    const saved = shadow(el);
    expect(saved.textContent).toContain('SAVE1111');
    expect(saved.textContent).toContain('SAVE2222');
    expect(saved.textContent).not.toContain(secret);
    expect(saved.querySelector('input.secret-field')).toBeNull();

    const finishCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/v1/totp/finish'));
    expect(JSON.parse(String(finishCall?.[1].body))).toMatchObject({
      transactionID: 'tx-settings',
      registrationID: 'reg-new',
      code: '123456',
      sectorID: 'test-sector-id',
    });

    const ack = Array.from(saved.querySelectorAll('button')).find((button) => button.textContent === 'I have saved these codes');
    ack!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 20));
    expect(shadow(el).textContent).not.toContain('SAVE1111');
  });

  it('explains that an administrator must turn off required MFA before the last method can be removed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const el = await mountSettings();
    const remove = shadow(el).querySelector<HTMLButtonElement>('tr.totp-list-item button.remove')!;
    remove.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 40));

    expect(shadow(el).querySelector('.skeleton')).toBeNull();
    expect(shadow(el).textContent).toContain(
      'An administrator must turn off required MFA before you can remove your last sign-in method.',
    );
    const deleteCall = fetchMock.mock.calls.find(([url, init]) => {
      return String(init?.method || '').toLowerCase() === 'delete' && String(url).includes('/api/v1/totp/reg-1');
    });
    expect(deleteCall, 'DELETE /api/v1/totp/{id}').toBeDefined();
  });

  it('holds a skeleton until the first settings load finishes when show-skeleton is set', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      await gate;
      return settingsFetch(url, init);
    });

    const el = document.createElement('spartan-account-settings');
    el.setAttribute('domain', 'http://localhost:11000');
    el.setAttribute('sector', 'test-sector-id');
    el.setAttribute('redirect-on-unauthenticated', 'false');
    el.setAttribute('show-skeleton', 'true');
    document.body.appendChild(el);
    await new Promise<void>((r) => setTimeout(r, 20));

    const loading = shadow(el);
    expect(loading.querySelector('.skeleton')).not.toBeNull();
    expect(loading.querySelectorAll('.skeleton-group').length).toBe(2);
    expect(loading.textContent).toContain('Account Settings');
    expect(loading.textContent).not.toContain('Phone');
    expect(loading.textContent).not.toContain('Add authenticator app');
    expect(loading.textContent).not.toContain('Require a second factor');

    release();
    await new Promise<void>((r) => setTimeout(r, 40));

    const ready = shadow(el);
    expect(ready.querySelector('.skeleton')).toBeNull();
    expect(ready.textContent).toContain('Phone');
    expect(ready.textContent).toContain('Add authenticator app');
    expect(ready.querySelector('#requireMfa')).not.toBeNull();
  });
});

describe('<spartan-account-settings> – breached passwords', () => {
  beforeEach(() => {
    localStorage.setItem('spartan-token', fakeJwt());
    fetchMock.mockImplementation(settingsFetch);
  });

  afterEach(() => {
    document.body.querySelectorAll('spartan-account-settings').forEach((el) => el.remove());
    fetchMock.mockReset();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function withExposure(state: string, breachCount = '0') {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/password-exposure')) {
        return Promise.resolve(makeJsonResponse({ state, breachCount, checkedAt: '1700000000' }));
      }
      return settingsFetch(url, init);
    });
  }

  async function typePassword(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  }

  it('warns and offers a reset email and a direct password change when the password is pwned', async () => {
    withExposure('pwned', '42');
    const el = await mountSettings();
    const sr = shadow(el);
    expect(sr.querySelector('.warning')).not.toBeNull();
    expect(sr.textContent).toContain('known data breach');
    expect(sr.textContent).toContain('Breach count: 42');
    expect(sr.textContent).toContain('Email me a reset code');
    expect(sr.querySelector('#currentPassword')).not.toBeNull();
    expect(sr.querySelector('#newPassword')).not.toBeNull();
  });

  it('does not warn for clear, none, unchecked, or unknown passwords', async () => {
    for (const state of ['clear', 'none', 'unchecked', 'unknown']) {
      document.body.querySelectorAll('spartan-account-settings').forEach((el) => el.remove());
      withExposure(state, '0');
      const el = await mountSettings();
      const sr = shadow(el);
      expect(sr.querySelector('.warning'), state).toBeNull();
      expect(sr.textContent, state).not.toContain('known data breach');
      expect(sr.querySelector('#currentPassword'), state).not.toBeNull();
    }
  });

  it('keeps the rest of settings when the exposure request fails', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/password-exposure')) {
        return Promise.resolve(makeJsonResponse({}, 500));
      }
      return settingsFetch(url, init);
    });
    const el = await mountSettings();
    const sr = shadow(el);
    expect(sr.querySelector('.warning')).toBeNull();
    expect(sr.textContent).toContain('Phone');
    expect(sr.querySelector('#currentPassword')).not.toBeNull();
  });

  it('emails a reset code to the signed-in address', async () => {
    withExposure('pwned', '3');
    const el = await mountSettings();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/v1/password/reset/begin')) {
        return Promise.resolve(makeJsonResponse({ message: 'ok' }));
      }
      if (String(url).includes('/password-exposure')) {
        return Promise.resolve(makeJsonResponse({ state: 'pwned', breachCount: '3', checkedAt: '1' }));
      }
      return settingsFetch(url, init);
    });
    const button = Array.from(shadow(el).querySelectorAll('button')).find((item) => item.textContent === 'Email me a reset code');
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 40));

    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/v1/password/reset/begin'));
    expect(call, 'reset begin request').toBeDefined();
    expect(JSON.parse(String(call![1].body))).toEqual({
      email: 'owner@example.com',
      sectorID: 'test-sector-id',
    });
    expect(shadow(el).textContent).toContain('If an account exists with that email, a reset code has been sent.');
    expect(shadow(el).querySelector('.warning')).not.toBeNull();
  });

  it('posts the current and new password and clears the warning after a successful change', async () => {
    let state = 'pwned';
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/v1/users/password')) {
        state = 'clear';
        return Promise.resolve(makeJsonResponse({ status: 'ok', message: 'password updated' }));
      }
      if (String(url).includes('/password-exposure')) {
        return Promise.resolve(makeJsonResponse({ state, breachCount: state === 'pwned' ? '4' : '0', checkedAt: '1' }));
      }
      return settingsFetch(url, init);
    });
    const el = await mountSettings();
    const sr = shadow(el);
    await typePassword(sr.querySelector<HTMLInputElement>('#currentPassword')!, 'old-password');
    await typePassword(sr.querySelector<HTMLInputElement>('#newPassword')!, 'new-password');
    const button = Array.from(sr.querySelectorAll('button')).find((item) => item.textContent === 'Update password');
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 40));

    const call = fetchMock.mock.calls.find(([url, init]) => {
      return String(url).includes('/api/v1/users/password') && String(init?.method || '').toLowerCase() === 'post';
    });
    expect(call, 'change password request').toBeDefined();
    expect(JSON.parse(String(call![1].body))).toEqual({
      currentPassword: 'old-password',
      newPassword: 'new-password',
    });
    expect(String(call![1].headers.Authorization)).toContain('bearer ');
    const updated = shadow(el);
    expect(updated.textContent).toContain('Password updated.');
    expect(updated.querySelector('.warning')).toBeNull();
    expect(updated.querySelector<HTMLInputElement>('#currentPassword')!.value).toBe('');
    expect(updated.querySelector<HTMLInputElement>('#newPassword')!.value).toBe('');
  });

  it('shows the server message when the replacement password is breached or the check is unavailable', async () => {
    const cases = [
      { status: 400, message: 'this password has appeared in a data breach' },
      { status: 503, message: 'password could not be checked against known breaches, try again' },
      { status: 401, message: 'current password is incorrect' },
    ];
    for (const item of cases) {
      document.body.querySelectorAll('spartan-account-settings').forEach((node) => node.remove());
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (String(url).includes('/api/v1/users/password')) {
          return Promise.resolve(makeJsonResponse({ message: item.message }, item.status));
        }
        return settingsFetch(url, init);
      });
      const el = await mountSettings();
      const sr = shadow(el);
      await typePassword(sr.querySelector<HTMLInputElement>('#currentPassword')!, 'old-password');
      await typePassword(sr.querySelector<HTMLInputElement>('#newPassword')!, 'new-password');
      const button = Array.from(sr.querySelectorAll('button')).find((node) => node.textContent === 'Update password');
      button!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
      await new Promise<void>((r) => setTimeout(r, 40));
      const text = shadow(el).textContent || '';
      expect(text, item.message).toContain(item.message);
      expect(text, item.message).not.toContain('Password updated.');
    }
  });
});

describe('<spartan-account-settings> – own MFA requirement', () => {
  beforeEach(() => {
    localStorage.setItem('spartan-token', fakeJwt());
    fetchMock.mockImplementation(settingsFetch);
  });

  afterEach(() => {
    document.body.querySelectorAll('spartan-account-settings').forEach((el) => el.remove());
    fetchMock.mockReset();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('places an unchecked checkbox after the password section when MFA is not already required', async () => {
    const el = await mountSettings();
    const sr = shadow(el);
    const box = sr.querySelector<HTMLInputElement>('#requireMfa');
    expect(box, 'require MFA checkbox').not.toBeNull();
    expect(box!.checked).toBe(false);
    expect(sr.textContent).toContain('Require a second factor for my sign-ins.');
    expect(sr.textContent).toContain('one method from the sections below');

    const html = sr.innerHTML;
    const passwordAt = html.indexOf('id="currentPassword"');
    const optInAt = html.indexOf('id="requireMfa"');
    const passkeyAt = html.indexOf('Add passkey');
    expect(passwordAt).toBeGreaterThanOrEqual(0);
    expect(optInAt).toBeGreaterThan(passwordAt);
    expect(passkeyAt).toBeGreaterThan(optInAt);

    const puts = fetchMock.mock.calls.filter(([, init]) => String(init?.method || '').toLowerCase() === 'put');
    expect(puts).toHaveLength(0);
  });

  it('omits the checkbox when the platform or sector already requires MFA', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/v1/users/self/mfa')) {
        return Promise.resolve(makeJsonResponse({ enforcedByPolicy: true, enabled: true }));
      }
      return settingsFetch(url, init);
    });
    const el = await mountSettings();
    const sr = shadow(el);
    expect(sr.querySelector('#requireMfa')).toBeNull();
    expect(sr.textContent).not.toContain('Require a second factor for my sign-ins.');
    const puts = fetchMock.mock.calls.filter(([, init]) => String(init?.method || '').toLowerCase() === 'put');
    expect(puts).toHaveLength(0);
  });

  it('sends the new value when the checkbox is turned on and matches a saved opt-in', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = String(init?.method || 'get').toLowerCase();
      if (String(url).includes('/api/v1/users/self/mfa') && method === 'get') {
        return Promise.resolve(makeJsonResponse({ enforcedByPolicy: false, enabled: true }));
      }
      if (String(url).includes('/api/v1/users/self/mfa') && method === 'put') {
        const body = JSON.parse(String(init?.body));
        return Promise.resolve(makeJsonResponse({ enforcedByPolicy: false, enabled: body.enabled }));
      }
      return settingsFetch(url, init);
    });
    const el = await mountSettings();
    const box = shadow(el).querySelector<HTMLInputElement>('#requireMfa')!;
    expect(box.checked).toBe(true);

    box.checked = false;
    box.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await new Promise<void>((r) => setTimeout(r, 40));

    const put = fetchMock.mock.calls.find(([url, init]) => {
      return String(url).includes('/api/v1/users/self/mfa') && String(init?.method || '').toLowerCase() === 'put';
    });
    expect(put, 'PUT /api/v1/users/self/mfa').toBeDefined();
    expect(JSON.parse(String(put![1].body))).toEqual({ enabled: false });
    expect(String(put![1].headers.Authorization)).toContain('bearer ');
    expect(shadow(el).querySelector<HTMLInputElement>('#requireMfa')!.checked).toBe(false);
  });

  it('restores the checkbox and shows the request error when the update fails', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = String(init?.method || 'get').toLowerCase();
      if (String(url).includes('/api/v1/users/self/mfa') && method === 'put') {
        return Promise.resolve(makeJsonResponse({ message: 'MFA is already required' }, 400));
      }
      return settingsFetch(url, init);
    });
    const el = await mountSettings();
    const box = shadow(el).querySelector<HTMLInputElement>('#requireMfa')!;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await new Promise<void>((r) => setTimeout(r, 40));

    expect(shadow(el).textContent).toContain('MFA is already required');
    expect(shadow(el).querySelector<HTMLInputElement>('#requireMfa')!.checked).toBe(false);
  });

  it('hides the phone number field while SMS sending is unavailable', async () => {
    const el = await mountSettings();
    const add = Array.from(shadow(el).querySelectorAll('button')).find((button) => button.textContent?.includes('Register MFA'));
    expect(add, 'register MFA button').toBeDefined();
    add!.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 20));

    const sr = shadow(el);
    expect(sr.querySelector('#email')).not.toBeNull();
    expect(sr.textContent).toContain('Add Email');
    expect(sr.querySelector('#phone')).toBeNull();
    expect(sr.textContent).not.toContain('Add SMS');
  });

  it('still lists an existing phone registration and does not offer to send a code', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/v1/otp/list')) {
        return Promise.resolve(makeJsonResponse({
          registrations: [{ ID: 'sms-1', DisplayName: '+15551212', Type: 'phone', Validated: false }],
        }));
      }
      return settingsFetch(url, init);
    });
    const el = await mountSettings();
    const row = shadow(el).querySelector('tr.mfa-list-item');
    expect(row?.textContent).toContain('+15551212');
    expect(row?.textContent).toContain('Remove');
    expect(row?.querySelector('button.validate')).toBeNull();
  });

  it('tells the user to turn off their own requirement when that blocks the last authenticator', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = String(init?.method || 'get').toLowerCase();
      if (method === 'delete' && String(url).includes('/api/v1/totp/')) {
        return Promise.resolve(makeJsonResponse({
          message: 'Turn off required MFA in account settings before you can remove your last sign-in method.',
        }, 403));
      }
      return settingsFetch(url, init);
    });
    const el = await mountSettings();
    const remove = shadow(el).querySelector<HTMLButtonElement>('tr.totp-list-item button.remove')!;
    remove.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
    await new Promise<void>((r) => setTimeout(r, 40));

    const text = shadow(el).textContent || '';
    expect(text).toContain('Turn off required MFA in account settings before you can remove your last sign-in method.');
    expect(text).not.toContain('An administrator must turn off required MFA');
  });
});
