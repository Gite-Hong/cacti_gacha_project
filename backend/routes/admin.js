// ✅ 전체 admin.js 통합 수정법
const express = require("express");
const db = require("../db/connection");
const router = express.Router();
const bcrypt = require("bcrypt");

// 1. 회원 정보 가져오기
router.get("/users", (req, res) => {
  const query = `
    SELECT id, name, username, password, wage, location, work_days, work_start, work_end
    FROM users
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error("회원 목록 불러오기 오류:", err);
      return res.status(500).json({ message: "회원 목록을 불러올 수 없습니다." });
    }

    const users = results.map(user => ({
      ...user,
      work_days: user.work_days ? user.work_days.split(",") : [],
    }));

    res.status(200).json(users);
  });
});

// 2. 회원 정보 수정
router.put("/users/:id", async (req, res) => {
  const { id } = req.params;
  const {
    name,
    username,
    password,
    role,
    wage,
    location,
    work_start,
    work_end,
    work_days
  } = req.body;

  try {
    let hashedPassword = null;
    if (password && password.length < 50) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const query = `
      UPDATE users
      SET
        name = ?,
        username = ?,
        password = COALESCE(?, password),
        role = ?,
        wage = ?,
        location = ?,
        work_start = ?,
        work_end = ?,
        work_days = ?
      WHERE id = ?
    `;

    const values = [
      name,
      username,
      hashedPassword,
      role,
      wage,
      location,
      work_start || null,
      work_end || null,
      Array.isArray(work_days) ? work_days.join(",") : null,
      id
    ];

    db.query(query, values, (err, results) => {
      if (err) {
        console.error("회원 정보 수정 중 오류 발생:", err);
        return res.status(500).json({ error: "SERVER_ERROR", message: "회원 정보 수정 중 오류가 발생했습니다." });
      }

      if (results.affectedRows === 0) {
        return res.status(404).json({ message: "회원 정보를 찾을 수 없습니다." });
      }

      res.status(200).json({ message: "회원 정보가 성공적으로 수정되었습니다!" });
    });
  } catch (error) {
    console.error("비밀번호 해시는 중 오류 발생:", error);
    res.status(500).json({ error: "HASHING_ERROR", message: "비밀번호 해시 중 오류 발생" });
  }
});

// 3. 지점 목록 조회
router.get("/locations", (req, res) => {
  db.query("SELECT * FROM locations", (err, results) => {
    if (err) {
      console.error("지점 목록 오류:", err);
      return res.status(500).json({ error: "SERVER_ERROR" });
    }
    res.status(200).json(results);
  });
});

// 4. 새 지점 추가
router.post("/locations", (req, res) => {
  const { name } = req.body;
  db.query("INSERT INTO locations (name) VALUES (?)", [name], (err) => {
    if (err) {
      console.error("지점 추가 오류:", err);
      return res.status(500).json({ error: "SERVER_ERROR" });
    }
    res.status(201).json({ message: "새로운 지점이 추가되었습니다." });
  });
});

// 5. 지점 삭제
router.delete("/locations/:id", async (req, res) => {
  try {
    const [results] = await db.promise().query("DELETE FROM locations WHERE id = ?", [req.params.id]);
    if (results.affectedRows === 0) {
      return res.status(404).json({ message: "삭제할 지점을 찾을 수 없습니다." });
    }
    res.status(200).json({ message: "지점이 삭제되었습니다." });
  } catch (err) {
    console.error("지점 삭제 오류:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// 6. 시급 변경
router.put("/users/:id/wage", async (req, res) => {
  const { id } = req.params;
  const { newWage } = req.body;
  try {
    const [wageResults] = await db.promise().query("SELECT wage FROM users WHERE id = ?", [id]);
    const currentWage = wageResults[0]?.wage ?? null;
    await db.promise().query("UPDATE users SET wage = ? WHERE id = ?", [newWage, id]);
    await db.promise().query("INSERT INTO wage_history (user_id, previous_wage, new_wage) VALUES (?, ?, ?)", [id, currentWage, newWage]);
    res.status(200).json({ message: "시급이 성공적으로 변경되었습니다." });
  } catch (err) {
    console.error("시급 변경 오류:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// 7. 회원 삭제 (퇴사)
router.delete("/users/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [userRows] = await db.promise().query("SELECT username FROM users WHERE id = ?", [id]);
    if (userRows.length === 0) return res.status(404).json({ message: "삭제할 회원을 찾을 수 없습니다." });
    await db.promise().query("DELETE FROM work_records WHERE username = ?", [userRows[0].username]);
    await db.promise().query("DELETE FROM users WHERE id = ?", [id]);
    res.status(200).json({ message: "회원과 출퇴근 기록이 성공적으로 삭제되었습니다." });
  } catch (err) {
    console.error("회원 삭제 오류:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// 8. 지점별 사용자 목록
router.get("/users/by-location/:location", (req, res) => {
  db.query("SELECT name, username FROM users WHERE location = ?", [req.params.location], (err, results) => {
    if (err) {
      console.error("지점별 알바생 조회 오류:", err);
      return res.status(500).json({ error: "SERVER_ERROR" });
    }
    res.status(200).json(results);
  });
});

// 9. 근무 요약 조회
router.get("/work-summary", async (req, res) => {
  const { username, year, month } = req.query;
  try {
    const [records] = await db.promise().query(`
      SELECT
        wr.username,
        wr.clock_in,
        wr.clock_out,
        wr.total_hours,
        wr.memo, 
        u.name,
        u.location,
        u.wage,
        u.work_start,
        u.work_end
      FROM work_records wr
      JOIN users u ON wr.username = u.username
      WHERE wr.username = ? AND YEAR(wr.clock_in) = ? AND MONTH(wr.clock_in) = ?
      ORDER BY wr.clock_in ASC
    `, [username, year, month]);

    res.status(200).json(records);
  } catch (err) {
    console.error("근무 요약 조회 오류:", err);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

// 10. 출근/퇴근 시간 수정만 수행 (근무시간은 DB 값 그대로 사용)
router.put("/update-work", async (req, res) => {
  const { username, date, clock_in, clock_out, memo, total_hours } = req.body;

  try {
    const [result] = await db.promise().query(
      `UPDATE work_records 
       SET clock_in = ?, clock_out = ?, total_hours = ?, memo = ?
       WHERE username = ? AND DATE(clock_in) = ?`,
      [clock_in, clock_out, total_hours, memo, username, date]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "기록을 찾을 수 없습니다." });
    }

    res.status(200).json({ message: "업데이트 완료!", total_hours, memo });
  } catch (err) {
    console.error("업데이트 오류:", err);
    res.status(500).json({ message: "서버 오류" });
  }
});

// ✅ 11. 근무 추가
router.post("/insert-work", async (req, res) => {
  const { username, clock_in, clock_out, total_hours, memo } = req.body;
  try {
    await db.promise().query(
      `INSERT INTO work_records (username, clock_in, clock_out, total_hours, memo)
       VALUES (?, ?, ?, ?, ?)`,
      [username, clock_in, clock_out || null, total_hours, memo || ""]
    );
    res.status(200).json({ message: "근무 추가 완료" });
  } catch (err) {
    res.status(500).json({ message: "추가 실패" });
  }
});

// ✅ 12. 근무 삭제
router.post("/delete-work", async (req, res) => {
  const { username, clock_in } = req.body;


  if (!username || !clock_in) {
    return res.status(400).json({ message: "username과 clock_in이 필요합니다." });
  }

  try {
    const [result] = await db
      .promise()
      .query("DELETE FROM work_records WHERE username = ? AND clock_in = ?", [username, clock_in]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "삭제할 기록을 찾을 수 없습니다." });
    }

    res.status(200).json({ message: "삭제 완료" });
  } catch (err) {
    console.error("삭제 오류:", err);
    res.status(500).json({ message: "삭제 실패" });
  }
  

});



module.exports = router;
