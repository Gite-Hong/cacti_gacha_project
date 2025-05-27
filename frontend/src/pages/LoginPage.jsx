// src/pages/LoginPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./LoginPage.css";
import logo from "../assets/mainlogo.png"; // ⬅️ 로고 이미지 import

function LoginPage({ setUser }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_BACKEND_URL; // ⬅️ 백엔드 URL .env에서 가져오기

  const handleLogin = async () => {
    setErrorMessage("");
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, { username, password });
      const loggedInUser = response.data.user;
      setUser(loggedInUser);

      setTimeout(() => {
        if (loggedInUser.role === "admin") {
          alert("관리자로 로그인 성공!");
          navigate("/main");
        } else if (loggedInUser.role === "user") {
          alert("일반 사용자로 로그인 성공!");
          navigate("/main");
        } else {
          alert("알 수 없는 사용자 역할");
          setErrorMessage("로직 오류: 관리자/사용자 역할을 확인하세요.");
        }
      }, 0);

    } catch (error) {
      const apiError = error.response?.data;
      if (apiError?.message) {
        setErrorMessage(apiError.message);
      } else {
        setErrorMessage("알 수 없는 오류가 발생했습니다. 다시 시도해주세요.");
      }
    }
  };

  return (
    <div className="login-container">
      {/* ⬇️ 로고 이미지 추가 */}
      <img src={logo} alt="로고" className="login-logo" />
      <div className="login-box">
        <h1 className="login-title">로그인</h1>
        <div className="login-form">
          <div className="form-group">
            <label>아이디</label>
            <input
              type="text"
              placeholder="아이디를 입력하세요"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
            />
          </div>
          {errorMessage && <p className="error-message">{errorMessage}</p>}
          <button onClick={handleLogin} className="login-button">
            로그인
          </button>
          <button onClick={() => navigate("/signup")} className="signup-button">
            회원가입
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
