import {createSignal, onMount} from "solid-js";
import { customElement } from "solid-element";
import Banana from "banana-i18n";

// @ts-ignore
import en from './i18n/en.json';
// @ts-ignore
import fr from './i18n/fr.json';
// @ts-ignore
import es from './i18n/es.json';
// @ts-ignore
import ja from './i18n/ja.json';

const messages = {
    'en': en,
    'fr': fr,
    'es': es,
    'ja': ja,
};

const style = `.login-frame {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  border: 1px solid #ccc;
  padding: 40px 40px;
  max-width: 350px;
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
    background-color: #00f0f0;
    border: 1px solid #ccc;
    color: #333;
    border-radius: 10px;
  }
  
  .login-frame .error-message {
    color: red;
    // margin: 10px 0;
  }`;



const defaultProps = {
  sector: "",
  startMode: 'password',
  styles: "",
  locale: "en",
};

customElement("spartan-login", defaultProps, (props) => {
  const [currMode, setMode] = createSignal(props.startMode);
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [errorMessage, setErrorMessage] = createSignal("");
  const banana = new Banana('en', {
    messages: en
  });
  if (props.locale !== 'en') {
    // @ts-ignore
    banana.load(messages[props.locale], props.locale);
    banana.setLocale(props.locale);
  }
  let customStyles;
  try {
    customStyles = JSON.parse(props.styles);
  } catch(e) {
    customStyles = {};
  }
  console.log(customStyles);

  // onMount(async () => {
  //   const res = await fetch(`https://jsonplaceholder.typicode.com/photos?_limit=20`);
  //   console.log(res.json());
  //   // setPhotos(await res.json());
  // });

  function login() {
    console.log("login");
  }

  return (
    <div class={'login-frame'}>
      <style>{style}</style>
      <h1>{banana.i18n('sa-login')}</h1>
      {errorMessage && <span class={'error-message'}>{errorMessage}</span>}
      <input type="text"
             placeholder={banana.i18n('sa-username')}
             value={username()}
             onInput={(e) => setUsername(e.currentTarget.value)}
      ></input>
      { currMode() === "password" && (
        <input type="password"
               placeholder={banana.i18n('sa-password')}
               value={password()}
               onInput={(e) => setPassword(e.currentTarget.value)}
        ></input>
      )}
      {/*{ mode() === "webAuthn" && (*/}
      {/*  <button onClick={() => setMode("text")}>Show password</button>*/}
      {/*)}*/}
      { currMode() === "totp" && (
        <input type="text" placeholder={banana.i18n('sa-code')}></input>
      )}
      <span class="checkbox-wrapper" onClick={() => setMode(currMode() === 'password' ? 'webAuthn' : 'password') }>
        <input type="checkbox" checked={currMode() === 'password'}></input>
        <span>&nbsp;{banana.i18n('sa-use-password')}</span>
      </span>
      <button onClick={() => login()}>{banana.i18n('sa-login')}</button>
    </div>
  );
});
