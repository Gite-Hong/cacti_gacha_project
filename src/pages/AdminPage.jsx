import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./AdminPage.css";

function AdminPage({ user }) {
  const [users, setUsers] = useState([]); // 회원 목록
  const [editedUsers, setEditedUsers] = useState({}); // 입력 중인 회원 정보 상태
  const [locations, setLocations] = useState([]); // 지점 목록
  const [newLocation, setNewLocation] = useState(""); // 새 지점
  const [showUserEdit, setShowUserEdit] = useState(false); // 회원정보 관리 표시
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("전체"); // 지점 필터 상태

  const navigate = useNavigate();

  const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hour = String(Math.floor(i / 2)).padStart(2, "0");
    const minute = i % 2 === 0 ? "00" : "30";
    return `${hour}:${minute}`;
  });

  useEffect(() => {
    const fetchData = async () => {
      const usersRes = await axios.get("http://localhost:5000/api/admin/users");
      const locationsRes = await axios.get("http://localhost:5000/api/admin/locations");

      const processedUsers = usersRes.data.map((user) => ({
        ...user,
        work_start: user.work_start ? user.work_start.slice(0, 5) : "",
        work_end: user.work_end ? user.work_end.slice(0, 5) : "",
      }));

      setUsers(processedUsers);
      const userMap = {};
      processedUsers.forEach(user => {
        userMap[user.id] = { ...user };
      });
      setEditedUsers(userMap);

      setLocations(locationsRes.data);
    };

    fetchData();
  }, []);

  const addLocation = async () => {
    if (!newLocation) return alert("지점명을 입력하세요.");
    await axios.post("http://localhost:5000/api/admin/locations", { name: newLocation });
    alert("새로운 지점이 추가되었습니다!");
    setNewLocation("");

    const locationRes = await axios.get("http://localhost:5000/api/admin/locations");
    setLocations(locationRes.data);
  };

  const deleteLocation = async (id) => {
    if (!window.confirm("정말로 이 지점을 삭제하시겠습니까?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/admin/locations/${id}`);
      alert("지점이 삭제되었습니다.");
      const res = await axios.get("http://localhost:5000/api/admin/locations");
      setLocations(res.data);
    } catch (error) {
      alert("지점 삭제 중 오류가 발생했습니다.");
      console.error("지점 삭제 오류:", error);
    }
  };

  const handleEdit = async (id) => {
    const updatedUser = editedUsers[id];
    try {
      const updatedData = {
        name: updatedUser.name,
        username: updatedUser.username,
        password: updatedUser.password || null,
        wage: updatedUser.wage,
        location: updatedUser.location,
        role: updatedUser.role || "user",
        work_days: updatedUser.work_days,
        work_start: updatedUser.work_start || null,
        work_end: updatedUser.work_end || null,
      };

      await axios.put(`http://localhost:5000/api/admin/users/${id}`, updatedData);
      alert("회원 정보가 성공적으로 수정되었습니다!");

      const updatedUsersRes = await axios.get("http://localhost:5000/api/admin/users");
      const processedUsers = updatedUsersRes.data.map((user) => ({
        ...user,
        work_start: user.work_start ? user.work_start.slice(0, 5) : "",
        work_end: user.work_end ? user.work_end.slice(0, 5) : "",
      }));

      setUsers(processedUsers);
      const userMap = {};
      processedUsers.forEach(user => {
        userMap[user.id] = { ...user };
      });
      setEditedUsers(userMap);
    } catch (error) {
      alert("회원 수정 중 오류가 발생했습니다.");
      console.error("회원 수정 오류:", error);
    }
  };

  const handleResign = async (id) => {
    if (!window.confirm("정말로 이 회원을 퇴사시키겠습니까?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/admin/users/${id}`);
      alert("회원이 퇴사 처리되었습니다.");
      const updatedUsers = await axios.get("http://localhost:5000/api/admin/users");
      setUsers(updatedUsers.data);
      const userMap = {};
      updatedUsers.data.forEach(user => {
        userMap[user.id] = { ...user };
      });
      setEditedUsers(userMap);
    } catch (error) {
      console.error("회원 퇴사 처리 오류:", error);
      alert("회원 퇴사 처리 중 오류가 발생했습니다.");
    }
  };

  const filteredUsers = users.filter((user) => {
    if (selectedLocation === "전체") return true;
    if (selectedLocation === "신규") return !user.location;
    return user.location === selectedLocation;
  });

  return (
    <div>

      <h3>지점 관리</h3>
      <ul>
        {locations.map((loc) => (
          <li key={loc.id} className="location-item" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {loc.name}
            <button onClick={() => deleteLocation(loc.id)}>삭제</button>
          </li>
        ))}
      </ul>
      <input
        placeholder="새 지점 입력"
        value={newLocation}
        onChange={(e) => setNewLocation(e.target.value)}
      />
      <button onClick={addLocation}>추가</button>

      <h3>회원정보 관리</h3>
      <button onClick={() => setShowUserEdit(!showUserEdit)}>
        {showUserEdit ? "닫기" : "회원정보 관리"}
      </button>

      {showUserEdit && (
        <>
          <div style={{ marginTop: "10px" }}>
            <label>지점 필터: </label>
            <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
              <option value="전체">전체</option>
              <option value="신규">신규</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.name}>{loc.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: "10px" }}>
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                style={{ border: "1px solid gray", padding: "10px", marginBottom: "10px" }}
              >
                <input
                  value={editedUsers[u.id]?.name || ""}
                  placeholder="이름"
                  onChange={(e) =>
                    setEditedUsers((prev) => ({
                      ...prev,
                      [u.id]: { ...prev[u.id], name: e.target.value },
                    }))
                  }
                />
                <input
                  value={editedUsers[u.id]?.username || ""}
                  placeholder="아이디"
                  onChange={(e) =>
                    setEditedUsers((prev) => ({
                      ...prev,
                      [u.id]: { ...prev[u.id], username: e.target.value },
                    }))
                  }
                />
                <input
                  value={editedUsers[u.id]?.password || ""}
                  placeholder="비밀번호 저장/수정"
                  onChange={(e) =>
                    setEditedUsers((prev) => ({
                      ...prev,
                      [u.id]: { ...prev[u.id], password: e.target.value },
                    }))
                  }
                />
                <input
                  type="number"
                  value={editedUsers[u.id]?.wage || ""}
                  placeholder="시급 입력"
                  onChange={(e) =>
                    setEditedUsers((prev) => ({
                      ...prev,
                      [u.id]: { ...prev[u.id], wage: parseInt(e.target.value) || null },
                    }))
                  }
                />
                <select
                  value={editedUsers[u.id]?.location || ""}
                  onChange={(e) =>
                    setEditedUsers((prev) => ({
                      ...prev,
                      [u.id]: { ...prev[u.id], location: e.target.value },
                    }))
                  }
                >
                  <option value="">지점 선택</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>

                <div className="weekdays-container">
                  <span>근무 요일: </span>
                  {weekdays.map((day) => (
                    <label key={day}>
                      <input
                        type="checkbox"
                        checked={editedUsers[u.id]?.work_days?.includes(day) || false}
                        onChange={(e) => {
                          const current = editedUsers[u.id]?.work_days || [];
                          const newDays = e.target.checked
                            ? [...current, day]
                            : current.filter((d) => d !== day);
                          setEditedUsers((prev) => ({
                            ...prev,
                            [u.id]: { ...prev[u.id], work_days: newDays },
                          }));
                        }}
                      />
                      {day}
                    </label>
                  ))}
                </div>

                <div>
                  <span>근무 시간: </span>
                  <select
                    className="time-select"
                    value={editedUsers[u.id]?.work_start || ""}
                    onChange={(e) =>
                      setEditedUsers((prev) => ({
                        ...prev,
                        [u.id]: { ...prev[u.id], work_start: e.target.value },
                      }))
                    }
                  >
                    <option value="">시작 시간</option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>

                  <span> ~ </span>

                  <select
                    className="time-select"
                    value={editedUsers[u.id]?.work_end || ""}
                    onChange={(e) =>
                      setEditedUsers((prev) => ({
                        ...prev,
                        [u.id]: { ...prev[u.id], work_end: e.target.value },
                      }))
                    }
                  >
                    <option value="">종료 시간</option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <button onClick={() => handleEdit(u.id)}>수정</button>
                <button
                  onClick={() => handleResign(u.id)}
                  style={{ marginLeft: "10px", color: "red" }}
                >
                  퇴사
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h3>근무 확인</h3>
      <button onClick={() => navigate("/work-check")}>근무 확인 페이지로 이동</button>
    </div>
  );
}

export default AdminPage;
