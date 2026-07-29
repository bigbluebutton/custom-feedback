import { defineMessages, injectIntl } from 'react-intl';
import { useState } from 'react';
import { formatLabel } from '../../feedbackData';
import Styled from './styles';

const messages = defineMessages({
  emailPlaceholder: {
    id: 'app.customFeedback.email.placeholder',
    description: 'Placeholder for the email input'
  },
  sendButton: {
    id: 'app.customFeedback.defaultButtons.send',
    description: 'Send'
  }
});

const EmailStep = ({ onNext, stepData, intl }) => {
  const [email, setEmail] = useState('');
  const emailOption = stepData.options?.find((option) => option.type === 'email');
  const emailLabel = formatLabel(intl, emailOption?.placeholderLabel, messages.emailPlaceholder);
  const title = formatLabel(intl, stepData.titleLabel);

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  };

  const handleSubmit = () => {
    onNext(emailOption?.next, { email });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <>
      <Styled.TitleInputWrapper>
        {title && (
          <Styled.StepTitle>{title}</Styled.StepTitle>
        )}
        <Styled.Input
          type="email"
          aria-label={emailLabel}
          placeholder={emailLabel}
          value={email}
          onChange={handleEmailChange}
          onKeyDown={handleKeyDown}
        />
      </Styled.TitleInputWrapper>
      <Styled.ButtonContainer>
        <Styled.Button onClick={handleSubmit}>
          {intl.formatMessage(messages.sendButton)}
        </Styled.Button>
      </Styled.ButtonContainer>
    </>
  );
};

export default injectIntl(EmailStep);
