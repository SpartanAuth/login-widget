/**
 * @deprecated spartan-invite is deprecated and will be removed in a future release.
 * Use spartan-login instead — it now handles invite links automatically by detecting
 * the `?sub=` (and optional `?email=`, `#otp=`) URL parameters that invite emails produce.
 * Point your invite email redirect URL at the same page as your login widget.
 */
import {createSignal, onMount} from "solid-js";
import { customElement } from "solid-element";
import { setupBanana } from './banana';

const style = `.invite-frame {
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

  .invite-frame h1 {
    margin: 0;
    align-self: start;
    font-size: 1.5em;
    margin-bottom: 10px;
  }

  .invite-frame input, .invite-frame button {
    margin: 15px 0 0 0;
    padding: 10px;
  }

  .invite-frame button {
    background-color: #00f0f0;
    border: 1px solid #ccc;
    color: #333;
    border-radius: 10px;
    cursor: pointer;
  }

  .invite-frame button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  .invite-frame .error-message {
    color: red;
    margin: 10px 0;
  }

  .invite-frame .success-message {
    color: green;
    margin: 10px 0;
  }

  .invite-frame .info-message {
    color: #666;
    margin: 10px 0;
    font-size: 0.9em;
  }

  .invite-frame .hint {
    color: #666;
    font-size: 0.85em;
    margin-top: 5px;
    margin-bottom: 10px;
    display: block;
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
  sub: "", // user ID from invite email
  email: "", // email from invite
  styles: "",
  locale: "en",
  redirect: '', // where to redirect after successful completion
  hideSocial: false,
};

customElement("spartan-invite", defaultProps, (props) => {
  console.warn(
    '[spartan-invite] <spartan-invite> is deprecated. ' +
    'Use <spartan-login> instead — it now handles invite links by detecting ?sub= URL params automatically.'
  );
  const [otp, setOtp] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [errorMessage, setErrorMessage] = createSignal("");
  const [successMessage, setSuccessMessage] = createSignal("");
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [socialProviders, setSocialProviders] = createSignal<Array<{provider: string, enabled: boolean, clientID: string}>>([]);
  const [socialLoading, setSocialLoading] = createSignal("");
  const banana = setupBanana(props.locale);
  let hostRef: HTMLFormElement | undefined;
  let customStyles;

  try {
    customStyles = props.styles;
  } catch(e) {
    customStyles = '';
  }

  onMount(async () => {
    // Check if sub is provided, if not try to get from URL params
    if (!props.sub) {
      const urlParams = new URLSearchParams(window.location.search);
      const subFromUrl = urlParams.get('sub');

      if (!subFromUrl) {
        setErrorMessage("Missing invitation information. Please use the link from your invite email.");
      }
    }
    // try to get the otp from URL fragment (e.g. #invite?otp=123456)
    const hashParams = new URLSearchParams(window.location.hash.replace('#', ''));
    const otpFromHash = hashParams.get('otp');
    if (otpFromHash) {
      setOtp(otpFromHash);
    }

    getSocialProviders();
  });

  async function completeInvite(e: Event) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    // Validate inputs
    if (!otp() || otp().trim().length === 0) {
      setErrorMessage("Please enter your verification code");
      setIsSubmitting(false);
      return;
    }

    if (!password() || password().length < 8) {
      setErrorMessage("Password must be at least 8 characters");
      setIsSubmitting(false);
      return;
    }

    // Get sub from props or URL
    const urlParams = new URLSearchParams(window.location.search);
    const sub = props.sub || urlParams.get('sub') || '';

    if (!sub) {
      setErrorMessage("Missing invitation information");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(`${props.domain}/api/v1/users/invite/complete`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sub: sub,
          otp: otp().toUpperCase().trim(),
          password: password(),
          sectorID: props.sector,
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuccessMessage(banana.i18n('sa-invite-success'));

        // Emit a custom event with success
        const event = new CustomEvent('spartan-invite-complete', {
          bubbles: true,
          cancelable: true,
          detail: {
            sub: sub,
            success: true,
          }
        });

        // dispatch the event on the custom element
        if (hostRef) {
          const hostEl = (hostRef.getRootNode() as ShadowRoot).host;
          hostEl.dispatchEvent(event);
        }

        // Redirect after a short delay
        setTimeout(() => {
          if (props.redirect && props.redirect !== '') {
            window.location.href = props.redirect;
          }
        }, 2000);
      } else {
        // Handle error responses
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 400 || errorData.message?.includes('invalid OTP')) {
          setErrorMessage(banana.i18n('sa-invite-error-otp'));
        } else if (response.status === 504 || errorData.message?.includes('expired')) {
          setErrorMessage(banana.i18n('sa-invite-error-expired'));
        } else {
          setErrorMessage(errorData.message || banana.i18n('sa-invite-error-generic'));
        }
        setIsSubmitting(false);
      }
    } catch (err) {
      console.error('Error completing invite:', err);
      setErrorMessage(banana.i18n('sa-invite-error-generic'));
      setIsSubmitting(false);
    }
  }

  function getSocialProviders() {
    if (props.hideSocial) return;
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

  return (
    <form class={'invite-frame'} onSubmit={completeInvite} ref={hostRef}>
      <style>{style}</style>
      <style>{customStyles}</style>
      <h1>{banana.i18n('sa-complete-invite')}</h1>

      {props.email && (
        <span class={'info-message'}>
          {props.email}
        </span>
      )}

      {errorMessage() && <span class={'error-message'}>{errorMessage()}</span>}
      {successMessage() && <span class={'success-message'}>{successMessage()}</span>}

      <input
        type="text"
        placeholder={banana.i18n('sa-invite-otp')}
        value={otp()}
        onInput={(e) => setOtp(e.currentTarget.value)}
        disabled={isSubmitting() || successMessage() !== ""}
        autocomplete="one-time-code"
        required
      />
      <span class={'hint'}>{banana.i18n('sa-invite-otp-hint')}</span>

      <input
        type="password"
        placeholder={banana.i18n('sa-invite-password')}
        value={password()}
        onInput={(e) => setPassword(e.currentTarget.value)}
        disabled={isSubmitting() || successMessage() !== ""}
        autocomplete="new-password"
        required
        minlength="8"
      />
      <span class={'hint'}>{banana.i18n('sa-invite-password-hint')}</span>

      <button
        type="submit"
        disabled={isSubmitting() || successMessage() !== ""}
      >
        {isSubmitting() ? banana.i18n('sa-invite-completing') : banana.i18n('sa-invite-submit')}
      </button>

      {!props.hideSocial && socialProviders().length > 0 && (
        <>
          <div class="social-divider"><span>{banana.i18n('sa-or')}</span></div>
          {socialProviders().map(p => (
            <button
              type="button"
              class="social-btn"
              disabled={!!socialLoading() || isSubmitting()}
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
                <svg width="18" height="18" viewBox="20 16 16 19" xmlns="http://www.w3.org/2000/svg">
                  <path d="M28.2226562,20.3846154 C29.0546875,20.3846154 30.0976562,19.8048315 30.71875,19.0317864 C31.28125,18.3312142 31.6914062,17.352829 31.6914062,16.3744437 C31.6914062,16.2415766 31.6796875,16.1087095 31.65625,16 C30.7304687,16.0362365 29.6171875,16.640178 28.9492187,17.4494596 C28.421875,18.06548 27.9414062,19.0317864 27.9414062,20.0222505 C27.9414062,20.1671964 27.9648438,20.3121424 27.9765625,20.3604577 C28.0351562,20.3725366 28.1289062,20.3846154 28.2226562,20.3846154 Z M25.2929688,35 C26.4296875,35 26.9335938,34.214876 28.3515625,34.214876 C29.7929688,34.214876 30.109375,34.9758423 31.375,34.9758423 C32.6171875,34.9758423 33.4492188,33.792117 34.234375,32.6325493 C35.1132812,31.3038779 35.4765625,29.9993643 35.5,29.9389701 C35.4179688,29.9148125 33.0390625,28.9122695 33.0390625,26.0979021 C33.0390625,23.6579784 34.9140625,22.5588048 35.0195312,22.474253 C33.7773438,20.6382708 31.890625,20.5899555 31.375,20.5899555 C29.9804688,20.5899555 28.84375,21.4596313 28.1289062,21.4596313 C27.3554688,21.4596313 26.3359375,20.6382708 25.1289062,20.6382708 C22.8320312,20.6382708 20.5,22.5950413 20.5,26.2911634 C20.5,28.5861411 21.3671875,31.013986 22.4335938,32.5842339 C23.3476562,33.9129053 24.1445312,35 25.2929688,35 Z" fill="currentColor" fill-rule="nonzero"/>
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




