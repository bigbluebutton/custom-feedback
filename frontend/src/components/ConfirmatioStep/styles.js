import styled, { keyframes } from 'styled-components';

const EndedTitle = styled.span`
  font-size: 16px;
  font-style: normal;
  font-weight: 700;
  line-height: normal;
  display: block;
  margin-bottom: 16px;
`;

const Description = styled.div`
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
`;

const dotAnimation = keyframes`
  0%   { content: ''; }
  25%  { content: '.'; }
  50%  { content: '..'; }
  75%  { content: '...'; }
  100% { content: ''; }
`;

const Dots = styled.span`
  &::after {
    display: inline-block;
    text-align: left;
    animation: ${dotAnimation} 1.2s steps(4, end) infinite;
    content: '';
  }
`;

const styles = {
  EndedTitle,
  Description,
  dotAnimation,
  Dots,
};

export default styles;
