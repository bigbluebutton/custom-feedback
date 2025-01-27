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

  // clear old feedback settings
  sessionStorage.removeItem('feedbackUrl');
  sessionStorage.removeItem('feedbackTimeout');

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
      if (responseData.data?.session?.redirect_url) {
        sessionStorage.setItem('redirectUrl', responseData.data?.session?.redirect_url);
      }
      if (responseData.data?.session?.redirect_timeout) {
        sessionStorage.setItem('redirectTimeout', responseData.data?.session?.redirect_timeout);
      }
      sessionStorage.removeItem('feedbackData');
    } else {
      console.error('Failed to submit feedback');
    }
  } catch (error) {
    console.error('Error submitting feedback:', error);
  }
};

export const getRedirectUrl = () => {
  return sessionStorage.getItem('redirectUrl');
};

export const getRedirectTimeout = () => {
  return sessionStorage.getItem('redirectTimeout');
};

export const handleBeforeUnload = async () => {
  const savedFeedback = sessionStorage.getItem('feedbackData');
  if (savedFeedback) {
    await submitFeedback(JSON.parse(savedFeedback));
    sessionStorage.removeItem('feedbackData');
  }
};

