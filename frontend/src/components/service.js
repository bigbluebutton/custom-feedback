import UAParser from 'ua-parser-js';

export const getDeviceInfo = () => {
  const parser = new UAParser();
  const result = parser.getResult();

  return {
    type: result.device.type || 'unknown',
    os: result.os.name || 'unknown',
    browser: result.browser.name || 'unknown'
  };
};

export const getURLParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('meetingId');
  const userId = urlParams.get('userId');

  return {
    sessionId,
    userId
  };
};

export const submitFeedback = async (feedback) => {
  try {
    const response = await fetch('/feedback/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(feedback)
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log('Feedback successfully submitted:', responseData);
      sessionStorage.removeItem('feedbackData');
    } else {
      console.error('Failed to submit feedback');
    }
  } catch (error) {
    console.error('Error submitting feedback:', error);
  }
};

export const handleBeforeUnload = async () => {
  const savedFeedback = sessionStorage.getItem('feedbackData');
  if (savedFeedback) {
    await submitFeedback(JSON.parse(savedFeedback));
    sessionStorage.removeItem('feedbackData');
  }
};

