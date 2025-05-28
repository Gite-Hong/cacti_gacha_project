require("dotenv").config();  // ⬅️ .env 파일 로드

const express = require("express");
const cors = require("cors");
const path = require("path");
const authRoutes = require("./routes/auth");
const workRoutes = require("./routes/work");
const adminRoutes = require("./routes/admin");
const db = require("./db/connection");

const app = express();

// ✅ 요청 로그 + CORS 헤더 직접 삽입 (강제 삽입)
app.use((req, res, next) => {
  console.log("✅ 요청됨:", req.method, req.path);
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// ✅ CORS 미들웨어 설정
const corsOptions = {
  origin: "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // OPTIONS 사전 요청 허용

app.use(express.json());

// ✅ 라우터 등록
app.use("/api/auth", authRoutes);
app.use("/api/work", workRoutes);
app.use("/api/admin", adminRoutes);

// ✅ React 정적 파일 제공
app.use(express.static(path.join(__dirname, "../frontend/build")));
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
});

// ✅ 서버 켜질 때 자동 결석 처리
async function markAbsenteesToday() {
  const now = new Date();
  const yyyyMMdd = now.toISOString().slice(0, 10);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][now.getDay()];

  try {
    const [users] = await db.promise().query(`
      SELECT username, work_days, work_end FROM users WHERE work_days LIKE ?
    `, [`%${weekday}%`]);

    let count = 0;

    for (const user of users) {
      if (!user.work_end) continue;

      const workEndTime = new Date(`${yyyyMMdd}T${user.work_end}`);
      if (now < workEndTime) continue;

      const [records] = await db.promise().query(
        "SELECT * FROM work_records WHERE username = ? AND DATE(clock_in) = ?",
        [user.username, yyyyMMdd]
      );

      if (records.length === 0) {
        await db.promise().query(`
          INSERT INTO work_records (username, clock_in, clock_out, total_hours, memo)
          VALUES (?, ?, NULL, 0.00, '결석')
        `, [user.username, `${yyyyMMdd} 00:00:00`]);
        count++;
      }
    }

    console.log(`[결석 처리] ${count}명 기록됨 (${yyyyMMdd})`);
  } catch (err) {
    console.error("결석 처리 중 오류:", err);
  }
}

// ✅ 자동 퇴근 누락 처리
async function markMissingClockOuts() {
  const now = new Date();
  const yyyyMMdd = now.toISOString().slice(0, 10);

  try {
    const [records] = await db.promise().query(`
      SELECT wr.id, wr.username, wr.clock_in, u.work_start, u.work_end
      FROM work_records wr
      JOIN users u ON wr.username = u.username
      WHERE wr.clock_out IS NULL 
      AND DATE(wr.clock_in) = ?
      AND wr.memo IS NULL
    `, [yyyyMMdd]);

    let count = 0;

    for (const rec of records) {
      const clockIn = new Date(rec.clock_in);
      const passedMs = now - clockIn;
      const passedHours = passedMs / 1000 / 60 / 60;

      if (passedHours >= 8) {
        const dateStr = clockIn.toISOString().slice(0, 10);
        const contractStart = new Date(`${dateStr}T${rec.work_start}`);
        const contractEnd = new Date(`${dateStr}T${rec.work_end}`);
        const totalHours = ((contractEnd - contractStart) / 1000 / 60 / 60).toFixed(2);

        await db.promise().query(`
          UPDATE work_records
          SET clock_out = ?, total_hours = ?, memo = '퇴근 버튼 누락'
          WHERE id = ?
        `, [contractEnd, totalHours, rec.id]);

        count++;
      }
    }

    console.log(`[퇴근 누락 처리] ${count}명 자동 퇴근 기록`);
  } catch (err) {
    console.error("퇴근 누락 처리 중 오류:", err);
  }
}

// ✅ 서버 시작
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}번에서 실행 중입니다.`);
  markAbsenteesToday();
  markMissingClockOuts();
});
