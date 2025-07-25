import { useEffect } from 'react';
import Styled from './styles';
import { defineMessages, injectIntl } from 'react-intl';

const messages = defineMessages({
  confirmationMessage: {
    id: 'app.customFeedback.confirmation.message',
    description: 'Thank you for your feedback! The window will close shortly.'
  },
  skippedMessage: {
    id: 'app.customFeedback.skipped.message',
    description: 'Your session has ended. You may now close this window.'
  }
});

const ConfirmationStep = ({ intl, getRedirectUrl, getRedirectTimeout, isSkipped }) => {
  useEffect(() => {
    const redirectTimeout = getRedirectTimeout ? getRedirectTimeout() : null;
    const timer = setTimeout(() => {
      const redirectUrl = getRedirectUrl ? getRedirectUrl() : null;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else if (!isSkipped) {
        window.close();
      }
    }, redirectTimeout || 10000);

    return () => clearTimeout(timer);
  }, [getRedirectTimeout, getRedirectUrl, isSkipped]);

  const message = isSkipped ? messages.skippedMessage : messages.confirmationMessage;
  const showDots = !isSkipped;

  return (
    <>
      <Styled.Description>{intl.formatMessage(message)}{showDots && <Styled.Dots/>}</Styled.Description>
    </>
  );
};

export default injectIntl(ConfirmationStep);
