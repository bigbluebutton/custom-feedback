import { useState, useEffect } from 'react';
import { injectIntl, defineMessages } from 'react-intl';
import { getDeviceInfo, getURLParams, submitFeedback, handleBeforeUnload, getRedirectUrl, getRedirectTimeout } from '../service';
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
  const [feedback, setFeedback] = useState({
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
    const { sessionId, userId } = getURLParams();
    if (!sessionId || !userId) {
      setIsValidSession(false);
      return;
    }

    setFeedback(prev => ({
      ...prev,
      session: { sessionId },
      user: { userId }
    }));

    const savedFeedback = sessionStorage.getItem('feedbackData');
    if (savedFeedback) {
      setFeedback(JSON.parse(savedFeedback));
    }
  }, []);

  const handleNext = (nextStep, data) => {
    setFeedback(prev => {
      let updatedFeedback = { ...prev };
  
      if (data.hasOwnProperty('rating')) {
        updatedFeedback = { ...updatedFeedback, rating: data.rating };
      } else if (data.hasOwnProperty('email')) {
        updatedFeedback.user.email = data.email;
      } else {
        updatedFeedback.feedback = { ...updatedFeedback.feedback, ...data };
      }
  
      sessionStorage.setItem('feedbackData', JSON.stringify(updatedFeedback));

      return updatedFeedback;
    });
  
    if (!nextStep) {
      submitFeedback(feedback);
      setCurrentStep(nextStep);
    } else {
      setCurrentStep(nextStep);
    }
  };

  const renderStep = () => {
    if (!isValidSession) {
      return <div>Session or User ID is missing. Please try again.</div>;
    }

    switch (currentStep) {
      case 'rating':
        return <RatingStep onNext={handleNext} />;
      case 'problem':
        return <ProblemStep intl={intl} key="problem" onNext={handleNext} stepData={feedbackData.problem} />;
      case 'audioProblem':
      case 'cameraProblem':
      case 'connectionProblem':
      case 'smartphoneProblem':
      case 'microphoneProblem':
      case 'multiuserProblem':
      case 'browserProblem':
      case 'whiteboardProblem':
      case 'interfaceProblem':
      case 'fileUploadProblem':
      case 'audioCaptionsProblem':
        return <ProblemStep key={currentStep} onNext={handleNext} stepData={feedbackData[currentStep]} />;
      case 'like':
        return <ProblemStep key="like" onNext={handleNext} stepData={feedbackData.like} />;
      case 'wish':
        return <ProblemStep key="wish" onNext={handleNext} stepData={feedbackData.wish} />;
      case 'email':
        return <EmailStep key="email" onNext={handleNext} stepData={feedbackData.email} />;
      case 'confirmation':
      default:
        return <ConfirmationStep getRedirectUrl={getRedirectUrl} getRedirectTimeout={getRedirectTimeout} />;
    }
  };

  const isStepValid = feedbackData && currentStep;
  const hasTitle = isStepValid && Object.keys(feedbackData[currentStep]).includes("titleLabel"); 

  return (
    <Styled.Container>
      <Styled.Box>
        <Styled.TitleWrapper>
          <Styled.Title>{intl.formatMessage(messages.feedbackTitle)}</Styled.Title>
          {isStepValid && <Styled.Progress>{feedbackData[currentStep].progress}</Styled.Progress>}
        </Styled.TitleWrapper> 
        {hasTitle && (
          <Styled.StepTitle>{intl.formatMessage(feedbackData[currentStep].titleLabel)}</Styled.StepTitle>
        )}
        {renderStep()}
      </Styled.Box>
    </Styled.Container>
  );
};

export default injectIntl(FeedbackFlow);
