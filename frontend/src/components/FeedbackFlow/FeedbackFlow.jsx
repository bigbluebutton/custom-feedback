import { useState, useEffect, useRef } from 'react';
import { injectIntl, defineMessages } from 'react-intl';
import { getDeviceInfo, submitFeedback, handleBeforeUnload, getRedirectUrl, getRedirectTimeout } from '../service';
import RatingStep from '../RatingStep/RatingStep';
import ProblemStep from '../ProblemStep/ProblemStep';
import EmailStep from '../EmailStep/EmailStep';
import ConfirmationStep from '../ConfirmatioStep/ConfirmationStep';
import { DEFAULT_INITIAL_STEP, useFeedbackData } from '../../feedbackData';
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

// Each step in feedbackData.json declares the `type` that renders it, so only a
// new kind of input needs an entry here.
const STEP_COMPONENTS = {
  rating: RatingStep,
  options: ProblemStep,
  email: EmailStep,
};

const CONFIRMATION_STEP = 'confirmation';

const FeedbackFlow = ({ intl }) => {
  const feedbackData = useFeedbackData();
  const [currentStep, setCurrentStep] = useState(feedbackData.initialStep || DEFAULT_INITIAL_STEP);
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
      setCurrentStep(CONFIRMATION_STEP);
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

    setCurrentStep(nextStep || CONFIRMATION_STEP);
  };

  const renderStep = () => {
    if (!isValidSession) {
      return <div>{errorMessage}</div>;
    }

    const stepData = currentStep === CONFIRMATION_STEP ? null : feedbackData[currentStep];
    const StepComponent = stepData && STEP_COMPONENTS[stepData.type];

    if (!StepComponent) {
      if (currentStep !== CONFIRMATION_STEP) {
        console.error(`Ending the flow: no renderer for step "${currentStep}" (type "${stepData?.type}")`);
      }

      return <ConfirmationStep isSkipped={isSkipped} endReason={endReason} getRedirectUrl={getRedirectUrl} getRedirectTimeout={getRedirectTimeout} />;
    }

    return (
      <StepComponent
        key={currentStep}
        stepId={currentStep}
        stepData={stepData}
        onNext={handleNext}
        onUpdate={updateFeedback}
      />
    );
  };

  const isStepValid = currentStep !== CONFIRMATION_STEP && feedbackData[currentStep] && isValidSession;

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
