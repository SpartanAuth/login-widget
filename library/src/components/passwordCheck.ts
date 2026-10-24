// These strings come from the API. Show them as-is. Other failures, including a
// bad reset or invite code, stay on the localized message.
const passwordCheckMessages = [
  'this password has appeared in a data breach',
  'password could not be checked against known breaches, try again',
  'password is required',
  'current password is incorrect',
];

export function passwordCheckMessage(message: unknown): string {
  const text = String(message ?? '').trim();
  for (let i = 0; i < passwordCheckMessages.length; i++) {
    if (text === passwordCheckMessages[i]) return text;
  }
  return '';
}
