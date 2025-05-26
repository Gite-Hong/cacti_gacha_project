import React, { useState, useEffect } from "react";
import AdminPage from "./AdminPage";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";

function MainPage({ user, setUser }) {
  const [currentTime, setCurrentTime] = useState("");
  const [hasClockedIn, setHasClockedIn] = useState(false); // 출근했는지 여부
  const navigate = useNavigate(); // navigate 추가

  // 로그인 상태 확인 (user가 없으면 로그인 페이지로 리다이렉트)
  useEffect(() => {
    if (!user) {
      navigate("/"); // user가 없으면 로그인 페이지로 이동
    }
  }, [user, navigate]); // user 변경 시마다 체크

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const formattedTime = now.toLocaleString("ko-KR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
      setCurrentTime(formattedTime);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkClockInStatus = async () => {
      try {
        const res = await axios.post("/api/work/status", {
          username: user.username,
        });
        setHasClockedIn(res.data.isClockedIn);
      } catch (err) {
        console.error("출근 상태 확인 오류:", err);
      }
    };
    checkClockInStatus();
  }, [user.username]);

  // 출근
  const handleClockIn = async () => {
    try {
      // 1. 사용자 근무시간 정보 가져오기
      const resUser = await axios.get("http://localhost:5000/api/admin/users");
      const currentUser = resUser.data.find(u => u.username === user.username);

      if (!currentUser) {
        alert("사용자 정보를 찾을 수 없습니다.");
        return;
      }

      const { work_start, work_end } = currentUser;
      if (!work_start || !work_end) {
        alert("근무시간 정보가 없습니다. 관리자에게 문의하세요.");
        return;
      }

      // 2. 현재 시간과 비교
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10); // yyyy-mm-dd
      const workStart = new Date(`${dateStr}T${work_start}`);
      const workEnd = new Date(`${dateStr}T${work_end}`);
      const thirtyMinBeforeStart = new Date(workStart.getTime() - 30 * 60 * 1000);

      if (now < thirtyMinBeforeStart || now > workEnd) {
        alert("근무시간이 아닙니다. 관리자에게 문의하세요.");
        return;
      }

      // 3. 정상 출근 처리
      await axios.post("/api/work/clock-in", {
        username: user.username,
      });
      alert(`${user.name}님, 출근 기록 완료!`);
      setHasClockedIn(true); // 출근 완료 상태로 전환
    } catch (err) {
      alert("출근 기록 중 오류!");
      console.error(err);
    }
  };


  // 퇴근
  const handleClockOut = async () => {
    try {
      const res = await axios.post("/api/work/clock-out", {
        username: user.username,
      });
      // ✅ 서버가 퇴근 거부했을 경우
      if (res.data.message === "퇴근 시간이 아닙니다.") {
        alert("퇴근 시간이 아닙니다."); // 사용자에게 알림
        setHasClockedIn(true); // 여전히 근무 중 상태 유지
        return;
      }
      alert(`${user.name}님, 퇴근 기록 완료!`);
      setHasClockedIn(false); // 퇴근 후 상태 초기화
    } catch (err) {
      alert("퇴근 기록 중 오류!");
      console.error(err);
    }
  };

  // 로그아웃 처리
  const handleLogout = () => {
    setUser(null);  // 사용자 상태 초기화
    navigate("/");  // 로그인 화면으로 리다이렉트
  };

 return (
  <div style={{ padding: "20px" }}>
    {/* ✅ 1. 로고만 단독으로 상단에 표시 */}
    <img
      src={require("../assets/mainlogo.png")}
      alt="로고"
      style={{ height: "60px", marginBottom: "15px" }}
    />

    {/* ✅ 2. 환영 인사 + 로그아웃 버튼 한 줄에 나란히 */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: "20px",
        flexWrap: "wrap",
      }}
    >
      <h2 style={{ margin: 0 }}>{user.name}님, 환영합니다!</h2>
      <button onClick={handleLogout} style={{ marginLeft: "12px" }}>로그아웃</button>
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
          <p>현재 날짜/시간: <b>{currentTime}</b></p>
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