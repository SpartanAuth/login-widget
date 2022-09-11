import {createSignal, onMount} from "solid-js";
import { customElement } from "solid-element";
import * as base64js from "base64-js";
import { setupBanana } from './banana';
import {getDecodedSpartanToken, getSpartanToken} from "./spartanToken";

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
  const [securityKeys, setSecurityKeys] = createSignal([]);
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

    // TODO: get current user account settings
    // const res = await fetch(`https://jsonplaceholder.typicode.com/photos?_limit=20`);
    // console.log(res.json());
    // setPhotos(await res.json());
  });

  function beginWebAuthnRegistration() {
    fetch(`${props.domain}/api/v1/webauthn/registration/begin`, {
      method: 'post',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `bearer ${getSpartanToken()}`,
      },
      body: JSON.stringify({
        keyName: newKeyName(),
        sectorID: props.sector,
      })
    }).then((response) => {
      if (response.status === 200) {
        return response.json();
      } else {
        throw response;
      }
    }).then(data => {
      console.log(data);
      finishWebAuthnRegistration(data as BeginWebAuthnRegistrationResponse)
    }).catch((res) => {
      res.json().then((data:any) => {
        setErrorMessage(data.message);
      });
    });
  }

  function finishWebAuthnRegistration(beginResponse: BeginWebAuthnRegistrationResponse) {
    return navigator.credentials.create(convertBeginWARegResOptionsToCredentialCreationOptions(beginResponse.Options)).then((credential) => {
      console.log(credential);
      if (!credential) {
        throw new Error("No credential returned");
      }

      // some messy typescript stuff here.
      let cred: any = credential as any;

      let attestationObject = new Uint8Array(cred.response.attestationObject);
      let clientDataJSON = new Uint8Array(cred.response.clientDataJSON);
      let rawId = new Uint8Array(cred.rawId);

      return fetch(`${props.domain}/api/v1/webauthn/registration/finish`, {
        method: 'post',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `bearer ${getSpartanToken()}`,
        },
        body: JSON.stringify({
          id: cred.id,
          rawId: bufferEncode(rawId),
          type: credential.type,
          response: {
            attestationObject: bufferEncode(attestationObject),
            clientDataJSON: bufferEncode(clientDataJSON),
          },
          transactionID: beginResponse.TransactionID,
          keyName: newKeyName(),
        })
      })
    }).then((response) => {
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

  function getSecurityKeys() {
    // TODO: get current user account settings
  }

  // Encode an ArrayBuffer into a base64 string.
  function bufferEncode(value: Uint8Array) {
    return base64js.fromByteArray(value)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  function convertBeginWARegResOptionsToCredentialCreationOptions(beginOptions: PublicKeyCreds): CredentialCreationOptions {
    return {
      publicKey: {
        challenge: Uint8Array.from(beginOptions.publicKey.challenge, c => c.charCodeAt(0)),
        rp: {
          name: beginOptions.publicKey.rp.name,
          id: beginOptions.publicKey.rp.id,
        },
        user: {
          id: Uint8Array.from(beginOptions.publicKey.user.id, c => c.charCodeAt(0)),
          name: beginOptions.publicKey.user.name,
          displayName: beginOptions.publicKey.user.displayName,
        },
        pubKeyCredParams: beginOptions.publicKey.pubKeyCredParams,
        timeout: beginOptions.publicKey.timeout,
        attestation: beginOptions.publicKey.attestation,
      }
    };
  }

  return (
    <div class={'login-frame'}>
      <style>{style}</style>
      <style>{customStyles}</style>
      <h1>{banana.i18n('sa-account-settings')}</h1>
      {errorMessage && <span class={'error-message'}>{errorMessage}</span>}
      {/*TODO: add update password section*/}
      {/*TODO: add webauthn setup section*/}
      {showWebAuthn() && (
        <div>
          <h2>{banana.i18n('sa-webauthn-security-keys')}</h2>
          {securityKeys().length === 0 && (
            <div>
              <span>{banana.i18n('sa-no-security-keys')}</span>
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