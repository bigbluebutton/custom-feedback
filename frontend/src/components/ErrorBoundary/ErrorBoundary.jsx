import React from 'react';
import ConfirmationStep from '../ConfirmatioStep/ConfirmationStep';
import { getRedirectUrl, getRedirectTimeout } from '../service';
import Styled from '../FeedbackFlow/styles';

// A definition the renderers cannot handle must not strand the user on a blank
// page: close the flow so the redirect still happens.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Ending the flow: the form failed to render', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Styled.Container>
        <Styled.Box>
          <ConfirmationStep
            isSkipped
            getRedirectUrl={getRedirectUrl}
            getRedirectTimeout={getRedirectTimeout}
          />
        </Styled.Box>
      </Styled.Container>
    );
  }
}

export default ErrorBoundary;
