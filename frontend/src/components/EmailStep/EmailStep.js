import { defineMessages, injectIntl } from 'react-intl';
import React, { useState } from 'react';
import Styled from './styles';

const messages = defineMessages({
  emailTitle: {
    id: 'app.customFeedback.email.thank',
    description: 'Obrigado pelas suas respostas'
  },
  emailParagraph: {
    id: 'app.customFeedback.email.contact',
    description: 'Gostaria de deixar seu e-mail para contato?'
  },
  emailPlaceholder: {
    id: 'app.customFeedback.email.placeholder',
    description: 'E-mail (opcional)'
  },
  leaveButton: {
    id: 'app.customFeedback.defaultButtons.leave',
    description: 'Leave'
  }
});

const EmailStep = ({ onNext, stepData, intl }) => {
  const [email, setEmail] = useState('');

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  };

  const handleSubmit = () => {
    onNext(null, { email });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <Styled.Container>
      <Styled.Box>
        <Styled.Title>{intl.formatMessage(messages.emailTitle)}</Styled.Title>
        <p>{intl.formatMessage(messages.emailParagraph)}</p>
        <Styled.Input
          type="email"
          placeholder={intl.formatMessage(messages.emailPlaceholder)}
          value={email}
          onChange={handleEmailChange}
          onKeyDown={handleKeyDown}
        />
        <Styled.ButtonContainer>
          <Styled.Button onClick={handleSubmit}>
            {intl.formatMessage(messages.leaveButton)}
          </Styled.Button>
        </Styled.ButtonContainer>
      </Styled.Box>
    </Styled.Container>
  );
};

export default injectIntl(EmailStep);
