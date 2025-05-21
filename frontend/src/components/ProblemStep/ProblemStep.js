import React, { useState, useEffect } from 'react';
import { defineMessages, injectIntl } from 'react-intl';
import Styled from './styles';

const messages = defineMessages({
  describeProblem: {
    id: 'app.customFeedback.describeProblem',
  },
  skip: {
    id: 'app.customFeedback.defaultButtons.skip',
  },
  continue: {
    id: 'app.customFeedback.defaultButtons.next',
  },
});

const ProblemStep = ({ onNext, stepData, intl }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [textValue, setTextValue] = useState('');

  useEffect(() => {
    setSelectedOption(null);
    setTextValue('');
  }, [stepData]);

  const handleOptionChange = (option) => {
    console.log(option);
    setSelectedOption(option);
    if (option.value !== 'other') {
      setTextValue('');
    }
  };

  const handleTextChange = (event) => {
    setTextValue(event.target.value);
  };

  const handleLeave = () => {
    onNext(null, {  });
  };

  const handleSubmit = () => {
    const radioKey = stepData.options.find(opt => opt.type === 'radio').key;
    const data = { [radioKey]: selectedOption ? selectedOption.value : '' };
    if (selectedOption && selectedOption.value === 'other') {
      const textAreaKey = stepData.options.find(opt => opt.type === 'textArea').key;
      data[textAreaKey] = textValue;
    }
    onNext(selectedOption ? selectedOption.next : '', data);
  };

  return (
    <Styled.OptionsWrapper>
      {stepData.options.map((option, index) => (
        <Styled.Option key={index}>
          {option.type === 'radio' ? (
            <Styled.ClicableArea>
              <Styled.RadioButton
                type="radio"
                id={option.value}
                name={`problem-${stepData.titleLabel.id}`}
                value={option.value}
                checked={selectedOption ? selectedOption.value === option.value : false}
                onChange={() => handleOptionChange(option)}
              />
              <Styled.Label htmlFor={option.value}>{intl.formatMessage({ id: option.textLabel.id })}</Styled.Label>
            </Styled.ClicableArea>
          ) : (
            <Styled.TextArea
              value={textValue}
              onFocus={() => handleOptionChange({value: 'other'})}
              onClick={() => handleOptionChange({value: 'other'})}
              onChange={(selectedOption || selectedOption?.value === 'other')
                ? handleTextChange
                : () => {}
              }
              placeholder={intl.formatMessage(messages.describeProblem)}
            />
          )}
        </Styled.Option>
      ))}
      <Styled.ButtonContainer>
        <Styled.Button onClick={handleLeave} ghosted="true">
          {intl.formatMessage(messages.skip)}
        </Styled.Button>
        <Styled.Button onClick={handleSubmit} disabled={!selectedOption}>
          {intl.formatMessage(messages.continue)}
        </Styled.Button>
      </Styled.ButtonContainer>
    </Styled.OptionsWrapper>
  );
};

export default injectIntl(ProblemStep);
