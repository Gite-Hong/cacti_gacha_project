import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./SignupPage.css";

function SignupPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_BACKEND_URL;
  console.log("🔍 SignupPage API URL:", API_URL); // ✅ 콘솔에 찍어 확인

  const handleSignup = async () => {
    setErrorMessage("");

    const nameRegex = /^[가-힣]+$/;
    const usernameRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{5,20}$/;
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/;

    if (!nameRegex.test(name)) {
      setErrorMessage("이름은 한글만 입력할 수 있습니다.");
      return;
    }
    if (!usernameRegex.test(username)) {
      setErrorMessage("아이디는 영어와 숫자를 포함하여 5~20자로 입력해야 합니다.");
      return;
    }
    if (!passwordRegex.test(password)) {
      setErrorMessage("비밀번호는 영어, 숫자, 특수문자를 포함하여 8~20자로 입력해야 합니다.");
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/api/auth/signup`, {
        name,
        username,
        password,
      });

      alert(response.data.message);
      navigate("/"); // 로그인 페이지로 이동
    } catch (error) {
      const apiError = error.response?.data;
      if (apiError && apiError.message) {
        setErrorMessage(apiError.message);
      } else {
        setErrorMessage("알 수 없는 오류가 발생했습니다. 다시 시도해주세요.");
      }
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-box">
        <h1 className="signup-title">회원가입</h1>
        <div className="signup-form">
          <div className="form-group">
            <label>이름</label>
            <input
              type="text"
              placeholder="이름 (한글)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>아이디</label>
            <input
              type="text"
              placeholder="영어+숫자 (5~20자)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>비밀번호</label>
            <input
              type="password"
              placeholder="영어+숫자+특수문자 (8~20자)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
            />
          </div>
          {errorMessage && <p className="error-message">{errorMessage}</p>}
          <button onClick={handleSignup} className="signup-button">
            회원가입
          </button>
          <button onClick={() => navigate("/")} className="login-button">
            로그인 페이지로
          </button>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
