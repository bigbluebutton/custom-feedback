import styled from 'styled-components';
import {
  btnPrimaryBg,
  btnPrimaryColor,
  btnPrimaryDisabledBg,
  colorBackground,
  colorGray,
  colorWhite,
} from '../../ui/palette';
import { TiStarFullOutline, TiStarOutline } from 'react-icons/ti';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: ${colorBackground};
`;

const Box = styled.div`
  display: flex;
  flex-direction: column;
  background-color: ${colorWhite};
  padding: 24px;
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  gap: 24px;
  min-width: 40vw;
  max-width: 40vw;
`;

const EndedTitle = styled.span`
  font-size: 16px;
  font-style: normal;
  font-weight: 700;
  line-height: normal;
`;

const TitleWrapper = styled.div`
  display: flex;
`;

const Title = styled.h2`
  font-size: 18px;
  font-weight: 700;
  font-style: normal;
  line-height: normal;
  margin: 0;
`;

const Progress = styled.div`
  margin-inline-start: auto;
`;

const Description = styled.span`
  font-size: 16px;
`;

const Stars = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
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

const OutlinedStar = styled(TiStarOutline)`
  cursor: pointer;
`;

const FilledStar = styled(TiStarFullOutline)`
  cursor: pointer;
`;

const styles = {
  Container,
  Box,
  TitleWrapper,
  Title,
  Progress,
  EndedTitle,
  Description,
  Stars,
  Button,
  ButtonContainer,
  OutlinedStar,
  FilledStar,
};

export default styles;

