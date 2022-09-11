import {createSignal, onMount} from "solid-js";
import { customElement } from "solid-element";
import { setupBanana } from './banana';

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
  domain: "http://127.0.0.1:11000",
  sector: "0ad5c3e5-0186-4557-8b32-4b36f247bf09", // defaults to the admin sector
  startMode: 'password',
  styles: "",
  locale: "en",
  redirect: '/',
};

customElement("spartan-login", defaultProps, (props) => {
  const [currMode, setMode] = createSignal(props.startMode);
  const [username, setUsername] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [errorMessage, setErrorMessage] = createSignal("");
  const [redirect, setRedirect] = createSignal(props.redirect);
  const banana = setupBanana(props.locale);
  let customStyles;
  try {
    customStyles = props.styles;
  } catch(e) {
    customStyles = '';
  }
  console.log(customStyles);

  // onMount(async () => {
  //   const res = await fetch(`https://jsonplaceholder.typicode.com/photos?_limit=20`);
  //   console.log(res.json());
  //   // setPhotos(await res.json());
  // });

  function login() {
    console.log("login");
    setErrorMessage("");
    fetch(props.domain + "/api/v1/login/password", {
      method: 'post',
      mode: 'cors',
      cache: 'no-cache',
      body: JSON.stringify({
        username: username(),
        password: password(),
        sectorID: props.sector,
      })
    }).then((response) => {
      if (response.status === 200) {
        return response.json();
      } else {
        throw response;
      }
    })
    .then(data => {
      console.log(data);
      localStorage.setItem('spartan-token', data.token);
      window.location.href = redirect();
    }).catch((res) => {
      res.json().then((data:any) => {
        console.log(data.message);
        setErrorMessage(data.message);
      })
      console.log(res);
    });
  }

  return (
    <div class={'login-frame'}>
      <style>{style}</style>
      <style>{customStyles}</style>
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
