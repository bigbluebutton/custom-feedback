import { createContext, useContext } from 'react';

// Whether /feedback/check's nginx+bbb-web auth explicitly rejected this
// visitor (a 401 — no valid sessionToken). Set once in index.jsx before the
// tree renders; FeedbackFlow reads it instead of inferring session validity
// from meetingId/userId URL params, which the backend no longer requires (or
// trusts) and BBB's logoutURL may not even carry.
export const SessionContext = createContext({ isValid: true });

export const useSession = () => useContext(SessionContext);
