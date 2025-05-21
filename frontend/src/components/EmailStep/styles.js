import styled from 'styled-components';
import {
  colorGray,
  btnPrimaryColor,
  btnPrimaryBg,
  btnPrimaryDisabledBg,
  defaultBorderColor,
} from '../../ui/palette';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
`;

const Box = styled.div`
  background-color: #f9f9f9;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  text-align: center;
`;

const Title = styled.h2`
  font-size: 24px;
`;

const Input = styled.input`
  display: flex;
  padding: 16px;
  align-items: center;
  gap: 8px;
  align-self: stretch;
  border-radius: 16px;
  border: 1px solid ${defaultBorderColor};
  font-size: 16px;
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

const styles = {
  Container,
  Box,
  Title,
  Input,
  Button,
  ButtonContainer,
};

export default styles;
