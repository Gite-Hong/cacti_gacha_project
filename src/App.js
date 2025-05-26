// src/App.js
import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import MainPage from "./pages/MainPage";
import WorkCheckPage from "./pages/WorkCheckPage";

import "./App.css";

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage setUser={setUser} />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/main" element={<MainPage user={user} setUser={setUser} />} />
        <Route path="*" element={<div>404 Not Found</div>} />
        <Route path="/work-check" element={<WorkCheckPage />} />
        <Route path="/work-check/:username" element={<WorkCheckPage />} />

      </Routes>
    </Router>
  );
}
export default App;
