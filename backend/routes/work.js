const express = require("express");
const db = require("../db/connection");
const router = express.Router();

// ✅ 출근 API (KST 시간 그대로 저장)
router.post("/clock-in", async (req, res) => {
  const { username } = req.body;

  try {
    const now = new Date(); // KST 기준 그대로 사용
     const nowKST = new Date(now.getTime() + 9 * 60 * 60 * 1000); // 한국 시간으로 보정
    

    // ✅ 요일 추출
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const todayKorean = dayNames[nowKST.getDay()]; // ex) "금"

    // ✅ 사용자 정보 조회 (근무 요일 포함)
    const [rows] = await db.promise().query(
      "SELECT work_days FROM users WHERE username = ?",
      [username]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    const { work_days } = rows[0];

    // ✅ 근무 요일 체크
    if (!work_days.includes(todayKorean)) {
      return res.status(200).json({ message: "근무 요일이 아닙니다." });
    }

     console.log("🕒 [출근] 현재 KST 시간:", nowKST.toISOString());

     const yyyyMMdd = now.toISOString().slice(0, 10);
    // '결석' 기록 삭제
    await db.promise().query(
      "DELETE FROM work_records WHERE username = ? AND DATE(clock_in) = ? AND memo = '결석'",
      [username, yyyyMMdd]
    );

    // 출근 기록 저장
    await db.promise().query(
      "INSERT INTO work_records (username, clock_in) VALUES (?, ?)",
      [username, now]
    );

    console.log("🕐 출근 시간 (DB 저장용):", now.toISOString());

    res.status(201).json({ message: "출근 기록이 추가되었습니다." });
  } catch (err) {
    console.error("출근 기록 중 에러:", err);
    res.status(500).json({ error: "SERVER_ERROR", message: "출근 처리 중 오류 발생" });
  }
});

// ✅ 퇴근 API (보정된 시간 기반 total_hours 계산)
  router.post("/clock-out", async (req, res) => {
    const { username } = req.body;

    try {
      const [userRows] = await db.promise().query(
        "SELECT work_start, work_end FROM users WHERE username = ?",
        [username]
      );
      if (userRows.length === 0) {
        return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
      }

      const { work_start, work_end } = userRows[0];

      const [clockInRows] = await db.promise().query(
        "SELECT id, clock_in FROM work_records WHERE username = ? AND clock_out IS NULL AND memo IS NULL ORDER BY clock_in DESC LIMIT 1",
        [username]
      );
      if (clockInRows.length === 0) {
        return res.status(404).json({ message: "출근 기록을 찾을 수 없습니다." });
      }

      const { id, clock_in } = clockInRows[0];

      const clockInTime = new Date(clock_in);       // UTC
      const outTime = new Date();                   // UTC (현재 시간)

      // ✅ 한국 시간 (KST) 보정
      const correctedInTime = new Date(clockInTime.getTime() + 9 * 60 * 60 * 1000);
      const correctedOutTime = new Date(outTime.getTime() + 9 * 60 * 60 * 1000);

      // ✅ 출근 후 60분 이내 퇴근 제한/////////////
      // const diffMinutes = (correctedOutTime - correctedInTime) / (1000 * 60);
      // if (diffMinutes < 60) {
      //   return res.status(200).json({ message: "퇴근 시간이 아닙니다." });
      // }

      const dateStr = correctedInTime.toISOString().slice(0, 10);
      let contractStart = new Date(`${dateStr}T${work_start}`);
      let contractEnd = new Date(`${dateStr}T${work_end}`);
      contractStart = new Date(contractStart.getTime() + 9 * 60 * 60 * 1000);
      contractEnd = new Date(contractEnd.getTime() + 9 * 60 * 60 * 1000);

      const contractHours = (contractEnd - contractStart) / (1000 * 60 * 60);

      const fiveMin = 5 * 60 * 1000;
      const thirtyMin = 30 * 60 * 1000;
      const adjustedContractEnd = correctedInTime.getTime() + contractHours * 3600 * 1000;
      let totalHours = 0;
      let memoValue = "";

      // ✅ 디버깅 로그
      console.log("🕐 출근 시간 (KST):", correctedInTime.toISOString());
      console.log("🕐 퇴근 시간 (KST):", correctedOutTime.toISOString());
      console.log("📅 계약 시작:", contractStart.toISOString());
      console.log("📅 계약 종료:", contractEnd.toISOString());
      console.log("⏳ 계약 시간:", contractHours);

      if (
        correctedInTime <= contractStart &&
        correctedOutTime >= contractEnd &&
        correctedOutTime < new Date(contractEnd.getTime() + thirtyMin)
      ) {
        totalHours = contractHours;
        memoValue = "00";
      } else if (
        correctedInTime <= contractStart &&
        correctedOutTime >= new Date(contractEnd.getTime() + thirtyMin)
      ) {
        totalHours = contractHours;
        memoValue = "00⚠️";
      } else if (
        correctedInTime > contractStart &&
        correctedOutTime >= new Date(correctedInTime.getTime() + contractHours * 3600 * 1000 + thirtyMin)
      ) {
        totalHours = contractHours;
        memoValue = "0⚠️";
      } else if (
        correctedInTime > contractStart &&
        correctedOutTime >= new Date(correctedInTime.getTime() + contractHours * 3600 * 1000)
      ) {
        totalHours = contractHours;
        memoValue = "0";
      } else if (
        correctedInTime <= contractStart &&
        correctedOutTime >= new Date(contractEnd.getTime() - fiveMin) &&
        correctedOutTime < contractEnd
      ) {
        totalHours = contractHours;
        memoValue = "△";
      } else if (
        correctedInTime > contractStart &&
        correctedOutTime >= adjustedContractEnd - fiveMin &&
        correctedOutTime < adjustedContractEnd
      ) {
        totalHours = contractHours;
        memoValue = "△";
      } else {
        // ✅ 지각했으면 출근 시간부터, 아니면 계약 시작부터 계산
        const baseTime = correctedInTime > contractStart ? correctedInTime : contractStart;
        const realWorkedMs = correctedOutTime - baseTime;
        const realWorked = realWorkedMs / (1000 * 60 * 60); // 시간 단위

        const decimal = realWorked - Math.floor(realWorked);

        console.log("🧮 baseTime:", baseTime.toISOString());
        console.log("🧮 근무 시간 (raw):", realWorked);

        if (decimal <= 0.25) totalHours = Math.floor(realWorked);
        else if (decimal <= 0.75) totalHours = Math.floor(realWorked) + 0.5;
        else totalHours = Math.ceil(realWorked);

        memoValue = "※";
      }

      totalHours = Number(totalHours.toFixed(2));

      // ⬇️ DB에는 UTC 그대로 저장
      await db.promise().query(
        "UPDATE work_records SET clock_out = ?, total_hours = ?, memo = ? WHERE id = ?",
        [outTime, totalHours, memoValue, id]
      );

      res.status(200).json({ message: "퇴근 기록이 업데이트되었습니다." });
    } catch (err) {
      console.error("퇴근 처리 중 에러:", err);
      res.status(500).json({ error: "SERVER_ERROR", message: "퇴근 처리 중 오류가 발생했습니다." });
    }
  });


// ✅ 출근 상태 확인 (KST 기준 날짜 사용)
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