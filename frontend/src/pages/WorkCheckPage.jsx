// ✅ WorkCheckPage.jsx (불필요한 보정 제거, 간결한 버전)
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import "./WorkCheckPage.css";

const API_URL = process.env.REACT_APP_BACKEND_URL;

function WorkCheckPage() {
  const navigate = useNavigate();
  const { username } = useParams();

  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [workSummary, setWorkSummary] = useState([]);

  const [editModeIndex, setEditModeIndex] = useState(null);
  const [editedRow, setEditedRow] = useState({});


  useEffect(() => {
    if (username) setSelectedEmployee(username);
  }, [username]);

  useEffect(() => {
    const fetchLocations = async () => {
      const res = await axios.get(`${API_URL}/api/admin/locations`);
      setLocations(res.data);
    };
    fetchLocations();
  }, []);

  const fetchWorkSummary = useCallback(async () => {
    if (!selectedEmployee) return;
    const res = await axios.get(`${API_URL}/api/admin/work-summary`, {
      params: { username: selectedEmployee, year: selectedYear, month: selectedMonth },
    });
    setWorkSummary(res.data);
  }, [selectedEmployee, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchWorkSummary();
  }, [fetchWorkSummary]);

  const getWeekday = (dateStr) => {
    return "일월화수목금토".charAt(new Date(dateStr).getDay());
  };

  const handleSave = async (index, record, dateStr) => {
    const updated = {
      username: record.username,
      date: dateStr,
      clock_in: `${dateStr} ${editedRow.clock_in}`,
      clock_out: editedRow.clock_out ? `${dateStr} ${editedRow.clock_out}` : null,
      total_hours: editedRow.total_hours,
      memo: editedRow.memo,
    };

    try {
      await axios.put(`${API_URL}/api/admin/update-work`, updated);
      alert("수정 완료!");
      setEditModeIndex(null);
      fetchWorkSummary();
    } catch (err) {
      console.error(err);
      alert("수정 실패");
    }
  };

  const handleDelete = async (username, clock_in) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
    try {
      await axios.post(`${API_URL}/api/admin/delete-work`, {
        username,
        clock_in,
      });
      alert("삭제 완료");
      fetchWorkSummary();
    } catch (err) {
      console.error(err);
      alert("삭제 실패");
    }
  };

  return (
    <div className="work-check-page">
      <h2>📋 근무 확인 페이지</h2>
      <button onClick={() => navigate("/main")}>← 돌아가기</button>

      {/* <div className="remarks-container">
        <h2>비고 표시 설명</h2>
        <ul>
          {[
            ["00", "출근 정상 + 퇴근 정상"],
            ["00⚠️", "출근 정상 + 계약 시간보다 30분 이상 더 근무"],
            ["0", "출근 지각 + 지각한 만큼 더 근무"],
            ["0⚠️", "출근 지각 + 지각한 만큼 더 근무 + 30분 이상 초과"],
            ["△", "5분 이내 조기퇴근"],
            ["※", "5분 이상 조기퇴근"],
            ["결석", "계약 요일 출근 없음"],
            ["퇴근 버튼 누락", "출근 후 퇴근 안 누른 경우"]
          ].map(([symbol, desc]) => (
            <li key={symbol}><strong>{symbol}</strong>: {desc}</li>
          ))}
        </ul>
      </div> */}

      <div style={{ marginTop: "20px" }}>
        <label>지점 선택: </label>
        <select
          value={selectedLocation}
          onChange={async (e) => {
            const loc = e.target.value;
            setSelectedLocation(loc);
            if (loc) {
              const res = await axios.get(`${API_URL}/api/admin/users/by-location/${loc}`);
              setEmployees(res.data);
              setSelectedEmployee(null);
            } else setEmployees([]);
          }}>
          <option value="">지점 선택</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.name}>{loc.name}</option>
          ))}
        </select>

        {employees.length > 0 && (
          <ul className="employee-list">
            {employees.map((emp) => (
              <li key={emp.username}>
                <button onClick={() => navigate(`/work-check/${emp.username}`)}>{emp.name}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
        <label>연도: </label>
        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
          {Array.from({ length: 6 }, (_, i) => 2020 + i).map((year) => (
            <option key={year} value={year}>{year}년</option>
          ))}
        </select>

        <label>월: </label>
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
            <option key={month} value={month}>{month}월</option>
          ))}
        </select>
      </div>

      {selectedEmployee && workSummary.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h3>
            {workSummary[0].name} ({workSummary[0].location}) – {selectedYear}년 {selectedMonth}월 근무표 – 시급: {workSummary[0].wage.toLocaleString()}원
          </h3>

          <table className="work-table">
            <thead>
              <tr>
                <th>일자</th>
                <th>요일</th>
                <th>출근</th>
                <th>퇴근</th>
                <th>근무시간</th>
                <th>급여</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {workSummary.map((record, index) => {
                const inDate = new Date(record.clock_in);
                const outDate = record.clock_out ? new Date(record.clock_out) : null;
                const day = inDate.getDate();
                const weekday = getWeekday(inDate);
                const inTime = inDate.toTimeString().slice(0, 5);
                const outTime = outDate ? outDate.toTimeString().slice(0, 5) : "";
                const totalHours = Number(record.total_hours);
                const wage = record.wage;
                const pay = Math.round(totalHours * wage);
                const memo = record.memo || "";

                const dateStr = inDate.toISOString().slice(0, 10); // YYYY-MM-DD

                const isEditing = editModeIndex === index;

                return (
                  <tr key={index}>
                    <td>{day}일</td>
                    <td>{weekday}</td>

                    {isEditing ? (
                      <>
                        <td>
                          <input
                            type="time"
                            value={editedRow.clock_in || inTime}
                            onChange={(e) =>
                              setEditedRow((prev) => ({ ...prev, clock_in: e.target.value }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            value={editedRow.clock_out || outTime}
                            onChange={(e) =>
                              setEditedRow((prev) => ({ ...prev, clock_out: e.target.value }))
                            }
                          />
                        </td>
                        <td>
                          <select
                            value={editedRow.total_hours != null ? editedRow.total_hours : totalHours}
                            onChange={(e) =>
                              setEditedRow((prev) => ({
                                ...prev,
                                total_hours: parseFloat(e.target.value),
                              }))
                            }
                          >
                            {Array.from({ length: 17 }, (_, i) => (i * 0.5).toFixed(1)).map((val) => (
                              <option key={val} value={val}>{val}시간</option>
                            ))}
                          </select>

                        </td>
                        <td>
                          {(
                            Math.round(
                              (editedRow.total_hours != null ? editedRow.total_hours : totalHours) * wage
                            )
                          ).toLocaleString()}원
                        </td>
                        <td>
                          <input
                            value={editedRow.memo || memo}
                            onChange={(e) =>
                              setEditedRow((prev) => ({ ...prev, memo: e.target.value }))
                            }
                          />
                        </td>
                        <td>
                          <button onClick={() => handleSave(index, record, dateStr)}>저장</button>
                          <button onClick={() => setEditModeIndex(null)}>취소</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{inTime}</td>
                        <td>{outTime}</td>
                        <td>{totalHours.toFixed(1)}시간</td>
                        <td>{pay.toLocaleString()}원</td>
                        <td>{memo}</td>
                        <td>
                          <button onClick={() => {
                            setEditModeIndex(index);
                            setEditedRow({
                              clock_in: inTime,
                              clock_out: outTime,
                              total_hours: totalHours,
                              memo,
                            });
                          }}>
                            수정
                          </button>
                          <button onClick={() => handleDelete(record.username, record.clock_in)}>삭제</button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>

          </table>
        </div>
      )}
    </div>
  );
}

export default WorkCheckPage;