import React from 'react';
import ReactDOM from 'react-dom';
import { IntlProvider } from 'react-intl';
import App from './App';
import pt_BR from './locales/pt_BR.json';
import en from './locales/en.json';
import es from './locales/es.json';

const browserLocale = navigator.language;

const messages = browserLocale.startsWith('pt') ? pt_BR :
                 browserLocale.startsWith('es') ? es :
                 en;

ReactDOM.render(
  <IntlProvider locale={browserLocale} messages={messages}>
    <App />
  </IntlProvider>,
  document.getElementById('root')
);

