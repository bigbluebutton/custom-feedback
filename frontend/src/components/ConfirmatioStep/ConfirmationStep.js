import { useEffect } from 'react';
import Styled from './styles';
import { defineMessages, injectIntl } from 'react-intl';

const messages = defineMessages({
  confirmationMessage: {
    id: 'app.customFeedback.confirmation.message',
    description: 'Thank you for your feedback! The window will close shortly.'
  }
});

const ConfirmationStep = ({ intl, getRedirectUrl, getRedirectTimeout }) => {
  useEffect(() => {
    const redirectTimeout = getRedirectTimeout ? getRedirectTimeout() : null;
    const timer = setTimeout(() => {
      const redirectUrl = getRedirectUrl ? getRedirectUrl() : null;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        window.close();
      }
    }, redirectTimeout || 10000);

    return () => clearTimeout(timer);
  }, [getRedirectTimeout, getRedirectUrl]);

  return (
    <Styled.Container>
      <Styled.Box>
        <Styled.Title>{intl.formatMessage(messages.confirmationMessage)}</Styled.Title>
      </Styled.Box>
    </Styled.Container>
  );
};

export default injectIntl(ConfirmationStep);
