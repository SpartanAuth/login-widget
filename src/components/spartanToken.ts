import jwt_decode from 'jwt-decode';

export function getDecodedSpartanToken(): SpartanToken | null {
  const token = localStorage.getItem('spartan-token');
  let decodedToken = null;
  if (token) {
    decodedToken = jwt_decode(token);
    if ((decodedToken as SpartanToken).exp > getUTCSecondsSinceEpoc()) {
      return decodedToken as SpartanToken;
    } else {
      localStorage.removeItem('spartan-token');
    }
  }
  return null;
}

export function getSpartanToken(): string | null {
  const token = localStorage.getItem('spartan-token');
  if (token) {
    return token;
  }
  return null;
}

function getUTCSecondsSinceEpoc(): number {
  return Math.round(new Date().getTime() / 1000);
}

interface SpartanToken {
  exp: number;
}