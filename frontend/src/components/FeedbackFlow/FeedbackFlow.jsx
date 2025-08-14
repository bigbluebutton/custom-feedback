import { useState, useEffect, useRef } from 'react';
import { injectIntl, defineMessages } from 'react-intl';
import { getDeviceInfo, submitFeedback, handleBeforeUnload, getRedirectUrl, getRedirectTimeout } from '../service';
import RatingStep from '../RatingStep/RatingStep';
import ProblemStep from '../ProblemStep/ProblemStep';
import EmailStep from '../EmailStep/EmailStep';
import ConfirmationStep from '../ConfirmatioStep/ConfirmationStep';
import feedbackData from '../../feedbackData.json';
import Styled from './styles';

const messages = defineMessages({
  feedbackTitle: {
    id: 'app.customFeedback.feedbackTitle',
    description: 'Feedback Evaluation Title',
  },
});

const FeedbackFlow = ({ intl }) => {
  const [currentStep, setCurrentStep] = useState('rating');
  const [isValidSession, setIsValidSession] = useState(true);
  const [isSkipped, setIsSkipped] = useState(false);
  const [endReason, setEndReason] = useState(null);

  const feedback = useRef({
    session: {},
    device: getDeviceInfo(),
    user: {},
    feedback: {}
  });

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('meetingId');
    const userId = params.get('userId');
    const skipped = params.get('skipped') === 'true';
    const finalRedirectUrl = params.get('redirectUrl');
    const redirectTimeout = params.get('redirectTimeout');
    const reason = params.get('reason');

    if (reason) {
      setEndReason(reason);
    }

    if (skipped) {
      setIsSkipped(true);
      setCurrentStep('confirmation');
      if (finalRedirectUrl) {
        sessionStorage.setItem('redirectUrl', finalRedirectUrl);
      }
      if (redirectTimeout) {
        sessionStorage.setItem('redirectTimeout', redirectTimeout);
      }
      return;
    }

    if (!sessionId || !userId) {
      setIsValidSession(false);
      return;
    }

    feedback.current = {
      ...feedback.current,
      session: { sessionId },
      user: { userId }
    };

    const savedFeedback = sessionStorage.getItem('feedbackData');
    if (savedFeedback) {
      feedback.current = JSON.parse(savedFeedback);
    }
  }, []);

  const handleNext = (nextStep, data) => {
    const updatedFeedback = () => {
      let updatedFeedback = { ...feedback.current };
  
      if (data.hasOwnProperty('rating')) {
        updatedFeedback = { ...updatedFeedback, rating: data.rating };
      } else if (data.hasOwnProperty('email')) {
        updatedFeedback.user.email = data.email;
      } else {
        updatedFeedback.feedback = { ...updatedFeedback.feedback, ...data };
      }
  
      sessionStorage.setItem('feedbackData', JSON.stringify(updatedFeedback));

      return updatedFeedback;
    };

    feedback.current = updatedFeedback();
  
    if (!nextStep) {
      submitFeedback(feedback.current);
    }

    setCurrentStep(nextStep || 'confirmation');
  };

  const renderStep = () => {
    if (!isValidSession) {
      return <div>Session or User ID is missing. Please try again.</div>;
    }

    switch (currentStep) {
      case 'rating':
        return <RatingStep onNext={handleNext} />;
      case 'problem':
      case 'audioProblem':
      case 'cameraProblem':
      case 'connectionProblem':
      case 'smartphoneProblem':
      case 'microphoneProblem':
      case 'interfaceProblem':
      case 'fileUploadProblem':
      case 'audioCaptionsProblem':
        return <ProblemStep intl={intl} key={currentStep} onNext={handleNext} stepData={feedbackData[currentStep]} />;
      case 'like':
        return <ProblemStep key="like" onNext={handleNext} stepData={feedbackData.like} />;
      case 'wish':
        return <ProblemStep key="wish" onNext={handleNext} stepData={feedbackData.wish} />;
      case 'email':
        return <EmailStep key="email" onNext={handleNext} stepData={feedbackData.email} />;
      case 'confirmation':
      default:
        return <ConfirmationStep isSkipped={isSkipped} endReason={endReason} getRedirectUrl={getRedirectUrl} getRedirectTimeout={getRedirectTimeout} />;
    }
  };

  const isStepValid = feedbackData && currentStep && feedbackData[currentStep] && isValidSession;

  return (
    <Styled.Container>
      <Styled.Box>
        {!isSkipped && (
          <Styled.TitleWrapper>
            <Styled.Title>{intl.formatMessage(messages.feedbackTitle)}</Styled.Title>
            {isStepValid && <Styled.Progress>{feedbackData[currentStep].progress}</Styled.Progress>}
          </Styled.TitleWrapper>
        )}
        {renderStep()}
      </Styled.Box>
    </Styled.Container>
  );
};

export default injectIntl(FeedbackFlow);
