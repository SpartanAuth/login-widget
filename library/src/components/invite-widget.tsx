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
`;

const defaultProps = {
  domain: "http://127.0.0.1:11000",
  sector: "0ad5c3e5-0186-4557-8b32-4b36f247bf09", // defaults to the admin sector
  sub: "", // user ID from invite email
  email: "", // email from invite
  styles: "",
  locale: "en",
  redirect: '', // where to redirect after successful completion
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
    </form>
  );
});




