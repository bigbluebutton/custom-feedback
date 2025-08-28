import { useState } from 'react';
import { defineMessages, injectIntl } from 'react-intl';
import feedbackData from '../../feedbackData.json';
import Styled from './styles';
import { colorGray, colorPrimary } from '../../ui/palette';

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

const RatingStep = ({ onNext, onUpdate, intl }) => {
  const [rating, setRating] = useState(null);
  const [hover, setHover] = useState(null);

  const handleRatingChange = (value) => {
    setRating(value);
    onUpdate({ rating: value });
  };

  const handleLeave = () => {
    const data = rating ? { rating } : {};
    onNext(null, data);
  };

  const nextStep = () => {
    const nextStep = feedbackData.rating[rating].next;
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
        {[...Array(1 + 10).keys()].slice(1).map(i => (
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
