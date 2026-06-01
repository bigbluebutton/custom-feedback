import ReactDOM from 'react-dom/client';
import { IntlProvider } from 'react-intl';
import App from './App';
import pt_BR from './locales/pt_BR.json';
import en from './locales/en.json';
import es from './locales/es.json';


async function startApp() {
  const browserLocale = navigator.language;
  const params = new URLSearchParams(window.location.search);
  const urlLocale = params.get('locale');
  let userLocale = urlLocale || browserLocale;

  try {
    const checkRes = await fetch(`/feedback/check?${window.location.search.replace(/^\?/, '')}`);
    if (checkRes.ok) {
      const check = await checkRes.json();
      if (check.redirect) {
        window.location.replace(check.redirect);
        return;
      }
      if (check.locale) {
        userLocale = check.locale;
      }
    }
  } catch (e) {
    console.error('Error checking feedback:', e);
  }

  const messages = userLocale.startsWith('pt') ? pt_BR :
                   userLocale.startsWith('es') ? es :
                   en;

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <IntlProvider locale={userLocale} messages={messages}>
      <App />
    </IntlProvider>
  );
}

startApp();
