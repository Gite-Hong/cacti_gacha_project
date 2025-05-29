const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db/connection");
const router = express.Router();

// 회원가입 요청 처리
router.post("/signup", async (req, res, next) => {
  try {
    const { name, username, password } = req.body;

    // 입력값 검증
    const koreanNameRegex = /^[가-힣]+$/;
    const usernameRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{5,20}$/;
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/;

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

    const hashedPassword = await bcrypt.hash(password, 10);

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

        return next(err); // ← 예외 전달
      }

      res.status(201).json({
        message: "회원가입 성공!",
      });
    });
  } catch (error) {
    console.error("해싱 오류:", error);
    next(error); // ← 예외 전달
  }
});

// 로그인 요청 처리
router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const sql = "SELECT * FROM users WHERE username = ?";
    db.query(sql, [username], async (err, results) => {
      if (err) {
        console.error("로그인 중 오류 발생:", err);
        return next(err); // ← DB 에러 전달
      }

      if (results.length === 0) {
        return res.status(400).json({ message: "존재하지 않는 아이디입니다." });
      }

      const user = results[0];

      try {
        if (!user.password.startsWith("$2b$")) {
          const hashedPassword = await bcrypt.hash(password, 10);
          db.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, user.id], (err) => {
            if (err) console.error("관리자 비밀번호 업데이트 중 오류 발생:", err);
            else console.log("관리자 비밀번호가 해싱되었습니다.");
          });

          if (password !== user.password) {
            return res.status(400).json({ message: "비밀번호가 잘못되었습니다." });
          }
        } else {
          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            return res.status(400).json({ message: "비밀번호가 일치하지 않습니다." });
          }
        }

        res.status(200).json({
          message: "로그인 성공!",
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
          },
        });
      } catch (error) {
        console.error("비밀번호 검증 중 오류 발생:", error);
        return next(error); // ← 해싱 오류 전달
      }
    });
  } catch (err) {
    console.error("로그인 처리 전체 오류:", err);
    next(err); // ← 최상위 오류 전달
  }
});

module.exports = router;
