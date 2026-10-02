import ReactDOM from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import App from './App';
import { FeedbackDataContext, fetchFeedbackData } from './feedbackData';
import { setRedirectUrl, setRedirectTimeout, getSessionToken } from './components/service';
import { SessionContext } from './sessionContext';

const LOCALES_PATH = '/feedback/locales';
const FALLBACK_LOCALE = 'en';

// Default file for a bare language code (e.g. `pt` -> `pt_BR`). The exact
// requested locale is still tried first, so region-specific files dropped in at
// deploy time (e.g. `es_MX.json`) are picked up without a rebuild.
const LANGUAGE_DEFAULT_FILE = {
  pt: 'pt_BR',
  es: 'es',
  it: 'it',
  en: 'en',
};

const fetchLocaleFile = async (code) => {
  try {
    const res = await fetch(`${LOCALES_PATH}/${code}.json`);
    const isJson = res.headers.get('content-type')?.includes('application/json');

    if (res.ok && isJson) return await res.json();
  } catch (error) {
    console.error(`Error loading locale ${code}:`, error);
  }

  return null;
};

// Loads the English base then overlays the requested locale, so keys missing
// from a (possibly overridden) translation fall back to English rather than
// rendering their raw message id.
const loadMessages = async (rawLocale) => {
  const normalized = (rawLocale || FALLBACK_LOCALE).replace(/-/g, '_');
  const language = normalized.split('_')[0].toLowerCase();
  const candidates = [...new Set([normalized, LANGUAGE_DEFAULT_FILE[language]])]
    .filter((code) => code && code !== FALLBACK_LOCALE);

  const base = (await fetchLocaleFile(FALLBACK_LOCALE)) || {};

  for (const code of candidates) {
    const messages = await fetchLocaleFile(code);

    if (messages) return { locale: code, messages: { ...base, ...messages } };
  }

  return { locale: FALLBACK_LOCALE, messages: base };
};

async function startApp() {
  const browserLocale = navigator.language;
  const params = new URLSearchParams(window.location.search);
  const urlLocale = params.get('locale');
  let userLocale = urlLocale || browserLocale;

  // The backend/nginx auth layer (sessionToken -> bbb-web's checkAuthorization)
  // is the only authoritative source for "does this visitor have a real BBB
  // session" — a 401 here means nginx rejected the request before it ever
  // reached Express. meetingId/userId are not a substitute: the backend
  // doesn't trust them, and BBB's logoutURL isn't guaranteed to carry them.
  // Any other failure (network hiccup, unexpected status) fails open, same
  // as before, so a backend blip doesn't block someone who did leave a
  // meeting normally.
  let isValidSession = true;

  try {
    // nginx gates /feedback/check behind bbb-web's connection check, which
    // reads sessionToken off the request URI - it must be appended here, not
    // sent as a header or relied on being present in window.location.search.
    const checkParams = new URLSearchParams(window.location.search);
    const sessionToken = getSessionToken();
    if (sessionToken) checkParams.set('sessionToken', sessionToken);

    const checkRes = await fetch(`/feedback/check?${checkParams.toString()}`);
    if (checkRes.ok) {
      const check = await checkRes.json();
      if (check.redirect) {
        window.location.replace(check.redirect);
        return;
      }
      if (check.locale) {
        userLocale = check.locale;
      }
      // The backend is the only party that can validate a redirectUrl
      // against the operator's allowlist, so this is the only place that
      // gets to persist one for ConfirmationStep to use later. FeedbackFlow
      // must not read redirectUrl/redirectTimeout straight off the URL.
      // Set unconditionally so a prior session's values don't linger in
      // sessionStorage when this check has none of its own - the setters
      // already clear the key for an absent/falsy value.
      setRedirectUrl(check.redirectUrl);
      setRedirectTimeout(check.redirectTimeout);
    } else if (checkRes.status === 401) {
      isValidSession = false;
    }
  } catch (e) {
    console.error('Error checking feedback:', e);
  }

  const [{ locale, messages }, feedbackData] = await Promise.all([
    loadMessages(userLocale),
    fetchFeedbackData(),
  ]);

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <IntlProvider locale={locale.replace(/_/g, '-')} messages={messages}>
      <FeedbackDataContext.Provider value={feedbackData}>
        <SessionContext.Provider value={{ isValid: isValidSession }}>
          <App />
        </SessionContext.Provider>
      </FeedbackDataContext.Provider>
    </IntlProvider>
  );
}

startApp();
