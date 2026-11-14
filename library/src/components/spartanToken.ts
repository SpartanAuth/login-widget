import jwt_decode from 'jwt-decode';

const spartanTokenKey = 'spartan-token';

export function getDecodedSpartanToken(): SpartanToken | null {
  const token = localStorage.getItem(spartanTokenKey);
  let decodedToken = null;
  if (token) {
    try {
      decodedToken = jwt_decode(token);
      if ((decodedToken as SpartanToken).exp > getUTCSecondsSinceEpoc()) {
        return decodedToken as SpartanToken;
      } else {
        localStorage.removeItem(spartanTokenKey);
      }
    } catch (error) {
      console.error('Error decoding token', error);
      localStorage.removeItem(spartanTokenKey);
    }
  }
  return null;
}

export function getSpartanToken(): string | null {
  const token = localStorage.getItem(spartanTokenKey);
  if (token) {
    return token;
  }
  return null;
}

// A passkey change can reuse the login ceremony while that session token is
// still inside the server's 10-minute step-up window. The id stays in
// localStorage; this only reads it.
const loginStepUpMaxAgeSeconds = 10 * 60;

export function recentLoginTransactionID(): string {
  const token = getDecodedSpartanToken();
  if (!token || typeof token.iat !== 'number') return '';
  const age = Math.round(Date.now() / 1000) - token.iat;
  if (age < 0 || age >= loginStepUpMaxAgeSeconds) return '';
  const tx = localStorage.getItem('spartan-txid');
  return tx ? tx.trim() : '';
}

function getUTCSecondsSinceEpoc(): number {
  return Math.round(new Date().getTime() / 1000);
}

interface SpartanToken {
  exp: number;
  iat?: number;
}