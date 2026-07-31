import { useState } from 'react';
import { defineMessages, injectIntl } from 'react-intl';
import Styled from './styles';
import { colorGray, colorPrimary } from '../../ui/palette';

const DEFAULT_MAX_SCORE = 10;

const messages = defineMessages({
  ratingSubtitle: {
    id: 'app.customFeedback.rating.subtitle',
    description: 'We would love to know how your experience was with the platform (optional)'
  },
  leaveButton: {
    id: 'app.customFeedback.defaultButtons.leave',
    description: 'Leave'
  },
  next: {
    id: 'app.customFeedback.defaultButtons.next',
    description: 'Button label to continue to the next feedback step',
  }
});

const RatingStep = ({ onNext, onUpdate, stepData, intl }) => {
  const [rating, setRating] = useState(null);
  const [hover, setHover] = useState(null);

  // The scale is however many scores the step maps.
  const scores = Object.keys(stepData).filter((key) => /^\d+$/.test(key)).map(Number);
  const maxScore = scores.length ? Math.max(...scores) : DEFAULT_MAX_SCORE;

  const handleRatingChange = (value) => {
    setRating(value);
    onUpdate({ rating: value });
  };

  const handleLeave = () => {
    const data = rating ? { rating } : {};
    onNext(null, data);
  };

  const nextStep = () => {
    const nextStep = stepData[rating]?.next;
    onNext(nextStep, { rating });
  }

  const params = new URLSearchParams(window.location.search);
  const endReason = params.get('reason');

  return (
    <>
      {endReason && <Styled.EndedTitle>{endReason}</Styled.EndedTitle>}
      <Styled.Description>{intl.formatMessage(messages.ratingSubtitle)}</Styled.Description>
      <Styled.Stars
        onMouseLeave={() => setHover(null)}
      >
        {[...Array(maxScore).keys()].map(i => i + 1).map(i => (
          i <= (hover || rating) ?
          ( <Styled.FilledStar
              key={i}
              size={32}
              color={colorPrimary}
              onMouseEnter={() => setHover(i)}
              onClick={() => handleRatingChange(i)}
            />
          ) : (
            <Styled.OutlinedStar
              key={i}
              size={32}
              color={colorGray}
              onMouseEnter={() => setHover(i)}
              onClick={() => handleRatingChange(i)}
            />
          )
        ))}
      </Styled.Stars>
      <Styled.ButtonContainer>
        <Styled.Button onClick={handleLeave} ghosted="true">
          {intl.formatMessage(messages.leaveButton)}
        </Styled.Button>
        <Styled.Button onClick={nextStep} disabled={!rating}>
          {intl.formatMessage(messages.next)}
        </Styled.Button>
      </Styled.ButtonContainer>
    </>
  );
};

export default injectIntl(RatingStep);
