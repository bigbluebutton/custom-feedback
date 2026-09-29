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

// Defense in depth for the actual navigation sink (ConfirmationStep's
// `window.location.href = redirectUrl`). Host allowlisting already happened
// server-side (`/feedback/check`, see index.jsx) before this value was
// stored, so the frontend can't re-check the host without duplicating that
// allowlist. It only re-checks the scheme, to guard against a stale or
// otherwise-written sessionStorage value ever reaching the sink as a
// `javascript:`/`data:` URI.
export const isSafeRedirectScheme = (rawUrl) => {
  if (!rawUrl) return false;

  let parsed;
  try {
    parsed = new URL(rawUrl, window.location.origin);
  } catch (e) {
    return false;
  }

  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
};

export const setRedirectUrl = (redirectUrl) => {
  if (redirectUrl) {
    sessionStorage.setItem('redirectUrl', redirectUrl);
  } else {
    sessionStorage.removeItem('redirectUrl');
  }
};

export const setRedirectTimeout = (redirectTimeout) => {
  if (redirectTimeout !== undefined && redirectTimeout !== null && redirectTimeout !== '') {
    sessionStorage.setItem('redirectTimeout', redirectTimeout);
  } else {
    sessionStorage.removeItem('redirectTimeout');
  }
};

export const getRedirectUrl = () => {
  const storedUrl = sessionStorage.getItem('redirectUrl');

  return isSafeRedirectScheme(storedUrl) ? storedUrl : null;
};

export const getRedirectTimeout = () => {
  return sessionStorage.getItem('redirectTimeout');
};

export const handleBeforeUnload = async () => {
  const savedFeedback = sessionStorage.getItem('feedbackData');
  if (savedFeedback) {
    const feedback = JSON.parse(savedFeedback);
    const blob = new Blob([JSON.stringify(feedback)], { type: 'application/json; charset=UTF-8' });
    navigator.sendBeacon('/feedback/submit', blob);
    sessionStorage.removeItem('feedbackData');
  }
};

