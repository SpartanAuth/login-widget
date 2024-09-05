import {createSignal, onMount} from "solid-js";
import {customElement} from "solid-element";
import {setupBanana} from './banana';
import {getDecodedSpartanToken, getSpartanToken} from "./spartanToken";

import {
  create,
  parseCreationOptionsFromJSON,
} from "@github/webauthn-json/browser-ponyfill";

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

  .login-frame input, .login-frame button {
    margin: 20px 0 0 0;
    padding: 10px;
  }

  .login-frame .checkbox-wrapper {
    align-self: start;
    cursor: pointer;
  }

  .login-frame button {
    background-color: #ffffff;
    border: 1px solid #ccc;
    color: #333;
    border-radius: 10px;
  }
  
  .login-frame button:disabled {
    background-color: #cccccc;
  }
  
  .login-frame .error-message {
    color: red;
    // margin: 10px 0;
  }`;



const defaultProps = {
  domain: "http://127.0.0.1:11000",
  sector: "0ad5c3e5-0186-4557-8b32-4b36f247bf09", // defaults to the admin sector
  styles: "",
  locale: "en",
  showWebAuthn: true,
  redirect: '/',
  redirectOnUnauthenticated: true,
};

customElement("spartan-account-settings", defaultProps, (props) => {
  // inputs
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [newKeyName, setNewKeyName] = createSignal("");

  // widget state
  const [errorMessage, setErrorMessage] = createSignal("");
  const [showWebAuthn, setShowWebAuthn] = createSignal(props.showWebAuthn);
  const [securityKeys, setSecurityKeys] = createSignal<SecurityKey[]>([]);
  const [showAddKey, setShowAddKey] = createSignal(false);
  const [isAuthed, setIsAuthed] = createSignal(false);

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
    getProfile().then((data) => {
      // TODO: display this data
      console.log(data);
    });

    // get security keys
    await getSecurityKeys();

    // beginOTPRegistration('gomas.bmw@gmail.com', 'EMAIL').then((data) => {
    //   console.log(data);
    // });
  });

  async function getProfile() {
    const res = await fetch(`${props.domain}/api/v1/users/self`, getFetchInit('get'));
    return await res.json();
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
    });
  }

  async function finishWebAuthnRegistration(beginResponse: BeginWebAuthnRegistrationResponse) {
    // @ts-ignore
    const options = parseCreationOptionsFromJSON(beginResponse.Options);
    const credResponse = await create(options);
    // converts the response properly to json
    const initBodyStr = JSON.stringify(credResponse)

    // but we need to augment it with a transactionID
    let rawBody = JSON.parse(initBodyStr);
    rawBody.transactionID = beginResponse.TransactionID;

    let requestInit = getFetchInit('post');
    requestInit.body = JSON.stringify(rawBody);
    // now send it to the server
    return fetch(`${props.domain}/api/v1/webauthn/registration/finish`, requestInit).then((response) => {
      if (response.status === 200) {
        return;
      } else {
        throw response;
      }
    }).then(() => {
      setShowAddKey(false);
      setNewKeyName('');
      getSecurityKeys();
    }).catch((res) => {
      res.json().then((data:any) => {
        setErrorMessage(data.message);
      });
    });
  }

  async function getSecurityKeys() {
    let requestInit = getFetchInit('get');
    try {
      const res = await fetch(`${props.domain}/api/v1/webauthn/registration/list`, requestInit);
      const data: SecurityKeys = await res.json();
      setSecurityKeys(data.registrations);
    } catch (e) {
      console.error(e);
      setSecurityKeys([]);
    }
  }

  async function beginOTPRegistration(destination: string, type: 'EMAIL' | 'SMS') {
    let requestInit = getFetchInit('post');
    requestInit.body = JSON.stringify({
      destination: destination,
      OTPType: otpTypeEnumValue(type),
      sectorID: props.sector,
    });
    try {
      const res = await fetch(`${props.domain}/api/v1/otp/begin`, requestInit);
      return await res.json();
    } catch (e) {
      console.error(e);
      setErrorMessage(banana.i18n('error-otp-registration'));
      return
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
    <div class={'login-frame'}>
      <style>{style}</style>
      <style>{customStyles}</style>
      <h1>{banana.i18n('sa-account-settings')}</h1>
      {errorMessage && <span class={'error-message'}>{errorMessage}</span>}
      {/*TODO: add update password section*/}
      {showWebAuthn() && (
        <div>
          <h2>{banana.i18n('sa-webauthn-security-keys')}</h2>
          {securityKeys().length === 0 && (
            <div>
              <span>{banana.i18n('sa-no-security-keys')}</span>
            </div>
          )}
          {securityKeys().length > 0 && (
            <div>
              <table>
                <thead>
                <tr>
                  <th>{banana.i18n('sa-webauthn-key-name')}</th>
                  <th>{banana.i18n('sa-webauthn-key-actions')}</th>
                </tr>
                </thead>
                <tbody>
                {securityKeys().map((key) => (
                  <tr>
                    <td>{key.keyName}</td>
                    <td>
                      <button onClick={() => {
                        if (confirm(banana.i18n('sa-confirm-delete-key'))) {
                          // delete key
                          console.log('delete key');
                        }
                      }}>{banana.i18n('sa-remove')}</button>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          )}
          {!showAddKey() && (
            <button onClick={() => setShowAddKey(true)}>+ {banana.i18n('sa-add-security-key')}</button>
          )}
          {showAddKey() && (
            <div class={'add-key-form'}>
              <div>
                <label>{banana.i18n('sa-webauthn-key-name')}</label>
                <input type={'text'} placeholder={banana.i18n('sa-webauthn-key-name')} value={newKeyName()} onInput={(e) => setNewKeyName(e.currentTarget.value)}/>
              </div>
              <div>
                <button onClick={() => setShowAddKey(false)}>{banana.i18n('sa-cancel')}</button>
                <button class={'primary'} onClick={() => newKeyName() !== '' && beginWebAuthnRegistration()} disabled={newKeyName() === ''}>{banana.i18n('sa-register')}</button>
              </div>
            </div>
          )}
        </div>
      )}
      {/*<button onClick={() => login()}>{banana.i18n('sa-login')}</button>*/}
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