
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
  text-align: left;
`;

const Title = styled.h2`
  font-size: 24px;
  margin-bottom: 24px;
`;

const Option = styled.div`
  margin-bottom: 8px;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 10px;
  margin-top: 16px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 5px;
  resize: none;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: space-evenly;
  margin-top: 8px;
`;

const Button = styled.button`
  flex: 0 1 30%;
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
  Option,
  TextArea,
  ButtonContainer,
  Button,
};

export default styles;

