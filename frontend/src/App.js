import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import FeedbackFlow from './components/FeedbackFlow/FeedbackFlow';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/feedback" element={<FeedbackFlow />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

