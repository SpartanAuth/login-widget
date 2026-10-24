import {createSignal, onMount, Show} from "solid-js";
import {customElement} from "solid-element";
import {setupBanana} from './banana';
import {getDecodedSpartanToken, getSpartanToken} from "./spartanToken";
import {totpQrSvg} from "./totpQr";

import {
  create,
  parseCreationOptionsFromJSON,
} from "@github/webauthn-json/browser-ponyfill";

const style = `.container {
    background-color: #ffffff;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    padding: 20px;
    width: 400px;
  }

  .header {
    text-align: center;
    font-size: 24px;
    margin-bottom: 20px;
  }
  
  .section {
    margin-bottom: 20px;
  }
  
  .section h2 {
    font-size: 18px;
    margin-bottom: 10px;
    border-bottom: 2px solid #e0e0e0;
    padding-bottom: 5px;
  }
  
  .error-message {
    color: red;
  }

  .success-message {
    color: green;
    display: block;
    margin-bottom: 10px;
  }

  .warning {
    background: #fff6e8;
    border: 1px solid #e6b450;
    color: #6a4b00;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 12px;
  }

  .warning p {
    margin: 0 0 8px 0;
  }

  .password-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .password-form label {
    font-size: 14px;
  }

  .password-form input {
    padding: 8px;
    box-sizing: border-box;
    width: 100%;
  }

  .password-form .btn {
    align-self: flex-start;
  }
  
  .security-keys, .mfa-manage {
    display: flex;
    flex-direction: column;
}

  .key-item, .mfa-item, .add-key-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .key-item span {
    flex-grow: 1;
  }

  .mfa-item label, .add-key-item label {
    margin-right: 10px;
    width: 50px;
  }

  .mfa-item input, .add-key-item input {
    flex-grow: 1;
    padding: 5px;
    margin-right: 10px;
  }
  
  .mfa-item button, .add-key-item button {
    justify-self: start;
    flex-grow: 1;
  }

  .btn {
    padding: 5px 10px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn.add {
    background-color: #007bff;
    color: #ffffff;
  }

  .btn.remove {
    background-color: #999;
    color: #ffffff;
  }

  .btn.validate {
    background-color: #28a745;
    color: #ffffff;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  table, th, td {
    border: 1px solid #e0e0e0;
  }

  th, td {
    padding: 10px;
    text-align: left;
    max-width: 100px;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  th {
    background-color: #f9f9f9;
  }
  
  .modal {
    display: flex;
    position: fixed;
    z-index: 1;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: rgba(0, 0, 0, 0.4); /* Black background with opacity */
    align-items: center;
    justify-content: center;
}

/* Modal content */
.modal-content {
    background-color: #ffffff;
    margin: auto;
    padding: 20px;
    border: 1px solid #888;
    width: 300px;
    border-radius: 10px;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    position: relative;
    text-align: center;
}

/* Close button */
.close {
    color: #aaa;
    float: right;
    font-size: 28px;
    font-weight: bold;
    position: absolute;
    top: 10px;
    right: 15px;
    cursor: pointer;
}

.close:hover,
.close:focus {
    color: #000;
    text-decoration: none;
    cursor: pointer;
}

/* Input and button styling */
.modal-content input {
    width: calc(100% - 40px);
    padding: 10px;
    margin: 10px 0;
    border: 1px solid #ccc;
    border-radius: 5px;
    box-sizing: border-box;
}

.modal-content .btn.verify {
    background-color: #007bff;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    margin-top: 10px;
}

.modal-content .btn.verify:hover {
    background-color: #0056b3;
}

.modal-content.totp-modal {
    width: 340px;
}

.qr {
    display: flex;
    justify-content: center;
    margin: 10px 0;
}

.qr svg {
    width: 180px;
    height: 180px;
}

.secret-field {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    letter-spacing: 0.04em;
}

.recovery-codes {
    list-style: none;
    padding: 0;
    margin: 10px 0;
    text-align: left;
}

.recovery-codes li {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    padding: 4px 0;
}

.skeleton-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 20px;
}

.skeleton > .skeleton-block {
    margin-bottom: 20px;
}

.skeleton-line,
.skeleton-block,
.skeleton-row {
    --skeleton-base: #ececec;
    --skeleton-shine: #f7f7f7;
    border-radius: 6px;
    background-color: var(--skeleton-base);
    background-image: linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-shine) 50%, var(--skeleton-base) 100%);
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.2s ease-in-out infinite;
}

.skeleton-line {
    height: 16px;
    width: 42%;
}

.skeleton-block {
    height: 36px;
    width: 100%;
    border-radius: 5px;
}

.skeleton-row {
    height: 42px;
    width: 100%;
}

@keyframes skeleton-shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
}

@media (prefers-reduced-motion: reduce) {
    .skeleton-line,
    .skeleton-block,
    .skeleton-row {
        animation: none;
    }
}

.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
`;

