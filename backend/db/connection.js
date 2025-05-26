require("dotenv").config(); // ← 꼭 맨 위에 있어야 함!
const mysql = require("mysql2");

const db = mysql.createConnection({
  host: process.env.DB_HOST,     // mysql.railway.internal
  user: process.env.DB_USER,     // root
  password: process.env.DB_PASS, // Railway에서 받은 비번
  database: process.env.DB_NAME, // railway
  port: process.env.DB_PORT,     // 3306
});

db.connect((err) => {
  if (err) {
    console.error("❌ DB 연결 실패:", err.message);
  } else {
    console.log("✅ DB 연결 성공!");
  }
});

module.exports = db;
