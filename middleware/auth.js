module.exports = {
  ensureAuth: (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
  },
  ensureGuest: (req, res, next) => {
    if (req.isAuthenticated()) return res.redirect('/');
    next();
  }
};
