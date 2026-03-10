const express = require('express');
const router = express.Router();
const { ensureAuth, ensureGuest } = require('../middleware/auth');

router.get('/', ensureAuth, (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/app.html'));
});

router.get('/login', ensureGuest, (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/login.html'));
});

module.exports = router;
