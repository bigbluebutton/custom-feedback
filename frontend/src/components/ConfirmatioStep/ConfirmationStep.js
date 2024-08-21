import React, { useEffect } from 'react';
import Styled from './styles';
import { defineMessages, injectIntl } from 'react-intl';

const messages = defineMessages({
  confirmationMessage: {
    id: 'app.customFeedback.confirmation.message',
    description: 'Thank you for your feedback! The window will close shortly.'
  }
});

const ConfirmationStep = ({ intl }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.close();
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Styled.Container>
      <Styled.Box>
        <Styled.Title>{intl.formatMessage(messages.confirmationMessage)}</Styled.Title>
      </Styled.Box>
    </Styled.Container>
  );
};

export default injectIntl(ConfirmationStep);
