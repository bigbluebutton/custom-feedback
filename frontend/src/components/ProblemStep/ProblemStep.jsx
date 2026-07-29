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

// Radio value that pairs with the step's `textArea` option.
const FREE_TEXT_VALUE = 'other';

const ProblemStep = ({ onNext, stepId, stepData, intl }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [textValue, setTextValue] = useState('');
  const options = stepData.options || [];
  const textAreaOption = options.find((option) => option.type === 'textArea');
  const radioOptions = options.filter((option) => option.type === 'radio');
  const hasTitle = Boolean(stepData.titleLabel);
  const title = hasTitle ? intl.formatMessage(stepData.titleLabel) : undefined;
  const textAreaLabel = textAreaOption
    ? intl.formatMessage(textAreaOption.placeholderLabel || messages.describeProblem)
    : undefined;

  const pairedOption = radioOptions.find((option) => option.value === FREE_TEXT_VALUE);
  const freeTextOption = {
    key: pairedOption?.key,
    value: FREE_TEXT_VALUE,
    next: textAreaOption?.next ?? pairedOption?.next,
  };

  useEffect(() => {
    setSelectedOption(null);
    setTextValue('');
  }, [stepData]);

  const handleOptionChange = (option) => {
    setSelectedOption(option);
    if (option.value !== FREE_TEXT_VALUE) {
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
    const radioKey = selectedOption?.key || radioOptions[0]?.key;
    const data = {};

    if (radioKey) {
      data[radioKey] = selectedOption ? selectedOption.value : '';
    }

    if (textAreaOption && textValue) {
      data[textAreaOption.key] = textValue;
    }

    onNext(selectedOption ? selectedOption.next : '', data);
  };

  return (
    <Styled.ProblemWrapper>
      <Styled.TitleOptionsWrapper>
        {hasTitle && (
          <Styled.StepTitle>{title}</Styled.StepTitle>
        )}
        <Styled.OptionsWrapper role="radiogroup" aria-label={title}>
          {options.map((option, index) =>
            option.type === 'radio' ? (
              <Styled.Option key={index}>
                <Styled.ClicableArea>
                  <Styled.RadioButton
                    type="radio"
                    id={`${stepId}-${option.value}`}
                    name={stepId}
                    value={option.value}
                    checked={selectedOption ? selectedOption.value === option.value : false}
                    onChange={() => handleOptionChange(option)}
                  />
                  <Styled.Label htmlFor={`${stepId}-${option.value}`}>{intl.formatMessage(option.textLabel)}</Styled.Label>
                </Styled.ClicableArea>
              </Styled.Option>
            ) : null
          )}
        </Styled.OptionsWrapper>
        {textAreaOption && (
          <Styled.TextArea
            name={FREE_TEXT_VALUE}
            aria-label={textAreaLabel}
            value={textValue}
            onFocus={() => handleOptionChange(freeTextOption)}
            onClick={() => handleOptionChange(freeTextOption)}
            onChange={(selectedOption || selectedOption?.value === FREE_TEXT_VALUE)
              ? handleTextChange
              : () => {}
            }
            placeholder={textAreaLabel}
          />
        )}
      </Styled.TitleOptionsWrapper>
      <Styled.ButtonContainer>
        <Styled.Button onClick={handleLeave} ghosted="true">
          {intl.formatMessage(messages.skip)}
        </Styled.Button>
        <Styled.Button onClick={handleSubmit} disabled={!selectedOption}>
          {intl.formatMessage(messages.continue)}
        </Styled.Button>
      </Styled.ButtonContainer>
    </Styled.ProblemWrapper>
  );
};

export default injectIntl(ProblemStep);
