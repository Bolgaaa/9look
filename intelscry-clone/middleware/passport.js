const DiscordStrategy = require('passport-discord').Strategy;

module.exports = (passport) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    console.warn('⚠️  Discord OAuth not configured — set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in .env');
    // Register a dummy strategy so the app doesn't crash
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));
    return;
  }

  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL,
    scope: ['identify', 'email', 'guilds']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Optional: restrict to a specific Discord server
      if (process.env.DISCORD_GUILD_ID) {
        const inGuild = profile.guilds?.some(g => g.id === process.env.DISCORD_GUILD_ID);
        if (!inGuild) {
          return done(null, false, { message: 'You must be in the required Discord server.' });
        }
      }

      const user = {
        id: profile.id,
        username: profile.username,
        discriminator: profile.discriminator,
        avatar: profile.avatar 
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/${parseInt(profile.discriminator) % 5}.png`,
        email: profile.email,
        accessToken,
        // Default credits/limits for new users
        searches: 300,
        maxSearches: 300,
        queries: 600,
        maxQueries: 600,
        credits: 283,
        maxCredits: 283,
        downloads: 5,
        maxDownloads: 5,
        plan: 'Free'
      };

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }));

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
};
