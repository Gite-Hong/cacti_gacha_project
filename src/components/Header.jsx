// src/components/Header.jsx
import React from "react";
import logo from "../assets/mainlogo.png"; // 실제 경로에 맞게 수정

function Header() {
  return (
    <div style={{ marginBottom: "10px" }}>
      <img src={logo} alt="로고" className="header-logo" />
    </div>
  );
}

export default Header;
