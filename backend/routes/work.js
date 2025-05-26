const express = require("express");
const db = require("../db/connection");
const router = express.Router();

// 출근 API
router.post("/clock-in", async (req, res) => {
  const { username } = req.body;

  try {
    const now = new Date();
    const yyyyMMdd = now.toISOString().slice(0, 10);

    // ✅ 같은 날짜의 결석 기록 삭제
    await db.promise().query(
      "DELETE FROM work_records WHERE username = ? AND DATE(clock_in) = ? AND memo = '결석'",
      [username, yyyyMMdd]
    );

    // ✅ 출근 기록 삽입
    await db.promise().query(
      "INSERT INTO work_records (username, clock_in) VALUES (?, NOW())",
      [username]
    );

    res.status(201).json({ message: "출근 기록이 추가되었습니다." });
  } catch (err) {
    console.error("출근 기록 중 에러:", err);
    res.status(500).json({ error: "SERVER_ERROR", message: "출근 처리 중 오류 발생" });
  }
});

// 퇴근 API
router.post("/clock-out", async (req, res) => {
  const { username } = req.body;

  try {
    // 사용자 계약 시간 조회
    const [userRows] = await db.promise().query(
      "SELECT work_start, work_end FROM users WHERE username = ?",
      [username]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    const { work_start, work_end } = userRows[0];

    // 출근 기록 조회
    const [clockInRows] = await db.promise().query(
      "SELECT id, clock_in FROM work_records WHERE username = ? AND clock_out IS NULL AND memo IS NULL ORDER BY clock_in DESC LIMIT 1",
      [username]
    );
    if (clockInRows.length === 0) {
      return res.status(404).json({ message: "출근 기록을 찾을 수 없습니다." });
    }

    const { id, clock_in } = clockInRows[0];
    const now = new Date();
    const clockInTime = new Date(clock_in);

    // 출근 후 60분 이내 퇴근 제한
    const diffMinutes = (now - clockInTime) / (1000 * 60);
    if (diffMinutes < 60) {
      return res.status(200).json({ message: "퇴근 시간이 아닙니다." });
    }

    // 계약 시간 기반 계산
    const dateStr = clockInTime.toISOString().slice(0, 10);
    const contractStart = new Date(`${dateStr}T${work_start}`);
    const contractEnd = new Date(`${dateStr}T${work_end}`);
    const contractHours = (contractEnd - contractStart) / 1000 / 60 / 60;

    let totalHours = 0;
    let memoValue = "";

    const inTime = clockInTime;
    const outTime = now;

    const fiveMin = 5 * 60 * 1000;
    const thirtyMin = 30 * 60 * 1000;

    if (
      inTime <= contractStart &&
      outTime >= contractEnd &&
      outTime < new Date(contractEnd.getTime() + thirtyMin)
    ) {
      totalHours = contractHours;
      memoValue = "00";
    } else if (
      inTime <= contractStart &&
      outTime >= new Date(contractEnd.getTime() + thirtyMin)
    ) {
      totalHours = contractHours;
      memoValue = "00⚠️";
    } else if (
      inTime > contractStart &&
      outTime >= new Date(inTime.getTime() + contractHours * 3600 * 1000 + thirtyMin)
    ) {
      totalHours = contractHours;
      memoValue = "0⚠️"; 
    } else if (
      inTime > contractStart &&
      outTime >= new Date(inTime.getTime() + contractHours * 3600 * 1000)
    ) {
      totalHours = contractHours;
      memoValue = "0";
    } else if (
      inTime <= contractStart &&
      outTime >= new Date(contractEnd.getTime() - fiveMin) &&
      outTime < contractEnd
    ) {
      totalHours = contractHours;
      memoValue = "△";
    } else if (
      inTime > contractStart &&
      outTime >= new Date(contractStart.getTime() + (contractStart - inTime) + contractHours * 3600 * 1000 - fiveMin) &&
      outTime < new Date(inTime.getTime() + contractHours * 3600 * 1000)
    ) {
      totalHours = contractHours;
      memoValue = "△";
    } else {
      // 당구장 계산식
      const realWorked = (outTime - (inTime > contractStart ? inTime : contractStart)) / (1000 * 60 * 60);
      const decimal = realWorked - Math.floor(realWorked);
      if (decimal <= 0.25) totalHours = Math.floor(realWorked);
      else if (decimal <= 0.75) totalHours = Math.floor(realWorked) + 0.5;
      else totalHours = Math.ceil(realWorked);
      memoValue = "※";
    }


    totalHours = Number(totalHours.toFixed(2));

    await db.promise().query(
      "UPDATE work_records SET clock_out = ?, total_hours = ?, memo = ? WHERE id = ?",
      [now, totalHours, memoValue, id]
    );

    res.status(200).json({ message: "퇴근 기록이 업데이트되었습니다." });
  } catch (err) {
    console.error("퇴근 처리 중 에러:", err);
    res.status(500).json({ error: "SERVER_ERROR", message: "퇴근 처리 중 오류가 발생했습니다." });
  }
});

// 출근 상태 확인
router.post("/status", (req, res) => {
  const { username } = req.body;

  const today = new Date().toISOString().slice(0, 10);

  const query = `
    SELECT * FROM work_records 
    WHERE username = ? AND clock_out IS NULL AND DATE(clock_in) = ?
    ORDER BY clock_in DESC LIMIT 1
  `;

  db.query(query, [username, today], (err, results) => {
    if (err) {
      console.error("출근 상태 확인 중 에러:", err);
      return res.status(500).json({ error: "SERVER_ERROR", message: "서버 오류가 발생했습니다." });
    }

    const isClockedIn = results.length > 0;
    res.json({ isClockedIn });
  });
});

module.exports = router;
