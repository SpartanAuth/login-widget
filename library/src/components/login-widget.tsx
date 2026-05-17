import {createSignal, onMount} from "solid-js";
import { customElement } from "solid-element";
import { setupBanana } from './banana';

import {
  get,
  parseRequestOptionsFromJSON,
} from "@github/webauthn-json/browser-ponyfill";
import {getDecodedSpartanToken} from "./spartanToken";

const style = `.login-frame {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  border: 1px solid #ccc;
  padding: 40px 40px;
  max-width: 350px;
  min-width: 290px;
  background-color: rgba(255,255,255,0.9);
}


  .login-frame h1 {
    margin: 0;
    align-self: start;
  }

  .login-frame input, .login-frame button, .login-frame select {
    margin: 20px 0 0 0;
    padding: 10px;
  }

  .login-frame .checkbox-wrapper {
    align-self: start;
    cursor: pointer;
  }

  .login-frame button {
    background-color: #00f0f0;
    border: 1px solid #ccc;
    color: #333;
    border-radius: 10px;
  }

  .login-frame select {
    background-color: #ffffff;
    border: 1px solid #ccc;
    color: #333;
    border-radius: 10px;
    font-size: inherit;
    font-family: inherit;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23333' d='M6 8L0 0h12z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
    width: 100%;
    box-sizing: border-box;
  }

  .login-frame select:focus {
    outline: none;
    border-color: #00f0f0;
  }
  
  .login-frame .error-message {
    color: red;
    // margin: 10px 0;
  }
  .centered-text {
    text-align: center;
  }

  .social-divider {
    display: flex;
    align-items: center;
    margin: 20px 0 4px 0;
    color: #888;
    font-size: 0.85em;
  }
  .social-divider::before, .social-divider::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid #ccc;
  }
  .social-divider span {
    margin: 0 10px;
  }

  .social-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin: 8px 0 0 0;
    padding: 10px;
    width: 100%;
    border: 1px solid #ccc;
    border-radius: 10px;
    background: #fff;
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
    box-sizing: border-box;
    color: #333;
  }
  .social-btn:hover:not(:disabled) {
    background-color: #f5f5f5;
  }
  .social-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  `;

const defaultProps = {
  domain: "http://127.0.0.1:11000",
  sector: "0ad5c3e5-0186-4557-8b32-4b36f247bf09", // defaults to the admin sector
  startMode: 'password',
  styles: "",
  locale: "en",
  redirect: '',
};

