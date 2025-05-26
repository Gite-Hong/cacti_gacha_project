const express = require("express");
const bcrypt = require("bcrypt"); // bcrypt 라이브러리
const db = require("../db/connection"); // 데이터베이스 연결
const router = express.Router();

// 회원가입 요청 처리
router.post("/signup", async (req, res) => {
  const { name, username, password } = req.body;

  // 입력값 검증
  const koreanNameRegex = /^[가-힣]+$/; // 한글만 허용
  const usernameRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{5,20}$/; // 영어+숫자 필수, 5~20자
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/; // 영어+숫자+특수문자 필수 (8~20자)

  if (!koreanNameRegex.test(name)) {
    return res.status(400).json({
      error: "INVALID_NAME",
      message: "이름은 한글만 입력 가능합니다.",
    });
  }

  if (!usernameRegex.test(username)) {
    return res.status(400).json({
      error: "INVALID_USERNAME",
      message: "아이디는 영어와 숫자를 포함하여 5~20자로 입력해야 합니다.",
    });
  }

  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      error: "INVALID_PASSWORD",
      message: "비밀번호는 영어, 숫자, 특수문자를 포함하여 8~20자로 입력해야 합니다.",
    });
  }

  try {
    // 비밀번호 해싱 (bcrypt.hash() 사용)
    const hashedPassword = await bcrypt.hash(password, 10); // 10은 saltRounds

    // 해싱된 비밀번호를 데이터베이스에 저장
    const sql = "INSERT INTO users (name, username, password) VALUES (?, ?, ?)";
    db.query(sql, [name, username, hashedPassword], (err, results) => {
      if (err) {
        console.error("회원가입 중 오류:", err);

        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({
            error: "DUPLICATE_USERNAME",
            message: "이미 사용 중인 아이디입니다. 다른 아이디를 입력하세요.",
          });
        }

        return res.status(500).json({
          error: "SERVER_ERROR",
          message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        });
      }

      res.status(201).json({
        message: "회원가입 성공!",
      });
    });
  } catch (error) {
    console.error("해싱 오류:", error);
    res.status(500).json({
      error: "HASHING_ERROR",
      message: "비밀번호 해싱 중 오류가 발생했습니다.",
    });
  }
});
// 로그인 요청 처리
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const sql = "SELECT * FROM users WHERE username = ?";
  db.query(sql, [username], async (err, results) => {
    if (err) {
      console.error("로그인 중 오류 발생:", err);
      return res.status(500).json({ message: "서버 오류 발생" });
    }

    if (results.length === 0) {
      return res.status(400).json({ message: "존재하지 않는 아이디입니다." });
    }

    const user = results[0];

    try {
      // 기존 비밀번호가 bcrypt로 해싱되지 않은 경우
      if (!user.password.startsWith("$2b$")) {
        const hashedPassword = await bcrypt.hash(password, 10); // 입력 비밀번호 해싱
        db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, user.id], (err) => {
          if (err) console.error("관리자 비밀번호 업데이트 중 오류 발생:", err);
          console.log("관리자 비밀번호가 해싱되었습니다.");
        });

        // 평문 비밀번호로 로그인 검증
        if (password !== user.password) {
          return res.status(400).json({ message: "비밀번호가 잘못되었습니다." });
        }
      } else {
        // bcrypt를 사용해 비밀번호 검증
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(400).json({ message: "비밀번호가 일치하지 않습니다." });
        }
      }

      // 로그인 성공
      res.status(200).json({
        message: "로그인 성공!",
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role, // 추가: 사용자 역할
        },
      });
    } catch (error) {
      console.error("비밀번호 검증 중 오류 발생:", error);
      res.status(500).json({ message: "비밀번호 검증 중 서버 오류 발생" });
    }
  });
});



module.exports = router;
