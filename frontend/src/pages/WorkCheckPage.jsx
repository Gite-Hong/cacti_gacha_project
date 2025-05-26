// WorkCheckPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "./WorkCheckPage.css";

function WorkCheckPage() {
    const remarksDescriptions = [
        { symbol: "00", description: "출근 정상 + 퇴근 정상" },
        { symbol: "00⚠️", description: "출근 정상 + 계약 시간보다 30분 이상 더 근무" },
        { symbol: "0", description: "출근 지각 + 지각한 만큼 더 근무" },
        { symbol: "0⚠️", description: "출근 지각 + 지각한 만큼 더 근무 + 계약 시간보다 30분 이상 더 근무" },
        { symbol: "△", description: "계약 시간보다 5분 이내로 일찍 조기퇴근" },
        { symbol: "※", description: "5분보다 훨씬 조기 퇴근" },
        { symbol: "결석", description: "계약 요일 + 계약 시간에 출근하지 않은 경우" },
        { symbol: "퇴근 버튼 누락", description: "출근은 찍었지만, 퇴근 버튼을 찍지 않은 경우 → 자동 종료 시간으로 엑셀 반영" },
      ];
  const navigate = useNavigate();
  const { username } = useParams();

  const getWeekday = (dateString) => {
      const day = new Date(dateString).getDay();
      return "일월화수목금토".charAt(day);
    };

  const [locations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [workSummary, setWorkSummary] = useState([]);
  const [timeEdits, setTimeEdits] = useState({});

  useEffect(() => {
    if (username) setSelectedEmployee(username);
  }, [username]);

  // ✅ 1. useCallback으로 fetch 함수 감싸기
  const fetchWorkSummary = useCallback(async () => {
    if (!selectedEmployee) return;

    try {
      const res = await axios.get("http://localhost:5000/api/admin/work-summary", {
        params: {
          username: selectedEmployee,
          year: selectedYear,
          month: selectedMonth,
        },
      });

      const newTimeEdits = {};
      res.data.forEach((record) => {
        const dateStr = new Date(record.clock_in).toISOString().slice(0, 10);
        const clockInTime = new Date(record.clock_in).toTimeString().slice(0, 5);

        let clockOutTime = "";
        if (
          record.clock_out &&
          record.clock_out !== "0000-00-00 00:00:00" &&
          record.memo !== "결석"
        ) {
          const clockOutDate = new Date(record.clock_out);
          if (!isNaN(clockOutDate)) {
            clockOutTime = clockOutDate.toTimeString().slice(0, 5);
          }
        }

        newTimeEdits[dateStr] = {
          date: dateStr,
          clockIn: clockInTime,
          clockOut: clockOutTime,
          totalHours: record.total_hours,
        };
      });

      setWorkSummary(res.data);
      setTimeEdits(newTimeEdits);
    } catch (err) {
      console.error("근무 요약 불러오기 오류:", err);
    }
  }, [selectedEmployee, selectedYear, selectedMonth]);

  // ✅ 2. 자동 새로고침 유지 (의존성에 fetchWorkSummary만)
  useEffect(() => {
    fetchWorkSummary();
  }, [fetchWorkSummary]);

  const handleTimeChange = (dateStr, field, value) => {
    setTimeEdits((prev) => ({
      ...prev,
      [dateStr]: { ...prev[dateStr], [field]: value },
    }));
  };

  const handleAddRow = () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);

    setWorkSummary((prev) => [
      ...prev,
      {
        id: null,
        username: selectedEmployee,
        clock_in: `${dateStr}T00:00:00`,
        clock_out: null,
        total_hours: 0,
        memo: "",
        wage: workSummary[0]?.wage || 0,
        name: workSummary[0]?.name || "",
        location: workSummary[0]?.location || "",
        isNew: true,
      },
    ]);

    setTimeEdits((prev) => ({
      ...prev,
      [dateStr]: {
        date: dateStr,
        clockIn: "00:00",
        clockOut: "",
        totalHours: 0,
      },
    }));
  };

  const handleDeleteRow = async (record) => {
  if (!window.confirm("정말 삭제하시겠습니까?")) return;

  try {
    // 🕒 ISO → MySQL 형식 (UTC → KST 변환 포함)
    const toMySQLDatetime = (isoString) => {
    const date = new Date(isoString); // 브라우저 기준(KST)로 이미 처리됨

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mi = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  };

    await axios.post("http://localhost:5000/api/admin/delete-work", {
      username: record.username,
      clock_in: toMySQLDatetime(record.clock_in),
    });

    setWorkSummary((prev) => prev.filter((r) => r !== record));
  } catch (err) {
    console.error("삭제 오류:", err);
    alert("삭제 중 오류 발생");
  }
};


  const hourOptions = Array.from({ length: 21 }, (_, i) => i * 0.5);

  // ✅ 총 급여 계산
  const totalPaySum = workSummary.reduce((sum, row) => {
    const dateStr = new Date(row.clock_in).toISOString().slice(0, 10);
    const totalHours = timeEdits[dateStr]?.totalHours ?? row.total_hours;
    return sum + (row.wage * totalHours);
  }, 0);
  // ✅ 총 근무 시간 계산
  const totalWorkedHours = workSummary.reduce((sum, row) => {
    const dateKey = new Date(row.clock_in).toISOString().slice(0, 10);
    const rawHours = timeEdits[dateKey]?.totalHours ?? row.total_hours;

    const hours = Number(rawHours);
    if (!isNaN(hours) && hours > 0) {
      return sum + hours;
    }
    return sum;
  }, 0);


  // ✅ 이 아래에 handleExcelExport 함수 붙이기!
  const handleExcelExport = async () => {
  if (!workSummary.length) return;

  const name = workSummary[0].name;
  const location = workSummary[0].location;
  const wage = workSummary[0].wage;

  const titleLeft = `${name} (${location}) ${selectedYear}년 ${selectedMonth}월 근무표`;
  const titleRight = `시급: ${wage.toLocaleString()}원`;
  const space = " ".repeat(30); // ← 이 숫자로 간격 조절 가능
  const title = `${titleLeft}${space}${titleRight}`;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("근무표");

  // ✅ 제목 (1행)
  worksheet.mergeCells("A1:G1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = { size: 14, bold: true };
  titleCell.alignment = {
    horizontal: "left",
    vertical: "middle",
    wrapText: true,
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFEB9C" },
  };
  worksheet.getRow(1).height = 25;

  // ✅ 열 너비 설정
  worksheet.columns = [
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 20 },
  ];

  // ✅ 헤더 (2행)
  const headers = ["일자", "요일", "출근시간", "퇴근시간", "근무시간", "시급", "비고"];
  worksheet.getRow(2).values = headers;
  const headerRow = worksheet.getRow(2);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center" };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9D9D9" },
    };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // ✅ 본문 데이터 (3행부터 시작)
  let currentRow = 3;
  workSummary.forEach((record) => {
    const date = new Date(record.clock_in);
    const dateStr = `${date.getDate()}일`;
    const weekday = "일월화수목금토".charAt(date.getDay());
    const dateKey = date.toISOString().slice(0, 10);
    const clockIn = timeEdits[dateKey]?.clockIn || new Date(record.clock_in).toTimeString().slice(0, 5);
    const clockOut = timeEdits[dateKey]?.clockOut || (record.clock_out ? new Date(record.clock_out).toTimeString().slice(0, 5) : "");
    const rawHours = timeEdits[dateKey]?.totalHours ?? record.total_hours;
    const totalHours = Number(rawHours);
    const hoursFormatted = isNaN(totalHours) ? "-" : `${totalHours.toFixed(1)}시간`;
    const wageFormatted = `${record.wage.toLocaleString()}원`;
    const memo = record.memo || "";

    worksheet.getRow(currentRow).values = [dateStr, weekday, clockIn, clockOut, hoursFormatted, wageFormatted, memo];
    currentRow++;
  });

  // ✅ 빈 줄 + 총 급여 + 총 근무 시간
  worksheet.getRow(currentRow++); // 빈 줄

  const totalPay = workSummary.reduce((sum, row) => {
    const dateKey = new Date(row.clock_in).toISOString().slice(0, 10);
    const hours = timeEdits[dateKey]?.totalHours ?? row.total_hours;
    return sum + row.wage * hours;
  }, 0);

  const totalHours = workSummary.reduce((sum, row) => {
    const dateKey = new Date(row.clock_in).toISOString().slice(0, 10);
    const hours = Number(timeEdits[dateKey]?.totalHours ?? row.total_hours);
    return !isNaN(hours) && hours > 0 ? sum + hours : sum;
  }, 0);

  

    // ✅ 총 근무시간 행 (A~B 병합)
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  const totalHourRow = worksheet.getRow(currentRow++);
  totalHourRow.getCell(1).value = `총 근무시간: ${totalHours.toFixed(1)}시간`;
  totalHourRow.font = { bold: true };
  totalHourRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF2CC" }, // 연노랑
  };

  // ✅ 총 급여 행 (A~B 병합)
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  const totalRow = worksheet.getRow(currentRow++);
  totalRow.getCell(1).value = `총 급여: ${totalPay.toLocaleString()}원`;
  totalRow.font = { bold: true };
  totalRow.getCell(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF2CC" },
  };

  // ✅ 다운로드
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `(${location})${name}${selectedMonth}월.xlsx`);
};



  
  return (
    <div className="work-check-page">
      <h2>📋 근무 확인 페이지</h2>
      <button onClick={() => navigate("/main")}>← 돌아가기</button>
      <div className="remarks-container">
        <h2>비고 표시 설명</h2>
        <ul>
          {remarksDescriptions.map((item, index) => (
            <li key={index}>
              <strong>{item.symbol}</strong>: {item.description}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: "20px" }}>
        <label>지점 선택: </label>
        <select
          value={selectedLocation}
          onChange={async (e) => {
            const loc = e.target.value;
            setSelectedLocation(loc);
            if (loc) {
              const res = await axios.get(
                `http://localhost:5000/api/admin/users/by-location/${loc}`
              );
              setEmployees(res.data);
              setSelectedEmployee(null);
            } else setEmployees([]);
          }}
        >
          <option value="">지점 선택</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.name}>
              {loc.name}
            </option>
          ))}
        </select>

        {employees.length > 0 && (
          <ul className="employee-list">
            {employees.map((emp, index) => (
              <li key={index}>
                <button onClick={() => navigate(`/work-check/${emp.username}`)}>
                  {emp.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
        {/* 연도 & 월 선택 */}
        <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <label>연도: </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {Array.from({ length: 6 }, (_, i) => 2020 + i).map((year) => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>

          <label>월: </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
          >
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

          <button onClick={handleAddRow} style={{ marginBottom: "10px" }}>+ 새 행 추가</button>
          <button onClick={handleExcelExport} style={{ marginBottom: "10px" }}>📥 엑셀 다운로드</button>

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
                const dateStr = inDate.toISOString().slice(0, 10);

                const edit = timeEdits[dateStr] || {};
                const clockIn = edit.clockIn || "";
                const clockOut = edit.clockOut || "";
                const totalHours = edit.totalHours ?? record.total_hours;
                const pay = Math.round(record.wage * totalHours);
                const memo = record.memo || "";
                const selectedDate = edit.date || dateStr;

                const handleUpdate = async () => {
                  try {
                    if (record.isNew) {
                      await axios.post("http://localhost:5000/api/admin/insert-work", {
                        username: record.username,
                        clock_in: `${selectedDate} ${clockIn}:00`,
                        clock_out: `${selectedDate} ${clockOut}:00`,
                        total_hours: totalHours,
                        memo: "직접 입력 완료",
                      });
                    } else {
                      await axios.put("http://localhost:5000/api/admin/update-work", {
                        username: record.username,
                        date: dateStr,
                        clock_in: `${dateStr} ${clockIn}:00`,
                        clock_out: `${dateStr} ${clockOut}:00`,
                        memo: "수정 완료",
                        total_hours: totalHours,
                      });
                    }
                    await fetchWorkSummary();
                    alert("저장 완료!");
                  } catch (err) {
                    console.error("저장 실패:", err);
                    alert("저장 중 오류 발생");
                  }
                };

                return (
                  <tr key={index}>
                    <td>
                      {record.isNew ? (
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => handleTimeChange(dateStr, "date", e.target.value)}
                        />
                      ) : (
                        `${inDate.getDate()}일`
                      )}
                    </td>
                    <td>
                      {record.isNew
                        ? getWeekday(selectedDate)
                        : "일월화수목금토".charAt(inDate.getDay())}
                    </td>
                    <td>
                      <input
                        type="time"
                        value={clockIn}
                        onChange={(e) => handleTimeChange(dateStr, "clockIn", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={clockOut}
                        onChange={(e) => handleTimeChange(dateStr, "clockOut", e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        value={Number(totalHours).toFixed(1)}
                        onChange={(e) => handleTimeChange(dateStr, "totalHours", parseFloat(e.target.value))}
                      >
                        {hourOptions.map((h) => (
                          <option key={h} value={h.toFixed(1)}>
                            {h.toFixed(1)}시간
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{pay.toLocaleString()}원</td>
                    <td>
                      <input value={memo} readOnly />
                      <button onClick={handleUpdate} style={{ marginLeft: "5px" }}>
                        수정
                      </button>
                      <button onClick={() => handleDeleteRow(record)} style={{ marginLeft: "5px" }}>
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                <td colSpan="4" style={{ textAlign: "right" }}>총 근무시간</td>
                <td>{totalWorkedHours.toFixed(1)}시간</td>
                <td colSpan="2"></td>
              </tr>
              <tr style={{ fontWeight: "bold", backgroundColor: "#f0f0f0" }}>
                <td colSpan="5" style={{ textAlign: "right" }}>총 급여</td>
                <td>{totalPaySum.toLocaleString()}원</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export default WorkCheckPage;