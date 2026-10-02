import { useState, useEffect, useRef } from 'react';
import { injectIntl, defineMessages } from 'react-intl';
import { getDeviceInfo, submitFeedback, handleBeforeUnload, getRedirectUrl, getRedirectTimeout } from '../service';
import RatingStep from '../RatingStep/RatingStep';
import ProblemStep from '../ProblemStep/ProblemStep';
import EmailStep from '../EmailStep/EmailStep';
import ConfirmationStep from '../ConfirmatioStep/ConfirmationStep';
import { DEFAULT_INITIAL_STEP, useFeedbackData } from '../../feedbackData';
import { useSession } from '../../sessionContext';
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
  'errors.removedFromConference': {
    id: 'app.customFeedback.errors.removedFromConference',
  },
  'errors.loggedOut': {
    id: 'app.customFeedback.errors.loggedOut',
  },
  'errors.permissionEjectReason': {
    id: 'app.customFeedback.errors.permissionEjectReason',
  },
  'errors.ejectedFromMeeting': {
    id: 'app.customFeedback.errors.ejectedFromMeeting',
  },
  'errors.userInactivityEjectReason': {
    id: 'app.customFeedback.errors.userInactivityEjectReason',
  },
  'errors.endedFromAPI': {
    id: 'app.customFeedback.errors.endedFromAPI',
  },
  'errors.endedWhenNoUserJoined': {
    id: 'app.customFeedback.errors.endedWhenNoUserJoined',
  },
  'errors.endedWhenLastUserLeft': {
    id: 'app.customFeedback.errors.endedWhenLastUserLeft',
  },
  'errors.endedAfterExceedingDuration': {
    id: 'app.customFeedback.errors.endedAfterExceedingDuration',
  },
  'errors.breakoutEndedAfterExceedingDuration': {
    id: 'app.customFeedback.errors.breakoutEndedAfterExceedingDuration',
  },
  'errors.breakoutEndedByModerator': {
    id: 'app.customFeedback.errors.breakoutEndedByModerator',
  },
  'errors.endedDueNoAuthed': {
    id: 'app.customFeedback.errors.endedDueNoAuthed',
  },
  'errors.endedDueNoModerators': {
    id: 'app.customFeedback.errors.endedDueNoModerators',
  },
  'errors.endedDueServiceInterruption': {
    id: 'app.customFeedback.errors.endedDueServiceInterruption',
  },
  'errors.unknownReason': {
    id: 'app.customFeedback.errors.unknownReason',
  },
});

const reasonKeyMap = {
  maxParticipantsReached: 'max_participants_reason',
  guestDeniedAccess: 'guest_deny',
  idNotUnique: 'idNotUnique',
  mismatchCreateTimeParam: 'mismatchCreateTime',
};

// Maps the *trusted* reasonCode BBB's html5-client sends (never the
// spoofable `reason` free text) to a local, already-translated message.
// Covers every code emitted by html5-client's meeting-ended component
// (its own generic/JoinErrorCodeTable/MeetingEndedTable codes); anything
// absent from this map falls back to 'unknownReason'.
const REASON_CODE_MESSAGE_MAP = {
  '410': 'meeting_ended',
  '403': 'removedFromConference',
  '430': 'loggedOut',
  'acl-not-allowed': 'removedFromConference',
  'duplicate_user_in_meeting_eject_reason': 'duplicate_user_in_meeting_eject_reason',
  'not_enough_permission_eject_reason': 'permissionEjectReason',
  'user_requested_eject_reason': 'ejectedFromMeeting',
  'system_requested_eject_reason': 'ejectedFromMeeting',
  'max_participants_reason': 'max_participants_reason',
  'validate_token_failed_eject_reason': 'validate_token_failed_eject_reason',
  'user_inactivity_eject_reason': 'userInactivityEjectReason',
  'user_logged_out_reason': 'loggedOut',
  'banned_user_rejoining_reason': 'banned_user_rejoining_reason',
  'ENDED_FROM_API': 'endedFromAPI',
  'ENDED_WHEN_NOT_JOINED': 'endedWhenNoUserJoined',
  'ENDED_WHEN_LAST_USER_LEFT': 'endedWhenLastUserLeft',
  'ENDED_AFTER_USER_LOGGED_OUT': 'endedWhenLastUserLeft',
  'ENDED_AFTER_EXCEEDING_DURATION': 'endedAfterExceedingDuration',
  'BREAKOUT_ENDED_EXCEEDING_DURATION': 'breakoutEndedAfterExceedingDuration',
  'BREAKOUT_ENDED_BY_MOD': 'breakoutEndedByModerator',
  'ENDED_DUE_TO_NO_AUTHED_USER': 'endedDueNoAuthed',
  'ENDED_DUE_TO_NO_MODERATOR': 'endedDueNoModerators',
  'ENDED_DUE_TO_SERVICE_INTERRUPTION': 'endedDueServiceInterruption',
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
  const { isValid } = useSession();
  const [currentStep, setCurrentStep] = useState(feedbackData.initialStep || DEFAULT_INITIAL_STEP);
  const [isValidSession, setIsValidSession] = useState(true);
  const [isSkipped, setIsSkipped] = useState(false);
  const [endReasonMessage, setEndReasonMessage] = useState(null);
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
    const skipped = params.get('skipped') === 'true';
    let reason = params.get('reason');
    const errorsParam = params.get('errors');
    const reasonCode = params.get('reasonCode');

    if (errorsParam) {
      try {
        const errors = JSON.parse(errorsParam);
        if (Array.isArray(errors) && errors.length > 0 && errors[0]?.key) {
          reason = errors[0].key;
        }
      } catch (e) {
        console.error('Error parsing errors parameter:', e);
      }
    }

    // The `reason` free text above comes straight from the URL and can be
    // spoofed by whoever builds the redirect, so it's only used as a lookup
    // key for the already-localized invalid-session errors below. Anything
    // shown on screen for a normal end-of-meeting must come from the
    // reasonCode lookup instead.
    if (reasonCode) {
      const messageSuffix = REASON_CODE_MESSAGE_MAP[reasonCode] || 'unknownReason';
      setEndReasonMessage(intl.formatMessage(messages[`errors.${messageSuffix}`]));
    }

    if (skipped) {
      setIsSkipped(true);
      setCurrentStep(CONFIRMATION_STEP);
      // redirectUrl/redirectTimeout are NOT read from the URL here: they can
      // only be trusted once validated against the operator's host allowlist
      // by /feedback/check, which index.jsx already awaited and persisted
      // via setRedirectUrl/setRedirectTimeout before this component mounted.
      return;
    }

    // Session validity comes from index.jsx's /feedback/check call (the only
    // party that can verify a sessionToken against bbb-web), not from
    // meetingId/userId URL params: the backend doesn't trust those, and
    // BBB's logoutURL isn't guaranteed to carry them.
    if (!isValid) {
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

    const savedFeedback = sessionStorage.getItem('feedbackData');
    if (savedFeedback) {
      feedback.current = JSON.parse(savedFeedback);
    }
  }, [isValid]);

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

      return <ConfirmationStep isSkipped={isSkipped} endReasonMessage={endReasonMessage} getRedirectUrl={getRedirectUrl} getRedirectTimeout={getRedirectTimeout} />;
    }

    return (
      <StepComponent
        key={currentStep}
        stepId={currentStep}
        stepData={stepData}
        onNext={handleNext}
        onUpdate={updateFeedback}
        endReasonMessage={endReasonMessage}
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
