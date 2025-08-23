const express = require("express");
const router = express.Router();

const VALID_TOKENS = ["SEU_TOKEN_AQUI", "OUTRO_TOKEN"]; // Pode ser de .env

router.post("/validate-token", (req, res) => {
  const { token } = req.body;
  if (VALID_TOKENS.includes(token)) {
    res.json({ valid: true });
  } else {
    res.json({ valid: false });
  }
});

module.exports = router;