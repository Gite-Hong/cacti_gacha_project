import React, { useState, useEffect } from "react";
import AdminPage from "./AdminPage";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL = process.env.REACT_APP_BACKEND_URL;

function MainPage({ user, setUser }) {
  const [currentTime, setCurrentTime] = useState("");
  const [hasClockedIn, setHasClockedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const formattedTime = now.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setCurrentTime(formattedTime);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkClockInStatus = async () => {
      try {
        const res = await axios.post(
          `${API_URL}/api/work/status`,
          { username: user.username },
          { withCredentials: true }
        );
        setHasClockedIn(res.data.isClockedIn);
      } catch (err) {
        console.error("출근 상태 확인 오류:", err);
      }
    };
    checkClockInStatus();
  }, [user.username]);

  const handleClockIn = async () => {
    try {
      const resUser = await axios.get(`${API_URL}/api/admin/users`, {
        withCredentials: true,
      });
      const currentUser = resUser.data.find((u) => u.username === user.username);

      if (!currentUser) {
        alert("사용자 정보를 찾을 수 없습니다.");
        return;
      }

      const { work_start, work_end } = currentUser;
      if (!work_start || !work_end) {
        alert("근무시간 정보가 없습니다. 관리자에게 문의하세요.");
        return;
      }

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const workStart = new Date(`${dateStr}T${work_start}`);
      const workEnd = new Date(`${dateStr}T${work_end}`);
      const thirtyMinBeforeStart = new Date(workStart.getTime() - 30 * 60 * 1000);
////////////////////////////////////
      // if (now < thirtyMinBeforeStart || now > workEnd) {
      //   alert("근무시간이 아닙니다. 관리자에게 문의하세요.");
      //   return;
      // }

      const response = await axios.post(
        `${API_URL}/api/work/clock-in`,
        { username: user.username },
        { withCredentials: true }
      );

      // ✅ 백엔드에서 근무 요일 아님 응답이 온 경우
      if (response.data.message === "근무 요일이 아닙니다.") {
        alert("❌ 근무 요일이 아닙니다!");
        return;
      }
      
      alert(`${user.name}님, 출근 기록 완료!`);
      setHasClockedIn(true);
    } catch (err) {
      alert("출근 기록 중 오류!");
      console.error(err);
    }
  };

  const handleClockOut = async () => {
    try {
      const res = await axios.post(
        `${API_URL}/api/work/clock-out`,
        { username: user.username },
        { withCredentials: true }
      );
      if (res.data.message === "퇴근 시간이 아닙니다.") {
        alert("퇴근 시간이 아닙니다.");
        setHasClockedIn(true);
        return;
      }
      alert(`${user.name}님, 퇴근 기록 완료!`);
      setHasClockedIn(false);
    } catch (err) {
      alert("퇴근 기록 중 오류!");
      console.error(err);
    }
  };

  const handleLogout = () => {
    setUser(null);
    navigate("/");
  };

  return (
    <div style={{ padding: "20px" }}>
      <img
        src={require("../assets/mainlogo.png")}
        alt="로고"
        style={{ height: "60px", marginBottom: "15px" }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0 }}>{user.name}님, 환영합니다!</h2>
        <button onClick={handleLogout} style={{ marginLeft: "12px" }}>
          로그아웃
        </button>
      </div>

      {user.role === "admin" ? (
        <AdminPage user={user} />
      ) : (
        <div
          style={{
            border: "1px solid #bbb",
            borderRadius: "8px",
            padding: "20px",
            margin: "20px",
            maxWidth: "350px",
          }}
        >
          <p>
            현재 날짜/시간: <b>{currentTime}</b>
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "16px",
              marginTop: "16px",
            }}
          >
            <button
              onClick={handleClockIn}
              disabled={hasClockedIn}
              style={{
                padding: "12px 24px",
                fontSize: "16px",
                flex: 1,
                maxWidth: "120px",
              }}
            >
              출근
            </button>
            <button
              onClick={handleClockOut}
              disabled={!hasClockedIn}
              style={{
                padding: "12px 24px",
                fontSize: "16px",
                flex: 1,
                maxWidth: "120px",
              }}
            >
              퇴근
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainPage;
