import Banana from "banana-i18n";

// @ts-ignore
import en from '../i18n/en.json';
// @ts-ignore
import fr from '../i18n/fr.json';
// @ts-ignore
import es from '../i18n/es.json';
// @ts-ignore
import ja from '../i18n/ja.json';

const messages = {
  'en': en,
  'fr': fr,
  'es': es,
  'ja': ja,
};

function setupBanana(locale: string): Banana {
  const banana = new Banana('en', {
    messages: en
  });
  if (locale !== 'en') {
    // @ts-ignore
    banana.load(messages[locale], locale);
    banana.setLocale(locale);
  }
  return banana;
}

export {
  setupBanana
}