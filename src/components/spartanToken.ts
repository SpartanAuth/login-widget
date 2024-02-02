import jwt_decode from 'jwt-decode';

const spartanTokenKey = 'spartan-token';

export function getDecodedSpartanToken(): SpartanToken | null {
  const token = localStorage.getItem(spartanTokenKey);
  let decodedToken = null;
  if (token) {
    decodedToken = jwt_decode(token);
    if ((decodedToken as SpartanToken).exp > getUTCSecondsSinceEpoc()) {
      return decodedToken as SpartanToken;
    } else {
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

function getUTCSecondsSinceEpoc(): number {
  return Math.round(new Date().getTime() / 1000);
}

interface SpartanToken {
  exp: number;
}