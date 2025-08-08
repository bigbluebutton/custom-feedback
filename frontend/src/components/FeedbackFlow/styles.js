import styled from 'styled-components';
import {
  colorBackground,
  colorTextDefault,
  colorTextLight,
  colorWhite,
} from '../../ui/palette';

const largeDown = 'only screen and (max-width: 119.99em)';
const largeUp = 'only screen and (min-width: 120em)';

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
  color: ${colorTextDefault};
  padding: 24px;
  border-radius: 10px;
  box-shadow: 4px 8px 8px 0px rgba(0, 0, 0, 0.20);
  gap: 24px;
  @media ${largeDown} {
    min-width: 45vw;
    max-width: 85vw;
  }
  @media ${largeUp} {
    min-width: 30vw;
    max-width: 32vw;
  }
`;

const TitleWrapper = styled.div`
  display: flex;
`;

const Title = styled.h2`
  font-size: 18px;
  font-style: normal;
  font-weight: 700;
  line-height: normal;
  margin: 0;
`;

const Progress = styled.div`
  margin-inline-start: auto;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  color: ${colorTextLight};
  align-content: center;
`;

const styles = {
  Container,
  Box,
  TitleWrapper,
  Title,
  Progress,
}

export default styles;
