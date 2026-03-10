const express = require('express');
const passport = require('passport');
const router = express.Router();

// Redirect to Discord OAuth
router.get('/discord', passport.authenticate('discord'));

// Discord OAuth callback
router.get('/discord/callback',
  passport.authenticate('discord', {
    failureRedirect: '/login?error=auth_failed',
    successRedirect: '/'
  })
);

// Logout
router.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login');
  });
});

module.exports = router;
