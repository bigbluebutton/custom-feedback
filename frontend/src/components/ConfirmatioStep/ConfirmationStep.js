import { useEffect } from 'react';
import Styled from './styles';
import { defineMessages, injectIntl } from 'react-intl';

const messages = defineMessages({
  confirmationMessage: {
    id: 'app.customFeedback.confirmation.message',
    description: 'Thank you for your feedback! The window will close shortly.'
  },
  skippedMessage: {
    id: 'app.customFeedback.windowWillClose',
    description: 'The window will close shortly.'
  }
});

const ConfirmationStep = ({ intl, getRedirectUrl, getRedirectTimeout, endReason, isSkipped }) => {
  useEffect(() => {
    const redirectTimeout = getRedirectTimeout ? getRedirectTimeout() : 10000;
    const timer = setTimeout(() => {
      const redirectUrl = getRedirectUrl ? getRedirectUrl() : null;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        if (!isSkipped) {
            window.close();
        }
      }
    }, redirectTimeout);

    return () => clearTimeout(timer);
  }, [getRedirectTimeout, getRedirectUrl, isSkipped]);

  const message = isSkipped ? messages.skippedMessage : messages.confirmationMessage;

  return (
    <>
      {endReason && <Styled.EndedTitle>{endReason}</Styled.EndedTitle>}
      <Styled.Description>{intl.formatMessage(message)}<Styled.Dots/></Styled.Description>
    </>
  );
};

export default injectIntl(ConfirmationStep);
