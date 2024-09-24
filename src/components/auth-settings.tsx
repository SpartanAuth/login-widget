import {createSignal, onMount} from "solid-js";
import {customElement} from "solid-element";
import {setupBanana} from './banana';
import {getDecodedSpartanToken, getSpartanToken} from "./spartanToken";

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
  
  .security-keys, .mfa-manage {
    display: flex;
    flex-direction: column;
}

  .key-item, .mfa-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .key-item span {
    flex-grow: 1;
  }

  .mfa-item label {
    margin-right: 10px;
    width: 50px;
  }

  .mfa-item input {
    flex-grow: 1;
    padding: 5px;
    margin-right: 10px;
  }
  
  .mfa-item button {
    justify-self: start;
    flex-grow: 1;
  }

  .btn {
    padding: 5px 10px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
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
`;

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
  const [modalErrorMessage, setModalErrorMessage] = createSignal("");
  const [showWebAuthn, setShowWebAuthn] = createSignal(props.showWebAuthn);
  const [showAddKey, setShowAddKey] = createSignal(false);
  const [isAuthed, setIsAuthed] = createSignal(false);
  const [showAddMFA, setShowAddMFA] = createSignal(true);
  const [showMFAModal, setShowMFAModal] = createSignal(false);

  // data
  const [securityKeys, setSecurityKeys] = createSignal<SecurityKey[]>([]);
  const [otpRegistrations, setOTPRegistrations] = createSignal<OTPRegistration[]>([]);
  const [transactionID, setTransactionID] = createSignal("");
  const [newOTP, setNewOTP] = createSignal("");
  const [newMFAEmail, setNewMFAEmail] = createSignal("");
  const [newMFAPhone, setNewMFAPhone] = createSignal("");

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

    // callBeginOTPRegistration('gomas.bmw@gmail.com', 'EMAIL').then((data) => {
    //   console.log(data);
    // });

    listOTPRegistrations().then((data) => {
      setOTPRegistrations(data.registrations);
    });
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

  async function initiateMFAValidation(destination: string, type: 'EMAIL' | 'SMS') {
    const response = await callBeginOTPRegistration(destination, type);
    if (response) {
      listOTPRegistrations().then((data) => {
        setOTPRegistrations(data.registrations);
      });
      setTransactionID(response.transactionID);
      // show the MFA modal
      setShowMFAModal(true);
    }
  }

  async function callBeginOTPRegistration(destination: string, type: 'EMAIL' | 'SMS') {
    let requestInit = getFetchInit('post');
    requestInit.body = JSON.stringify({
      destination: destination,
      OTPType: otpTypeEnumValue(type),
      sectorID: props.sector,
    });
    try {
      const res = await fetch(`${props.domain}/api/v1/otp/begin`, requestInit);
      if (res.status !== 200) {
        setErrorMessage(banana.i18n('error-otp-verification'));
        return;
      }
      return await res.json();
    } catch (e) {
      console.error(e);
      setErrorMessage(banana.i18n('error-otp-registration'));
      return
    }
  }

  async function callFinishOTPRegistration(transactionID: string, otp: string) {
    let requestInit = getFetchInit('post');
    requestInit.body = JSON.stringify({
      transactionID: transactionID,
      password: otp,
    });
    try {
      const res = await fetch(`${props.domain}/api/v1/otp/finish`, requestInit);
      if (res.status !== 200) {
        setModalErrorMessage(banana.i18n('error-otp-verification'));
        return;
      }
      setShowMFAModal(false);
      setNewOTP('');
      listOTPRegistrations().then((data) => {
        setOTPRegistrations(data.registrations);
      });
      return await res.json();
    } catch (e) {
      console.error(e);
      setModalErrorMessage(banana.i18n('error-otp-registration'));
      return;
    }
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
      {/*TODO: add update password section*/}
      {showWebAuthn() && (
        <div class={'section'}>
          <h2>{banana.i18n('sa-webauthn-security-keys')}</h2>
          {securityKeys().length === 0 && (
            <div>
              <span>{banana.i18n('sa-no-security-keys')}</span>
            </div>
          )}
          <div class={'security-keys'}>

            {securityKeys().map((key) => (
              <div class={'key-item'}>
                <span>{key.keyName}</span>
                <button class={'btn remove'}
                        onClick={() => {
                          if (confirm(banana.i18n('sa-confirm-delete-key'))) {
                            // delete key
                            console.log('delete key');
                          }
                        }}>{banana.i18n('sa-remove')}</button>
              </div>
            ))}
            {securityKeys().length <= 0 && (
              <span>{banana.i18n('sa-no-security-keys')}</span>
            )}
            {!showAddKey() && (
              <button class={'btn add'}
                      onClick={() => setShowAddKey(true)}>+ {banana.i18n('sa-add-security-key')}</button>
            )}
            {showAddKey() && (
              <div class={'add-key-form'}>
                <div>
                  <label>{banana.i18n('sa-webauthn-key-name')}</label>
                  <input type={'text'} placeholder={banana.i18n('sa-webauthn-key-name')} value={newKeyName()}
                         onInput={(e) => setNewKeyName(e.currentTarget.value)}/>
                </div>
                <div>
                  <button onClick={() => setShowAddKey(false)}>{banana.i18n('sa-cancel')}</button>
                  <button class={'primary'} onClick={() => newKeyName() !== '' && beginWebAuthnRegistration()}
                          disabled={newKeyName() === ''}>{banana.i18n('sa-register')}</button>
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
                  &nbsp; <button class={'btn validate'} onClick={() => {initiateMFAValidation(otp.DisplayName, otp.Type === 'email' ? "EMAIL" : "SMS")}}>{banana.i18n('sa-validate')}</button>
                  </span>
                }</td>
                <td>
                  <button class={'btn remove'} onClick={() => removeOTPRegistration(otp.ID)}>{banana.i18n('sa-remove')}</button>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      )}
      {showAddMFA() && (
        <div class={'section'}>
          <h2>{banana.i18n('sa-add-mfa')}</h2>
          <div class={'mfa-manage'}>
            <div class={'mfa-item'}>
              <label for={'email'}>{banana.i18n('sa-email')}</label>
              <input id="email" type={'text'} placeholder={banana.i18n('sa-email')} value={newMFAEmail()} onInput={(e) => setNewMFAEmail(e.currentTarget.value)}></input>
              <button class={'btn add'}
                      onClick={() => initiateMFAValidation(newMFAEmail(), 'EMAIL')}>{banana.i18n('sa-add-email')}</button>
            </div>
            <div class={'mfa-item'}>
              <label for={'phone'}>{banana.i18n('sa-phone')}</label>
              <input id="phone" type={'text'} placeholder={banana.i18n('sa-phone')} value={newMFAPhone()} onInput={(e) => setNewMFAPhone(e.currentTarget.value)}></input>
              <button class={'btn add'}
                      onClick={() => initiateMFAValidation(newMFAPhone(), 'SMS')}>{banana.i18n('sa-add-sms')}</button>
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
            <button class={"btn verify"} id="verifyMfa" onClick={() => callFinishOTPRegistration(transactionID(), newOTP())}>Verify</button>
          </div>
        </div>
      )}
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