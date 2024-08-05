import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  font-family: 'Nunito Sans', sans-serif;
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
  margin-bottom: 24px;
`;

const Stars = styled.div`
  display: flex;
  justify-content: center;
  margin: 20px 0;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 24px;
`;

const Button = styled.button`
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const styles = {
  Container,
  Box,
  Title,
  Stars,
  Button,
  ButtonContainer,
};

export default styles;