customElement("spartan-login", defaultProps, (props) => {
  const [currMode, setMode] = createSignal((props.startMode || 'password').toLowerCase());
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [otp, setOTP] = createSignal("");
  const [errorMessage, setErrorMessage] = createSignal("");
  const [redirect, setRedirect] = createSignal(props.redirect);
  const [selfSignUpAllowed, setSelfSignUpAllowed] = createSignal(false);
  const [signUpComplete, setSignUpComplete] = createSignal(false);
  const [resetComplete, setResetComplete] = createSignal(false);
  const [resetCode, setResetCode] = createSignal("");
  const [newPassword, setNewPassword] = createSignal("");
  const [otpRegistrations, setOTPRegistrations] = createSignal<Array<{ID?: string; DisplayName?: string; Type?: string}>>([]);
  const [selectedRegistrationID, setSelectedRegistrationID] = createSignal("");
  const [socialProviders, setSocialProviders] = createSignal<Array<{provider: string, enabled: boolean, clientID: string}>>([]);
  const [socialLoading, setSocialLoading] = createSignal("");
  const banana = setupBanana(props.locale);
  let hostRef!: HTMLFormElement;
  let customStyles;
  try {
    customStyles = props.styles;
  } catch(e) {
    customStyles = '';
  }
  console.log(customStyles);

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);

    // Handle OAuth error redirect: ?error=...&error_description=...
    const oauthError = params.get('error');
    if (oauthError) {
      history.replaceState({}, '', window.location.pathname);
      const description = params.get('error_description');
      setErrorMessage(description || banana.i18n('sa-social-error'));
      getSectorSettings();
      getSocialProviders();
      return;
    }

    // Handle OAuth success redirect: exchange short-lived code for JWT.
    const oauthCode = params.get('code');
    if (oauthCode) {
      history.replaceState({}, '', window.location.pathname);
      try {
        const resp = await fetch(`${props.domain}/api/v1/oauth/exchange`, {
          method: 'POST',
          mode: 'cors',
          cache: 'no-cache',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: oauthCode }),
        });
        if (!resp.ok) throw new Error(banana.i18n('sa-social-error'));
        const data = await resp.json();
        localStorage.setItem('spartan-token', data.token);
        const hostEl = (hostRef.getRootNode() as ShadowRoot).host;
        hostEl.dispatchEvent(new CustomEvent('spartan-login', {
          bubbles: true,
          cancelable: true,
          detail: { token: data.token },
        }));
        if (props.redirect !== '') {
          window.location.href = props.redirect;
        }
      } catch (err: any) {
        setErrorMessage(err.message || banana.i18n('sa-social-error'));
      }
      return;
    }

    let token = getDecodedSpartanToken();
    if (token && props.redirect !== '' && window.location.pathname !== props.redirect) {
      window.location.href = props.redirect;
      return;
    }
    getSectorSettings();
    getSocialProviders();
  })

  function getSectorSettings() {
    fetch(`${props.domain}/api/v1/sectors/${props.sector}/publicsettings`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
      }
    }).then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Network response was not ok.');
      }

    }).then(data => {
      console.log(data);
      // if self-signup is enabled, show the signup button
      setSelfSignUpAllowed(data.SelfSignUpAllowed);
    }).catch((err: Error) => {
      console.log(err);
      setErrorMessage(err.message);
    });
  }

  function getSocialProviders() {
    fetch(`${props.domain}/api/v1/sectors/${props.sector}/oauth/providers`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
    }).then(response => {
      if (response.ok) return response.json();
      throw new Error('Failed to load social providers');
    }).then(data => {
      const enabled = (data.providers || []).filter(
        (p: {provider: string, enabled: boolean, clientID: string}) => p.enabled
      );
      setSocialProviders(enabled);
    }).catch(() => {
      // silently ignore — social buttons simply won't appear
    });
  }

  function initiateOAuth(provider: string) {
    if (socialLoading()) return;
    setSocialLoading(provider);
    setErrorMessage("");
    const redirectURI = window.location.origin + window.location.pathname;
    fetch(`${props.domain}/api/v1/oauth/${provider}/initiate`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectorID: props.sector, redirectURI }),
    }).then(response => {
      if (response.ok) return response.json();
      throw new Error(banana.i18n('sa-social-error'));
    }).then(data => {
      window.location.href = data.authURL;
    }).catch((err: Error) => {
      setSocialLoading("");
      setErrorMessage(err.message);
    });
  }

  function login(e: Event) {
    e.preventDefault();
    console.log("login");
    setErrorMessage("");
    if (currMode() === 'password') {
      passwordLogin();
    } else if (currMode() === 'webauthn') {
      webauthnLogin();
    } else if (currMode() === 'otp-pick') {
      // User selected a registration from the picker
      beginOTP(selectedRegistrationID());
    } else if (currMode() === 'otp') {
      otpLogin();
    } else if (currMode() === 'reset-email') {
      beginPasswordReset();
    } else if (currMode() === 'reset-code') {
      completePasswordReset();
    }
  }

  function signup(e: Event) {
    e.preventDefault();
    console.log("signup");
    setErrorMessage("");
    setSignUpComplete(false);

    fetch(`${props.domain}/api/v1/users`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      body: JSON.stringify({
        username: username(),
        password: password(),
        sectorID: props.sector,
      })
    }).then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error(banana.i18n('sa-error-creating-user'));
      }
    }).then(data => {
      console.log(data);
      setSignUpComplete(true);
      setMode(props.startMode);
    }).catch((err: Error) => {
      setSignUpComplete(false);
      setErrorMessage(err.message);
      console.log(err);
    });
  }

  function webauthnLogin() {
    console.log("webauthnLogin");
    fetch(`${props.domain}/api/v1/login/webauthn/begin`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      body: JSON.stringify({
        username: username(),
        sectorID: props.sector,
      })
    }).then(response => {
      if (response.ok) {
        return response.json();
      } else {
        // handle 401
        if (response.status === 401) {
          setMode('password');
          setErrorMessage(banana.i18n('webauthn-not-enrolled'));
          throw new Error(banana.i18n('webauthn-not-enrolled'));
        }
        throw new Error(`${response.status} ${response.statusText}: Network response was not ok.`);
      }
    }).then((data) => {
      // Handle user token input here
      console.log(data);
      const publicKey = parseRequestOptionsFromJSON(data.CredentialAssertion);
      console.log("Parsed WebAuthn request options:", publicKey);
      return get(publicKey).then((pubKeyCredential) => {
        const pubKeyBodyStr = JSON.stringify(pubKeyCredential)
        let rawBody = JSON.parse(pubKeyBodyStr);
        rawBody.transactionID = data.TransactionID;
        return rawBody;
      });
    }).then((pubKeyResponse) => {
      return fetch(`${props.domain}/api/v1/login/webauthn/finish`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        body: JSON.stringify(pubKeyResponse)
      });
    }).then(handleLoginResponse).catch((err: Error) => {
      setErrorMessage(err.message);
      console.log(err);
    });
  }

  function passwordLogin() {
    console.log("password login");
    fetch(props.domain + "/api/v1/login/password", {
      method: 'post',
      mode: 'cors',
      cache: 'no-cache',
      body: JSON.stringify({
        username: username(),
        password: password(),
        sectorID: props.sector,
      })
    }).then(handleLoginResponse);
  }

  async function handleLoginResponse(response: Response) {
    let promise = Promise.resolve(response);
    promise.then((res) => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Network response was not ok.');
      }
    }).then(data => {
      console.log(data);
      localStorage.setItem('spartan-txid', data.transactionID);

      if (!data.token) {
        // check data.challengeType to determine if otp or webauthn is required
        if (data.challengeType.indexOf('otp') !== -1) {
          listOTPRegistrations();
        } else if (data.challengeType.indexOf('webauthn') !== -1) {
          setMode('webauthn');
          setErrorMessage(banana.i18n('sa-webauthn-required'));
        } else {
          setErrorMessage(banana.i18n('sa-unknown-challenge'));
        }
        return;
      }

      localStorage.setItem('spartan-token', data.token);


      // emit a custom event with the token
      const event = new CustomEvent('spartan-login', {
        bubbles: true,
        cancelable: true,
        detail: {
          token: data.token,
          transactionID: data.transactionID,
        }
      });

      // dispatch the event on the custom element
      const hostEl = (hostRef.getRootNode() as ShadowRoot).host;
      hostEl.dispatchEvent(event);
      if (redirect() !== '') {
        window.location.href = redirect();
      }
    }).catch((res) => {
      res.json().then((data:any) => {
        console.log(data.message);
        setErrorMessage(data.message);
      }).catch((e: Error) => {
        console.log(e);
      });
      console.log(res);
    });
    return promise;
  }

  function listOTPRegistrations() {
    const txid = localStorage.getItem('spartan-txid') || '';
    fetch(props.domain + `/api/v1/otp/${encodeURIComponent(username())}?transactionID=${encodeURIComponent(txid)}&sectorID=${encodeURIComponent(props.sector)}`, {
      method: 'get',
      mode: 'cors',
      cache: 'no-cache',
    }).then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error(banana.i18n('error-otp-list'));
      }
    }).then(data => {
      const regs: Array<{ID?: string; DisplayName?: string; Type?: string}> = data.registrations || [];
      if (regs.length === 0) {
        setErrorMessage(banana.i18n('sa-otp-no-registrations'));
        return;
      }
      if (regs.length === 1) {
        // Auto-select the only registration
        beginOTP(regs[0].ID || '');
      } else {
        // Present the picker
        setOTPRegistrations(regs);
        setSelectedRegistrationID(regs[0].ID || '');
        setMode('otp-pick');
        setErrorMessage('');
      }
    }).catch((err: Error) => {
      setErrorMessage(err.message);
      console.log(err);
    });
  }

  function beginOTP(registrationID: string) {
    console.log("begin OTP, registrationID:", registrationID);
    fetch(props.domain + "/api/v1/login/otp/begin", {
      method: 'post',
      mode: 'cors',
      cache: 'no-cache',
      body: JSON.stringify({
        username: username(),
        transactionID: localStorage.getItem('spartan-txid'),
        registrationID: registrationID,
        sectorID: props.sector,
      })
    }).then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error(`${response.status} ${response.statusText}`);
      }
    }).then(data => {
      console.log(data);
      // beginOTP may return a new transactionID
      if (data.transactionID) {
        localStorage.setItem('spartan-txid', data.transactionID);
      }
      setOTP('');
      setErrorMessage('');
      setMode('otp');
    }).catch((err: Error) => {
      setErrorMessage(err.message);
      console.log(err);
    });
  }

  function otpLogin() {
    console.log("OTP login submit");
    fetch(props.domain + "/api/v1/login/otp", {
      method: 'post',
      mode: 'cors',
      cache: 'no-cache',
      body: JSON.stringify({
        username: username(),
        password: otp(),
        transactionID: localStorage.getItem('spartan-txid'),
        sectorID: props.sector,
      })
    }).then(handleLoginResponse);
  }

  function beginPasswordReset() {
    console.log("begin password reset");
    setErrorMessage("");
    setResetComplete(false);

    fetch(`${props.domain}/api/v1/password/reset/begin`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: username(),
        sectorID: props.sector,
      })
    }).then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error(banana.i18n('sa-reset-error'));
      }
    }).then(data => {
      console.log(data);
      setErrorMessage(banana.i18n('sa-reset-email-sent'));
      setResetCode('');
      setNewPassword('');
      setMode('reset-code');
    }).catch((err: Error) => {
      setErrorMessage(err.message);
      console.log(err);
    });
  }

  function completePasswordReset() {
    console.log("complete password reset");
    setErrorMessage("");

    fetch(`${props.domain}/api/v1/password/reset/complete`, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: username(),
        code: resetCode().toUpperCase().trim(),
        newPassword: newPassword(),
        sectorID: props.sector,
      })
    }).then(response => {
      if (response.ok) {
        return response.json();
      } else {
        if (response.status === 400) {
          throw new Error(banana.i18n('sa-reset-error-code'));
        }
        throw new Error(banana.i18n('sa-reset-error'));
      }
    }).then(data => {
      console.log(data);
      setResetComplete(true);
      setResetCode('');
      setNewPassword('');
      setPassword('');
      setMode(props.startMode);
    }).catch((err: Error) => {
      setErrorMessage(err.message);
      console.log(err);
    });
  }

  return (
    <form class={'login-frame'} onSubmit={(e) => {currMode() === 'sign-up' ? signup(e) : login(e); }} ref={hostRef}>
      <style>{style}</style>
      <style>{customStyles}</style>
      <h1>{(currMode() === 'reset-email' || currMode() === 'reset-code') ? banana.i18n('sa-reset-password') : banana.i18n('sa-login')}</h1>
      {errorMessage && <span class={'error-message'}>{errorMessage()}</span>}
      {signUpComplete() && (<span>{banana.i18n('sa-signup-complete')}</span>)}
      {resetComplete() && (<span>{banana.i18n('sa-reset-success')}</span>)}
      <input type="text"
             placeholder={banana.i18n('sa-username')}
             value={username()}
             onInput={(e) => setUsername(e.currentTarget.value)}
             disabled={currMode() === "otp" || currMode() === "otp-pick" || currMode() === "reset-code"}
      ></input>
      { currMode() !== "sign-up" && (
        <>
          {currMode() === "password" && (
            <input type="password"
                   placeholder={banana.i18n('sa-password')}
                   value={password()}
                   onInput={(e) => setPassword(e.currentTarget.value)}
            ></input>
          )}
          {currMode() === "webauthn" && (
            <span></span>
          )}
          {currMode() === "otp-pick" && (
            <>
              <p>{banana.i18n('sa-otp-choose')}</p>
              <select
                value={selectedRegistrationID()}
                onChange={(e) => setSelectedRegistrationID(e.currentTarget.value)}
              >
                {otpRegistrations().map((reg) => (
                  <option value={reg.ID}>
                    {reg.DisplayName || reg.ID} ({reg.Type})
                  </option>
                ))}
              </select>
            </>
          )}
          {currMode() === "otp" && (
            <input type="text"
                   value={otp()}
                   placeholder={banana.i18n('sa-code')}
                   onInput={(e) => setOTP(e.currentTarget.value)}
            ></input>
          )}
          {currMode() === "reset-code" && (
            <>
              <input type="text"
                     value={resetCode()}
                     placeholder={banana.i18n('sa-reset-code')}
                     onInput={(e) => setResetCode(e.currentTarget.value)}
                     autocomplete="one-time-code"
              ></input>
              <input type="password"
                     value={newPassword()}
                     placeholder={banana.i18n('sa-new-password')}
                     onInput={(e) => setNewPassword(e.currentTarget.value)}
                     autocomplete="new-password"
              ></input>
            </>
          )}
          {(currMode() === "password" || currMode() === "webauthn") && (
            <span class={"checkbox-wrapper"}
                  onClick={() => setMode(currMode() === 'password' ? 'webauthn' : 'password')}>
              <input type="checkbox" checked={currMode() === 'password'}></input>
              <span>&nbsp;{banana.i18n('sa-use-password')}</span>
            </span>
          )}
        </>
      )}

      {currMode() === "sign-up" && (
        <input type="password"
           placeholder={banana.i18n('sa-password')}
           value={password()}
           onInput={(e) => setPassword(e.currentTarget.value)}
        ></input>
      )}

      <button type="submit">
        {currMode() === 'sign-up'
          ? banana.i18n('sa-signup')
          : currMode() === 'otp-pick'
            ? banana.i18n('sa-otp-send-code')
            : currMode() === 'otp'
              ? banana.i18n('sa-otp-verify')
              : currMode() === 'reset-email'
                ? banana.i18n('sa-otp-send-code')
                : currMode() === 'reset-code'
                  ? banana.i18n('sa-reset-submit')
                  : banana.i18n('sa-login')}
      </button>
      {currMode() === "password" && (
        <a class={'centered-text'} href="#" onClick={() => { setErrorMessage(''); setResetComplete(false); setMode('reset-email'); }}>{banana.i18n('sa-forgot-password')}</a>
      )}
      {(currMode() === "reset-email" || currMode() === "reset-code") && (
        <a class={'centered-text'} href="#" onClick={() => { setErrorMessage(''); setResetCode(''); setNewPassword(''); setMode(props.startMode); }}>{banana.i18n('sa-back')}</a>
      )}
      {selfSignUpAllowed() && currMode() !== "reset-email" && currMode() !== "reset-code" && (
        <a class={'centered-text'} href="#" onClick={() => currMode() === 'sign-up' ? setMode(props.startMode) : setMode('sign-up')}>{currMode() === 'sign-up' ? banana.i18n('sa-back') : banana.i18n('sa-signup')}</a>
      )}

      {socialProviders().length > 0
        && (currMode() === 'password' || currMode() === 'webauthn' || currMode() === 'sign-up')
        && (
        <>
          <div class="social-divider"><span>{banana.i18n('sa-or')}</span></div>
          {socialProviders().map(p => (
            <button
              type="button"
              class="social-btn"
              disabled={!!socialLoading()}
              onClick={() => initiateOAuth(p.provider)}
            >
              {p.provider === 'google' && (
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
              )}
              {p.provider === 'github' && (
                <svg width="18" height="18" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                  <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" fill="currentColor"/>
                </svg>
              )}
              {p.provider === 'apple' && (
                // <svg width="18" height="18" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg">
                //   <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.8 134.4-317.3 266.5-317.3 100.3 0 183.4 67.7 244.6 67.7 57.3 0 147.4-71.6 260.1-71.6zm-174.5-92.5c-50.9 67-123.1 110.6-195.7 110.6-8.3 0-16.6-.8-24.8-2.5 1.7-63.2 43.3-131.2 94.1-179.3 52.7-49.9 132.7-85.3 207.3-87.5 1.6 8.8 2.4 17.7 2.4 26.7 0 61.6-28.4 127-83.3 131.9z" fill="currentColor"/>
                // </svg>
                <svg
                  width="18" height="18"
                  viewBox="20 16 16 19"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M28.2226562,20.3846154 C29.0546875,20.3846154 30.0976562,19.8048315 30.71875,19.0317864 C31.28125,18.3312142 31.6914062,17.352829 31.6914062,16.3744437 C31.6914062,16.2415766 31.6796875,16.1087095 31.65625,16 C30.7304687,16.0362365 29.6171875,16.640178 28.9492187,17.4494596 C28.421875,18.06548 27.9414062,19.0317864 27.9414062,20.0222505 C27.9414062,20.1671964 27.9648438,20.3121424 27.9765625,20.3604577 C28.0351562,20.3725366 28.1289062,20.3846154 28.2226562,20.3846154 Z M25.2929688,35 C26.4296875,35 26.9335938,34.214876 28.3515625,34.214876 C29.7929688,34.214876 30.109375,34.9758423 31.375,34.9758423 C32.6171875,34.9758423 33.4492188,33.792117 34.234375,32.6325493 C35.1132812,31.3038779 35.4765625,29.9993643 35.5,29.9389701 C35.4179688,29.9148125 33.0390625,28.9122695 33.0390625,26.0979021 C33.0390625,23.6579784 34.9140625,22.5588048 35.0195312,22.474253 C33.7773438,20.6382708 31.890625,20.5899555 31.375,20.5899555 C29.9804688,20.5899555 28.84375,21.4596313 28.1289062,21.4596313 C27.3554688,21.4596313 26.3359375,20.6382708 25.1289062,20.6382708 C22.8320312,20.6382708 20.5,22.5950413 20.5,26.2911634 C20.5,28.5861411 21.3671875,31.013986 22.4335938,32.5842339 C23.3476562,33.9129053 24.1445312,35 25.2929688,35 Z"
                    fill="currentColor"
                    fill-rule="nonzero"
                  />
                </svg>

              )}
              {p.provider === 'oidc' && (
                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4a3 3 0 110 6 3 3 0 010-6zm0 14c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08s5.97 1.09 6 3.08c-1.29 1.94-3.5 3.22-6 3.22z" fill="currentColor"/>
                </svg>
              )}
              {p.provider === 'google' ? banana.i18n('sa-social-google')
                : p.provider === 'github' ? banana.i18n('sa-social-github')
                : p.provider === 'apple' ? banana.i18n('sa-social-apple')
                : banana.i18n('sa-social-oidc')}
            </button>
          ))}
        </>
      )}
    </form>
  );
});
