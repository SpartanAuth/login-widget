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
  const [currMode, setMode] = createSignal(props.startMode);
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [otp, setOTP] = createSignal("");
  const [errorMessage, setErrorMessage] = createSignal("");
  const [redirect, setRedirect] = createSignal(props.redirect);
  const [selfSignUpAllowed, setSelfSignUpAllowed] = createSignal(false);
  const [signUpComplete, setSignUpComplete] = createSignal(false);
  const [otpRegistrations, setOTPRegistrations] = createSignal<Array<{ID?: string; DisplayName?: string; Type?: string}>>([]);
  const [selectedRegistrationID, setSelectedRegistrationID] = createSignal("");
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
    let token = getDecodedSpartanToken();
    if (token && props.redirect !== '' && window.location.pathname !== props.redirect) {
      window.location.href = props.redirect;
      return;
    }
    getSectorSettings();
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
      const options = parseRequestOptionsFromJSON(data.CredentialAssertion);
      return get(options).then((pubKeyCredential) => {
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

  return (
    <form class={'login-frame'} onSubmit={(e) => {currMode() === 'sign-up' ? signup(e) : login(e); }} ref={hostRef}>
      <style>{style}</style>
      <style>{customStyles}</style>
      <h1>{banana.i18n('sa-login')}</h1>
      {errorMessage && <span class={'error-message'}>{errorMessage()}</span>}
      {signUpComplete() && (<span>{banana.i18n('sa-signup-complete')}</span>)}
      <input type="text"
             placeholder={banana.i18n('sa-username')}
             value={username()}
             onInput={(e) => setUsername(e.currentTarget.value)}
             disabled={currMode() === "otp" || currMode() === "otp-pick"}
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

      <button type="submit">{currMode() === 'sign-up' ? banana.i18n('sa-signup') : banana.i18n('sa-login')}</button>
      {selfSignUpAllowed() && (
        <a class={'centered-text'} href="#" onClick={() => currMode() === 'sign-up' ? setMode(props.startMode) : setMode('sign-up')}>{currMode() === 'sign-up' ? banana.i18n('sa-back') : banana.i18n('sa-signup')}</a>
      )}
    </form>
  );
});
