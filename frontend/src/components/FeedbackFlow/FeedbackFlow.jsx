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
  'errors.max_participants_reason': {
    id: 'app.customFeedback.errors.max_participants_reason',
  },
  'errors.guest_deny': {
    id: 'app.customFeedback.errors.guest_deny',
  },
  'errors.meeting_ended': {
    id: 'app.customFeedback.errors.meeting_ended',
  },
  'errors.validate_token_failed_eject_reason': {
    id: 'app.customFeedback.errors.validate_token_failed_eject_reason',
  },
  'errors.banned_user_rejoining_reason': {
    id: 'app.customFeedback.errors.banned_user_rejoining_reason',
  },
  'errors.duplicate_user_in_meeting_eject_reason': {
    id: 'app.customFeedback.errors.duplicate_user_in_meeting_eject_reason',
  },
  'errors.checksumError': {
    id: 'app.customFeedback.errors.checksumError',
  },
  'errors.invalidMeetingId': {
    id: 'app.customFeedback.errors.invalidMeetingId',
  },
  'errors.meetingForciblyEnded': {
    id: 'app.customFeedback.errors.meetingForciblyEnded',
  },
  'errors.invalidPassword': {
    id: 'app.customFeedback.errors.invalidPassword',
  },
  'errors.mismatchCreateTime': {
    id: 'app.customFeedback.errors.mismatchCreateTime',
  },
  'errors.generic': {
    id: 'app.customFeedback.errors.generic',
  },
});

const reasonKeyMap = {
  maxParticipantsReached: 'max_participants_reason',
  guestDeniedAccess: 'guest_deny',
  idNotUnique: 'idNotUnique',
  mismatchCreateTimeParam: 'mismatchCreateTime',
};

const FeedbackFlow = ({ intl }) => {
  const [currentStep, setCurrentStep] = useState('rating');
  const [isValidSession, setIsValidSession] = useState(true);
  const [isSkipped, setIsSkipped] = useState(false);
  const [endReason, setEndReason] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

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
    let reason = params.get('reason');
    const errorsParam = params.get('errors');

    if (errorsParam) {
      try {
        const errors = JSON.parse(errorsParam);
        if (Array.isArray(errors) && errors.length > 0 && errors[0].key) {
          reason = errors[0].key;
        }
      } catch (e) {
        console.error('Error parsing errors parameter:', e);
      }
    }

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
      const mappedReason = reasonKeyMap[reason] || reason;
      const messageKey = `errors.${mappedReason}`;

      if (mappedReason && messages[messageKey]) {
        setErrorMessage(intl.formatMessage(messages[messageKey]));
      } else {
        setErrorMessage(intl.formatMessage(messages['errors.generic'], { reason: reason || 'unknown_error' }));
      }
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

  const updateFeedback = (data) => {
    let updatedFeedbackData = { ...feedback.current };

    if (data.hasOwnProperty('rating')) {
      updatedFeedbackData = { ...updatedFeedbackData, rating: data.rating };
    } else if (data.hasOwnProperty('email')) {
      updatedFeedbackData.user.email = data.email;
    } else {
      updatedFeedbackData.feedback = { ...updatedFeedbackData.feedback, ...data };
    }

    feedback.current = updatedFeedbackData;
    sessionStorage.setItem('feedbackData', JSON.stringify(updatedFeedbackData));
  };

  const handleNext = (nextStep, data) => {
    updateFeedback(data);

    if (!nextStep) {
      submitFeedback(feedback.current);
    }

    setCurrentStep(nextStep || 'confirmation');
  };

  const renderStep = () => {
    if (!isValidSession) {
      return <div>{errorMessage}</div>;
    }

    switch (currentStep) {
      case 'rating':
        return <RatingStep onNext={handleNext} onUpdate={updateFeedback} />;
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
