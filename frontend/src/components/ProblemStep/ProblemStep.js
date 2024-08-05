import React, { useState, useEffect } from 'react';
import { injectIntl } from 'react-intl';
import Styled from './styles';

const ProblemStep = ({ onNext, stepData, intl }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [textValue, setTextValue] = useState('');

  useEffect(() => {
    setSelectedOption(null);
    setTextValue('');
  }, [stepData]);

  const handleOptionChange = (option) => {
    setSelectedOption(option);
    if (option.value !== 'other') {
      setTextValue('');
    }
  };

  const handleTextChange = (event) => {
    setTextValue(event.target.value);
  };

  const handleLeave = () => {
    onNext(null);
    window.close();
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
    <Styled.Container>
      <Styled.Box>
        <Styled.Title>{intl.formatMessage({ id: stepData.titleLabel.id })}</Styled.Title>
        {stepData.options.map((option, index) => (
          <Styled.Option key={index}>
            {option.type === 'radio' ? (
              <div>
                <input
                  type="radio"
                  id={option.value}
                  name={`problem-${stepData.titleLabel.id}`}
                  value={option.value}
                  checked={selectedOption ? selectedOption.value === option.value : false}
                  onChange={() => handleOptionChange(option)}
                />
                <label htmlFor={option.value}>{intl.formatMessage({ id: option.textLabel.id })}</label>
              </div>
            ) : (
              <Styled.TextArea
                value={textValue}
                onChange={handleTextChange}
                disabled={!selectedOption || selectedOption.value !== 'other'}
              />
            )}
          </Styled.Option>
        ))}
        <Styled.ButtonContainer>
          <Styled.Button onClick={handleLeave} style={{ backgroundColor: '#ccc' }}>
            {intl.formatMessage({ id: 'app.customFeedback.defaultButtons.leave' })}
          </Styled.Button>
          <Styled.Button onClick={handleSubmit} disabled={!selectedOption}>
            {intl.formatMessage({ id: 'app.customFeedback.defaultButtons.next' })}
          </Styled.Button>
        </Styled.ButtonContainer>
      </Styled.Box>
    </Styled.Container>
  );
};

export default injectIntl(ProblemStep);
