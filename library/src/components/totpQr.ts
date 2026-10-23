import {renderSVG} from "uqr";

// Drawn in the browser so the shared secret never leaves the page.
export function totpQrSvg(otpauthURL: string): string {
  if (!otpauthURL) return "";
  try {
    return renderSVG(otpauthURL, {
      ecc: "M",
      border: 2,
      pixelSize: 4,
    });
  } catch {
    return "";
  }
}
