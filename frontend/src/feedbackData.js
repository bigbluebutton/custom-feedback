import { createContext, useContext } from 'react';

const FEEDBACK_DATA_PATH = '/feedback/feedbackData.json';

export const DEFAULT_INITIAL_STEP = 'rating';

const FALLBACK_FEEDBACK_DATA = {
  initialStep: DEFAULT_INITIAL_STEP,
  [DEFAULT_INITIAL_STEP]: { type: 'rating' },
};

const hasInitialStep = (data) => Boolean(
  data
  && typeof data === 'object'
  && data[data.initialStep || DEFAULT_INITIAL_STEP]
);

export const fetchFeedbackData = async () => {
  try {
    const res = await fetch(FEEDBACK_DATA_PATH);
    const isJson = res.headers.get('content-type')?.includes('application/json');

    if (!res.ok || !isJson) {
      console.error('Error loading feedback data: file not found or not JSON');
    } else {
      const data = await res.json();

      if (hasInitialStep(data)) return data;

      console.error('Error loading feedback data: definition has no initial step');
    }
  } catch (error) {
    console.error('Error loading feedback data:', error);
  }

  return FALLBACK_FEEDBACK_DATA;
};

export const FeedbackDataContext = createContext(FALLBACK_FEEDBACK_DATA);

export const useFeedbackData = () => useContext(FeedbackDataContext);
