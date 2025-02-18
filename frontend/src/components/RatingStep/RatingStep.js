import React, { useState } from 'react';
import { FaStar } from 'react-icons/fa';
import { defineMessages, injectIntl } from 'react-intl';
import feedbackData from '../../feedbackData.json';
import Styled from './styles';

const messages = defineMessages({
  ratingTitle: {
    id: 'app.customFeedback.rating.feedbackEvaluation',
    description: 'Feedback Evaluation'
  },
  ratingSubtitle: {
    id: 'app.customFeedback.rating.subtitle',
    description: 'We would love to know how your experience was with the platform (optional)'
  },
  leaveButton: {
    id: 'app.customFeedback.defaultButtons.leave',
    description: 'Leave'
  }
});

const RatingStep = ({ onNext, intl }) => {
  const [rating, setRating] = useState(null);
  const [hover, setHover] = useState(null);

  const handleRatingChange = (value) => {
    setRating(value);
    const nextStep = feedbackData.rating[value].next;
    onNext(nextStep, { rating: value });
  };

  const handleLeave = () => {
    onNext(null, {});
  };

  const params = new URLSearchParams(window.location.search);
  const endReason = params.get('reason');

  return (
    <Styled.Container>
      <Styled.Box>
        {endReason && <Styled.EndedTitle>{endReason}</Styled.EndedTitle>}
        <Styled.Title>{intl.formatMessage(messages.ratingTitle)}</Styled.Title>
        <p>{intl.formatMessage(messages.ratingSubtitle)}</p>
        <Styled.Stars>
          {[...Array(11).keys()].slice(1).map(i => (
            <FaStar
              key={i}
              size={30}
              color={i <= (hover || rating) ? "#ffc107" : "#e4e5e9"}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => handleRatingChange(i)}
            />
          ))}
        </Styled.Stars>
        <Styled.ButtonContainer>
          <Styled.Button onClick={handleLeave}>
            {intl.formatMessage(messages.leaveButton)}
          </Styled.Button>
        </Styled.ButtonContainer>
      </Styled.Box>
    </Styled.Container>
  );
};

export default injectIntl(RatingStep);