const defaultProps = {
  domain: "http://127.0.0.1:11000",
  sector: "0ad5c3e5-0186-4557-8b32-4b36f247bf09", // defaults to the admin sector
  styles: "",
  locale: "en",
  showWebAuthn: true,
  showTotp: true,
  showSkeleton: false,
  redirect: '/',
  redirectOnUnauthenticated: true,
};

function flagOn(value: unknown): boolean {
  return value !== false && value !== 'false' && value !== '0';
}

// Opt-in. Existing embeds keep painting each section as its request returns.
function flagOptIn(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

customElement("spartan-account-settings", defaultProps, (props) => {
  // inputs
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [exposureState, setExposureState] = createSignal("");
  const [breachCount, setBreachCount] = createSignal(0);
  const [passwordNotice, setPasswordNotice] = createSignal("");
  const [newKeyName, setNewKeyName] = createSignal("");

  // widget state
  const [errorMessage, setErrorMessage] = createSignal("");
  const [modalErrorMessage, setModalErrorMessage] = createSignal("");
  const [showWebAuthn, setShowWebAuthn] = createSignal(props.showWebAuthn);
  const [showAddKey, setShowAddKey] = createSignal(false);
  const [isAuthed, setIsAuthed] = createSignal(false);
  const [showAddMFA, setShowAddMFA] = createSignal(false);
  const [showMFAModal, setShowMFAModal] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  // data
  const [securityKeys, setSecurityKeys] = createSignal<SecurityKey[]>([]);
  const [otpRegistrations, setOTPRegistrations] = createSignal<OTPRegistration[]>([]);
  const [transactionID, setTransactionID] = createSignal("");
  const [newOTP, setNewOTP] = createSignal("");
  const [newMFAEmail, setNewMFAEmail] = createSignal("");
  const [newMFAPhone, setNewMFAPhone] = createSignal("");
  const [totpRegistrations, setTotpRegistrations] = createSignal<TOTPRegistration[]>([]);
  const [showAddTotp, setShowAddTotp] = createSignal(false);
  const [newTotpName, setNewTotpName] = createSignal("");
  const [showTotpEnroll, setShowTotpEnroll] = createSignal(false);
  const [showTotpRecovery, setShowTotpRecovery] = createSignal(false);
  const [totpSecret, setTotpSecret] = createSignal("");
  const [totpOtpauthURL, setTotpOtpauthURL] = createSignal("");
  const [totpRegistrationID, setTotpRegistrationID] = createSignal("");
  const [newTotpCode, setNewTotpCode] = createSignal("");
  const [totpRecoveryCodes, setTotpRecoveryCodes] = createSignal<string[]>([]);
  const skeleton = flagOptIn(props.showSkeleton);
  const [settingsLoading, setSettingsLoading] = createSignal(skeleton && !!getDecodedSpartanToken());

  const banana = setupBanana(props.locale);

  let customStyles;
  try {
    customStyles = props.styles;
  } catch(e) {
    customStyles = '';
  }

  onMount(async () => {
    let token = getDecodedSpartanToken();
    if (!token) {
      if (props.redirectOnUnauthenticated) {
        window.location.href = props.redirect;
        return;
      }
      setIsAuthed(false);
      setErrorMessage(banana.i18n('not-authenticated'));
    } else {
      setIsAuthed(true);
      setErrorMessage('');
    }

    // check if webauthn is supported
    if (!window.PublicKeyCredential) {
      // TODO: show a message that webauthn is not supported or just hide the webauthn section

    }

    // get current user account settings
    if (isAuthed()) {
      try {
        const data = await getProfile();
        if (data && data.email) setUsername(data.email);
      } catch (e) {
        console.error(e);
      }
    }

    if (!skeleton) {
      if (isAuthed()) {
        await loadPasswordExposure();
      }
      // get security keys
      await getSecurityKeys();

      listOTPRegistrations().then((data) => {
        setOTPRegistrations(data.registrations);
      });

      if (isAuthed() && flagOn(props.showTotp)) {
        await listTOTPRegistrations();
      }
      return;
    }

    // Keep the placeholder up until the first batch finishes, then paint once.
    try {
      const loads: Promise<unknown>[] = [
        getSecurityKeys(),
        listOTPRegistrations().then((data) => {
          setOTPRegistrations(data?.registrations || []);
        }),
      ];
      if (isAuthed()) {
        loads.push(loadPasswordExposure());
      }
      if (isAuthed() && flagOn(props.showTotp)) {
        loads.push(listTOTPRegistrations());
      }
      await Promise.all(loads);
    } finally {
      setSettingsLoading(false);
    }
  });

  async function getProfile() {
    const res = await fetch(`${props.domain}/api/v1/users/self`, getFetchInit('get'));
    return await res.json();
  }

  function readBreachCount(value: unknown): number {
    const count = typeof value === 'string' || typeof value === 'number' ? Number(value) : 0;
    if (!Number.isFinite(count) || count <= 0) return 0;
    return count;
  }

  async function loadPasswordExposure() {
    try {
      const res = await fetch(`${props.domain}/api/v1/users/self/password-exposure`, getFetchInit('get'));
      if (!res.ok) return;
      const data = await res.json();
      setExposureState(String(data.state || '').trim().toLowerCase());
      setBreachCount(readBreachCount(data.breachCount));
    } catch (e) {
      console.error(e);
    }
  }

  async function sendPasswordReset() {
    if (isSubmitting() || username() === '') return;
    setIsSubmitting(true);
    setErrorMessage('');
    setPasswordNotice('');
    try {
      const res = await fetch(`${props.domain}/api/v1/password/reset/begin`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: username(),
          sectorID: props.sector,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as { message?: string }));
        setErrorMessage(data.message || banana.i18n('sa-reset-error'));
        return;
      }
      setPasswordNotice(banana.i18n('sa-reset-email-sent'));
    } catch (e) {
      console.error(e);
      setErrorMessage(banana.i18n('sa-reset-error'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function changePassword() {
    if (isSubmitting()) return;
    setIsSubmitting(true);
    setErrorMessage('');
    setPasswordNotice('');
    try {
      const requestInit = getFetchInit('post');
      requestInit.body = JSON.stringify({
        currentPassword: password(),
        newPassword: newPassword(),
      });
      const res = await fetch(`${props.domain}/api/v1/users/password`, requestInit);
      const data = await res.json().catch(() => ({} as { message?: string }));
      if (!res.ok) {
        setErrorMessage(data.message || banana.i18n('sa-password-change-error'));
        return;
      }
      setPassword('');
      setNewPassword('');
      setPasswordNotice(banana.i18n('sa-password-updated'));
      await loadPasswordExposure();
    } catch (e) {
      console.error(e);
      setErrorMessage(banana.i18n('sa-password-change-error'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function getFetchInit(method='get'): RequestInit {
    return {
      method: method,
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application',
        'Authorization': `bearer ${getSpartanToken()}`,
      }
    };
  }

  function beginWebAuthnRegistration() {
    if (isSubmitting()) return;
    setIsSubmitting(true);
    let requestInit = getFetchInit('post');
    requestInit.body = JSON.stringify({
      keyName: newKeyName(),
      sectorID: props.sector,
    });
    fetch(`${props.domain}/api/v1/webauthn/registration/begin`, requestInit).then((response) => {
      if (response.status === 200) {
        return response.json();
      } else {
        throw response;
      }
    }).then(data => {
      console.log(data);
      return finishWebAuthnRegistration(data as BeginWebAuthnRegistrationResponse)
    }).catch((res) => {
      if (res.json) {
        res.json().then((data: any) => {
          setErrorMessage(data.message);
        });
      } else {
        setErrorMessage(res);
      }
    }).finally(() => {
      setIsSubmitting(false);
    });
  }

  async function finishWebAuthnRegistration(beginResponse: BeginWebAuthnRegistrationResponse) {
    try {
      // @ts-ignore - type mismatch between Go JSON and CredentialCreationOptionsJSON but shapes are compatible
      const options = parseCreationOptionsFromJSON(beginResponse.Options);
      console.log("Parsed WebAuthn creation options:", options);
      const credResponse = await create(options);
      // converts the response properly to json
      const initBodyStr = JSON.stringify(credResponse)

      // but we need to augment it with a transactionID
      let rawBody = JSON.parse(initBodyStr);
      rawBody.transactionID = beginResponse.TransactionID;

      let requestInit = getFetchInit('post');
      requestInit.body = JSON.stringify(rawBody);
      // now send it to the server
      const response = await fetch(`${props.domain}/api/v1/webauthn/registration/finish`, requestInit);
      if (response.status !== 200) {
        const data = await response.json();
        setErrorMessage(data.message);
        return;
      }
      setShowAddKey(false);
      setNewKeyName('');
      getSecurityKeys();
    } catch (err: any) {
      console.error("WebAuthn registration error:", err);
      setErrorMessage(err?.message || String(err));
    }
  }

  async function removeWebAuthnRegistration(keyName: string) {
    let requestInit = getFetchInit('delete');
    requestInit.body = JSON.stringify({
      ID: keyName,
    });
    try {
      const res = await fetch(`${props.domain}/api/v1/webauthn/${keyName}`, requestInit);
      if (res.status !== 200) {
        setErrorMessage(banana.i18n('error-webauthn-remove'));
        return;
      }
      getSecurityKeys();
    } catch (e) {
      console.error(e);
      setErrorMessage(banana.i18n('error-webauthn-remove'));
      return
    }
  }

  async function getSecurityKeys() {
    let requestInit = getFetchInit('get');
    try {
      const res = await fetch(`${props.domain}/api/v1/webauthn/registration/list`, requestInit);
      const data: SecurityKeys = await res.json();
      setSecurityKeys(data.registrations || []);
    } catch (e) {
      console.error(e);
      setSecurityKeys([]);
    }
  }

  function initiateMFAValidation(destination: string, type: 'EMAIL' | 'SMS') {
    if (isSubmitting()) return;
    setIsSubmitting(true);
    callBeginOTPRegistration(destination, type).then((response) => {
      if (response) {
        return listOTPRegistrations().then((data) => {
          setOTPRegistrations(data.registrations);
          setTransactionID(response.transactionID);
          setShowMFAModal(true);
        });
      }
    }).finally(() => {
      setIsSubmitting(false);
    });
  }

  function callBeginOTPRegistration(destination: string, type: 'EMAIL' | 'SMS') {
    let requestInit = getFetchInit('post');
    requestInit.body = JSON.stringify({
      destination: destination,
      OTPType: otpTypeEnumValue(type),
      sectorID: props.sector,
    });
    return fetch(`${props.domain}/api/v1/otp/begin`, requestInit).then((res) => {
      if (res.status !== 200) {
        setErrorMessage(banana.i18n('error-otp-verification'));
        return;
      }
      return res.json();
    }).catch((e) => {
      console.error(e);
      setErrorMessage(banana.i18n('error-otp-registration'));
      return;
    });
  }

  function callFinishOTPRegistration(transactionID: string, otp: string) {
    if (isSubmitting()) return;
    setIsSubmitting(true);
    let requestInit = getFetchInit('post');
    requestInit.body = JSON.stringify({
      transactionID: transactionID,
      password: otp,
    });
    fetch(`${props.domain}/api/v1/otp/finish`, requestInit).then((res) => {
      if (res.status !== 200) {
        setModalErrorMessage(banana.i18n('error-otp-verification'));
        return;
      }
      setShowMFAModal(false);
      setNewOTP('');
      setShowAddMFA(false);
      setNewMFAPhone('');
      setNewMFAEmail('');
      listOTPRegistrations().then((data) => {
        setOTPRegistrations(data.registrations);
      });
      return res.json();
    }).catch((e) => {
      console.error(e);
      setModalErrorMessage(banana.i18n('error-otp-registration'));
      return;
    }).finally(() => {
      setIsSubmitting(false);
    });
  }

  async function listOTPRegistrations() {
    let requestInit = getFetchInit('get');
    try {
      const res = await fetch(`${props.domain}/api/v1/otp/list`, requestInit);
      return await res.json();
    } catch (e) {
      console.error(e);
      setErrorMessage(banana.i18n('error-otp-list'));
      return
    }
  }

  async function removeOTPRegistration(id: string) {
    let requestInit = getFetchInit('delete');
    requestInit.body = JSON.stringify({
      ID: id,
    });
    try {
      const res = await fetch(`${props.domain}/api/v1/otp/${id}`, requestInit);
      if (res.status !== 200) {
        setErrorMessage(banana.i18n('error-otp-remove'));
        return;
      }
      listOTPRegistrations().then((data) => {
        setOTPRegistrations(data.registrations);
      });
    } catch (e) {
      console.error(e);
      setErrorMessage(banana.i18n('error-otp-remove'));
      return
    }
  }

  function clearTotpSecret() {
    setTotpSecret('');
    setTotpOtpauthURL('');
    setTotpRegistrationID('');
    setNewTotpCode('');
  }

  async function listTOTPRegistrations() {
    const name = username() || 'self';
    try {
      const res = await fetch(
        `${props.domain}/api/v1/totp/${encodeURIComponent(name)}?sectorID=${encodeURIComponent(props.sector)}`,
        getFetchInit('get'),
      );
      if (!res.ok) {
        setErrorMessage(banana.i18n('error-totp-list'));
        setTotpRegistrations([]);
        return;
      }
      const data = await res.json();
      setTotpRegistrations(data.registrations || []);
    } catch (e) {
      console.error(e);
      setErrorMessage(banana.i18n('error-totp-list'));
      setTotpRegistrations([]);
    }
  }

  function beginTOTPRegistration() {
    if (isSubmitting() || newTotpName().trim() === '') return;
    setIsSubmitting(true);
    setErrorMessage('');
    setModalErrorMessage('');
    const requestInit = getFetchInit('post');
    requestInit.body = JSON.stringify({
      sectorID: props.sector,
      email: username(),
      displayName: newTotpName().trim(),
    });
    fetch(`${props.domain}/api/v1/totp/begin`, requestInit).then(async (res) => {
      if (res.status !== 200) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.message || banana.i18n('sa-totp-enroll-error'));
        return;
      }
      const data = await res.json();
      setTransactionID(data.transactionID || '');
      setTotpRegistrationID(data.registrationID || '');
      setTotpSecret(data.secret || '');
      setTotpOtpauthURL(data.otpauthURL || '');
      setNewTotpCode('');
      setShowAddTotp(false);
      setShowTotpEnroll(true);
    }).catch((e) => {
      console.error(e);
      setErrorMessage(banana.i18n('sa-totp-enroll-error'));
    }).finally(() => {
      setIsSubmitting(false);
    });
  }

  function finishTOTPRegistration() {
    if (isSubmitting()) return;
    const code = newTotpCode().replace(/\s+/g, '');
    if (!code) {
      setModalErrorMessage(banana.i18n('sa-totp-invalid'));
      return;
    }
    setIsSubmitting(true);
    setModalErrorMessage('');
    const requestInit = getFetchInit('post');
    requestInit.body = JSON.stringify({
      sectorID: props.sector,
      email: username(),
      transactionID: transactionID(),
      registrationID: totpRegistrationID(),
      code,
    });
    fetch(`${props.domain}/api/v1/totp/finish`, requestInit).then(async (res) => {
      if (res.status !== 200) {
        const data = await res.json().catch(() => ({}));
        setModalErrorMessage(data.message || banana.i18n('sa-totp-invalid'));
        return;
      }
      const data = await res.json();
      const codes = Array.isArray(data.recoveryCodes) ? data.recoveryCodes.filter((item: string) => !!item) : [];
      clearTotpSecret();
      setShowTotpEnroll(false);
      setNewTotpName('');
      await listTOTPRegistrations();
      if (codes.length > 0) {
        setTotpRecoveryCodes(codes);
        setShowTotpRecovery(true);
      }
    }).catch((e) => {
      console.error(e);
      setModalErrorMessage(banana.i18n('sa-totp-invalid'));
    }).finally(() => {
      setIsSubmitting(false);
    });
  }

  function cancelTOTPEnroll() {
    const id = totpRegistrationID();
    clearTotpSecret();
    setShowTotpEnroll(false);
    setModalErrorMessage('');
    // The secret was shown once. Drop the unfinished registration with it.
    if (id) {
      removeTOTPRegistration(id);
    }
  }

  function acknowledgeRecoveryCodes() {
    setTotpRecoveryCodes([]);
    setShowTotpRecovery(false);
  }

  async function removeTOTPRegistration(id: string) {
    const requestInit = getFetchInit('delete');
    requestInit.body = JSON.stringify({
      ID: id,
    });
    try {
      const res = await fetch(`${props.domain}/api/v1/totp/${encodeURIComponent(id)}`, requestInit);
      if (res.status !== 200) {
        if (res.status === 403) {
          setErrorMessage(banana.i18n('sa-totp-last-factor'));
        } else {
          setErrorMessage(banana.i18n('error-totp-remove'));
        }
        return;
      }
      await listTOTPRegistrations();
    } catch (e) {
      console.error(e);
      setErrorMessage(banana.i18n('error-totp-remove'));
    }
  }

  function otpTypeEnumValue(type: 'EMAIL' | 'SMS') {
    if (type === 'EMAIL') {
      return 2;
    } else {
      return 1;
    }
  }

  return (
    <div class={'container'}>
      <style>{style}</style>
      <style>{customStyles}</style>
      <h1 class={'header'}>{banana.i18n('sa-account-settings')}</h1>
      {errorMessage && <span class={'error-message'}>{errorMessage}</span>}
      <Show when={!settingsLoading()} fallback={
        <div class={'skeleton'} role="status" aria-busy="true">
          <span class={'sr-only'}>{banana.i18n('sa-loading')}</span>
          {showWebAuthn() && <div class={'skeleton-block'}></div>}
          <div class={'skeleton-group'}>
            <div class={'skeleton-line'}></div>
            <div class={'skeleton-row'}></div>
            <div class={'skeleton-block'}></div>
          </div>
          {flagOn(props.showTotp) && (
            <div class={'skeleton-group'}>
              <div class={'skeleton-line'}></div>
              <div class={'skeleton-row'}></div>
              <div class={'skeleton-block'}></div>
            </div>
          )}
        </div>
      }>
      {isAuthed() && (
        <div class={'section'}>
          <h2>{banana.i18n('sa-password')}</h2>
          <Show when={exposureState() === 'pwned'}>
            <div class={'warning'} role="status">
              <p>{banana.i18n('sa-pwned-warning')}</p>
              <Show when={breachCount() > 0}>
                <p>{banana.i18n('sa-pwned-warning-count', breachCount())}</p>
              </Show>
              <button type="button" class={'btn add'}
                      disabled={isSubmitting() || username() === ''}
                      onClick={() => sendPasswordReset()}>{banana.i18n('sa-pwned-send-reset')}</button>
            </div>
          </Show>
          {passwordNotice() && <span class={'success-message'}>{passwordNotice()}</span>}
          <div class={'password-form'}>
            <label for={'currentPassword'}>{banana.i18n('sa-current-password')}</label>
            <input id={'currentPassword'} type={'password'} autocomplete={'current-password'}
                   value={password()}
                   onInput={(e) => setPassword(e.currentTarget.value)}/>
            <label for={'newPassword'}>{banana.i18n('sa-new-password')}</label>
            <input id={'newPassword'} type={'password'} autocomplete={'new-password'}
                   value={newPassword()}
                   onInput={(e) => setNewPassword(e.currentTarget.value)}/>
            <button type="button" class={'btn add'}
                    disabled={isSubmitting()}
                    onClick={() => changePassword()}>{banana.i18n('sa-password-update')}</button>
          </div>
        </div>
      )}
      {showWebAuthn() && !!securityKeys().length && (
        <div class={'section'}>
          <h2>{banana.i18n('sa-webauthn-security-keys')}</h2>
          <div class={'security-keys'}>
            {securityKeys().map((key) => (
              <div class={'key-item'}>
                <span>{key.keyName}</span>
                <button class={'btn remove'}
                        onClick={() => {
                          if (confirm(banana.i18n('sa-confirm-delete-key'))) {
                            // delete key
                            removeWebAuthnRegistration(key.keyName);
                          }
                        }}>{banana.i18n('sa-remove')}</button>
              </div>
            ))}
            {securityKeys().length <= 0 && (
              <span>{banana.i18n('sa-no-security-keys')}</span>
            )}

          </div>
        </div>
      )}
      {showWebAuthn() && (
        <div class={'section'}>
          <div class={'security-keys'}>
          {!showAddKey() && (
            <button class={'btn add'}
                    onClick={() => setShowAddKey(true)}>+ {banana.i18n('sa-add-security-key')}</button>
          )}
          {showAddKey() && (
            <div class={'add-key-form'}>
              <div class={'add-key-item'}>
                <label for={'keyName'} style={'display: none;'}>{banana.i18n('sa-webauthn-key-name')}</label>
                <input id={'keyName'} type={'text'} placeholder={banana.i18n('sa-webauthn-key-name')}
                       value={newKeyName()}
                       onInput={(e) => setNewKeyName(e.currentTarget.value)}/>
                <button class={'btn remove'}
                        onClick={() => setShowAddKey(false)}>{banana.i18n('sa-cancel')}</button>
                <button class={'btn add'} onClick={() => newKeyName() !== '' && beginWebAuthnRegistration()}
                        disabled={newKeyName() === '' || isSubmitting()}>{banana.i18n('sa-register')}</button>
              </div>
            </div>
          )}
          </div>
        </div>
      )}
      {otpRegistrations().length > 0 && (
        <div class={'section'}>
          <h2>{banana.i18n('sa-mfa')}</h2>
          <table>
          <thead>
            <tr>
              <th>{banana.i18n('sa-mfa-destination')}</th>
              <th>{banana.i18n('sa-mfa-validated')}</th>
              <th>{banana.i18n('sa-mfa-action')}</th>
            </tr>
            </thead>
            <tbody>
            {otpRegistrations().map((otp) => (
              <tr class={'mfa-list-item'}>
                <td title={otp.DisplayName}>{otp.DisplayName}</td>
                <td>{otp.Validated ? (
                  <span>{banana.i18n('sa-yes')}</span>
                ) : <span>
                  {banana.i18n('sa-no')}
                  &nbsp; <button class={'btn validate'} disabled={isSubmitting()} onClick={() => {initiateMFAValidation(otp.DisplayName, otp.Type === 'email' ? "EMAIL" : "SMS")}}>{banana.i18n('sa-validate')}</button>
                  </span>
                }</td>
                <td>
                  <button class={'btn remove'} onClick={() => {
                    if (confirm(banana.i18n('sa-confirm-delete-key'))) {
                      removeOTPRegistration(otp.ID)
                    }}}>{banana.i18n('sa-remove')}</button>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}
      {!showAddMFA() && (
        <div class={'section'}>
          <div class={'mfa-manage'}>
            <button class={'btn add'}
                    onClick={() => setShowAddMFA(true)}>+ {banana.i18n('sa-register-mfa')}</button>
          </div>
        </div>
      )}
      {showAddMFA() && (
        <div class={'section'}>
          <h2>{banana.i18n('sa-add-mfa')}</h2>
          <div class={'mfa-manage'}>
            <div class={'mfa-item'}>
              <label for={'email'}>{banana.i18n('sa-email')}</label>
              <input id="email" type={'text'} placeholder={banana.i18n('sa-email')} value={newMFAEmail()}
                     onInput={(e) => setNewMFAEmail(e.currentTarget.value)}></input>
              <button class={'btn add'} disabled={isSubmitting()}
                      onClick={() => initiateMFAValidation(newMFAEmail(), 'EMAIL')}>{banana.i18n('sa-add-email')}</button>
            </div>
            <div class={'mfa-item'}>
              <label for={'phone'}>{banana.i18n('sa-phone')}</label>
              <input id="phone" type={'text'} placeholder={banana.i18n('sa-phone')} value={newMFAPhone()}
                     onInput={(e) => setNewMFAPhone(e.currentTarget.value)}></input>
              <button class={'btn add'} disabled={isSubmitting()}
                      onClick={() => initiateMFAValidation(newMFAPhone(), 'SMS')}>{banana.i18n('sa-add-sms')}</button>
            </div>
            <div class={'mfa-item'}>
              <button class={'btn remove'}
                      onClick={() => setShowAddMFA(false)}>{banana.i18n('sa-cancel')}</button>
            </div>
          </div>
        </div>
      )}
      {flagOn(props.showTotp) && (
        <div class={'section'}>
          <h2>{banana.i18n('sa-totp-title')}</h2>
          {totpRegistrations().length === 0 && (
            <span>{banana.i18n('sa-totp-none')}</span>
          )}
          {totpRegistrations().length > 0 && (
            <table>
              <thead>
              <tr>
                <th>{banana.i18n('sa-totp-name')}</th>
                <th>{banana.i18n('sa-mfa-validated')}</th>
                <th>{banana.i18n('sa-mfa-action')}</th>
              </tr>
              </thead>
              <tbody>
              {totpRegistrations().map((reg) => (
                <tr class={'totp-list-item'}>
                  <td title={reg.DisplayName}>{reg.DisplayName}</td>
                  <td>{reg.Validated ? banana.i18n('sa-yes') : banana.i18n('sa-no')}</td>
                  <td>
                    <button class={'btn remove'} onClick={() => {
                      if (confirm(banana.i18n('sa-confirm-delete-totp'))) {
                        removeTOTPRegistration(reg.ID);
                      }
                    }}>{banana.i18n('sa-remove')}</button>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {flagOn(props.showTotp) && !showAddTotp() && (
        <div class={'section'}>
          <div class={'mfa-manage'}>
            <button class={'btn add'}
                    onClick={() => setShowAddTotp(true)}>+ {banana.i18n('sa-totp-add')}</button>
          </div>
        </div>
      )}
      {flagOn(props.showTotp) && showAddTotp() && (
        <div class={'section'}>
          <div class={'add-key-form'}>
            <div class={'add-key-item'}>
              <label for={'totpName'} style={'display: none;'}>{banana.i18n('sa-totp-name')}</label>
              <input id={'totpName'} type={'text'} placeholder={banana.i18n('sa-totp-name')}
                     value={newTotpName()}
                     onInput={(e) => setNewTotpName(e.currentTarget.value)}/>
              <button class={'btn remove'}
                      onClick={() => { setShowAddTotp(false); setNewTotpName(''); }}>{banana.i18n('sa-cancel')}</button>
              <button class={'btn add'}
                      onClick={() => beginTOTPRegistration()}
                      disabled={newTotpName().trim() === '' || isSubmitting()}>{banana.i18n('sa-register')}</button>
            </div>
          </div>
        </div>
      )}
      {showMFAModal() && (
        <div class={"modal"} id="mfaModal" onClick={() => setShowMFAModal(false)}>
          <div class={"modal-content"} onClick={(e) => e.stopPropagation()}>
            <span class={"close"} id="closeModal" onClick={() => setShowMFAModal(false)}>&times;</span>
            <h2>MFA Verification</h2>
            {modalErrorMessage() && <span class={'error-message'}>{modalErrorMessage()}</span>}
            <p>Please enter the verification code sent to your email or phone:</p>
            <input type="text" id="mfaCode" placeholder="Enter verification code" value={newOTP()} onInput={(e) => setNewOTP(e.currentTarget.value)}/>
            <button class={"btn verify"} id="verifyMfa" disabled={isSubmitting()} onClick={() => callFinishOTPRegistration(transactionID(), newOTP())}>Verify</button>
          </div>
        </div>
      )}
      {showTotpEnroll() && (
        <div class={"modal"} onClick={() => cancelTOTPEnroll()}>
          <div class={"modal-content totp-modal"} onClick={(e) => e.stopPropagation()}>
            <span class={"close"} onClick={() => cancelTOTPEnroll()}>&times;</span>
            <h2>{banana.i18n('sa-totp-enroll-title')}</h2>
            {modalErrorMessage() && <span class={'error-message'}>{modalErrorMessage()}</span>}
            <p>{banana.i18n('sa-totp-enroll-prompt')}</p>
            {totpOtpauthURL() && (
              <div class={"qr"} innerHTML={totpQrSvg(totpOtpauthURL())}></div>
            )}
            <input class={"secret-field"} type="text" readOnly value={totpSecret()}
                   aria-label={banana.i18n('sa-totp-secret')}/>
            <input type="text" placeholder={banana.i18n('sa-totp-code')} value={newTotpCode()}
                   autocomplete="one-time-code"
                   onInput={(e) => setNewTotpCode(e.currentTarget.value)}/>
            <button class={"btn verify"} disabled={isSubmitting()}
                    onClick={() => finishTOTPRegistration()}>{banana.i18n('sa-totp-enroll-verify')}</button>
          </div>
        </div>
      )}
      {showTotpRecovery() && (
        <div class={"modal"}>
          <div class={"modal-content totp-modal"}>
            <h2>{banana.i18n('sa-totp-recovery-title')}</h2>
            <p>{banana.i18n('sa-totp-recovery-prompt')}</p>
            <ul class={"recovery-codes"}>
              {totpRecoveryCodes().map((code) => (
                <li><code>{code}</code></li>
              ))}
            </ul>
            <button class={"btn verify"} onClick={() => acknowledgeRecoveryCodes()}>{banana.i18n('sa-totp-recovery-saved')}</button>
          </div>
        </div>
      )}
      </Show>
    </div>
  );
});

interface BeginWebAuthnRegistrationResponse {
  Options: PublicKeyCreds;
  SectorID: string;
  TransactionID: string;
}

interface PublicKeyCreds {
  publicKey: PubKeyCredentialCreationOptions;
}

interface PubKeyCredentialCreationOptions {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout: number;
  attestation: "direct" | "enterprise" | "indirect" | "none";
  excludeCredentials: PublicKeyCredentialDescriptor[];
  authenticatorSelection: AuthenticatorSelectionCriteria;
  extensions: AuthenticationExtensionsClientInputs;
}


type SecurityKey = {
  keyName: string;
}

interface SecurityKeys {
  registrations: SecurityKey[];
}

interface OTPRegistration {
  Type: "email" | "phone";
  DisplayName: string;
  ID: string;
  Validated: boolean;
}

interface TOTPRegistration {
  DisplayName: string;
  ID: string;
  Validated: boolean;
}