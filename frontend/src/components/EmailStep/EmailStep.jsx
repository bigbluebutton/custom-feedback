import { defineMessages, injectIntl } from 'react-intl';
import { useState } from 'react';
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
        {stepData.titleLabel && (
          <Styled.StepTitle>{intl.formatMessage(stepData.titleLabel)}</Styled.StepTitle>
        )}
        <Styled.Input
          type="email"
          placeholder={intl.formatMessage(emailOption?.placeholderLabel || messages.emailPlaceholder)}
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
