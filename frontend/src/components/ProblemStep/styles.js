import styled from 'styled-components';
import {
  btnPrimaryBg,
  btnPrimaryColor,
  btnPrimaryDisabledBg,
  colorGray,
  defaultBorderColor,
} from '../../ui/palette';

const ProblemWrapper = styled.div`
  display: flex;
  flex-flow: column;
  gap: 24px;
`;

const TitleOptionsWrapper = styled.div`
  display: flex;
  flex-flow: column;
  gap: 16px;
`;

const OptionsWrapper = styled.div`
  display: flex;
  flex-flow: column;
  gap: 8px;
`;

const Option = styled.div`
  align-items: center;
  display: flex;
  gap: 8px;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
  border: 1px solid ${defaultBorderColor};
  border-radius: 16px;
  resize: none;
  align-items: center;
  min-height: 56px;
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
`;

const ClicableArea = styled.div`
  cursor: pointer;
  display: flex;
  gap: 8px;
  align-items: center;
`;

const Label = styled.label`
  cursor: pointer;
`;

const RadioButton = styled.input`
  margin: 0;
  aspect-ratio: 1;
  height: 16px;
  color: ${colorGray};
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 24px;
`;

const Button = styled.button`
  padding: 8px 16px;
  font-size: 16px;
  cursor: pointer;
  background-color: ${({ ghosted }) => ghosted ? 'transparent' : btnPrimaryBg };
  color: ${({ ghosted }) => ghosted ? colorGray : btnPrimaryColor };
  ${({ ghosted }) => ghosted && 'text-decoration: underline' };
  border: none;
  border-radius: 16px;
  &:disabled {
    background-color: ${btnPrimaryDisabledBg};
    cursor: not-allowed;
  }
`;

const StepTitle = styled.div`
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
`;

const styles = {
  ProblemWrapper,
  TitleOptionsWrapper,
  OptionsWrapper,
  Option,
  TextArea,
  ClicableArea,
  Label,
  RadioButton,
  ButtonContainer,
  Button,
  StepTitle,
};

export default styles;

