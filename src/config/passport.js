/*const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('../models/user/user.model');

passport.use(
  new GoogleStrategy(
    {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          user.ultimo_login = new Date();
            await user.save();
            return done(null, user);
        }

        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          user.googleId = profile.id;
          user.email_verificado = true;
          user.estado_cuenta = 'activo';
          user.ultimo_login = new Date();
          await user.save();
        return done(null, user);
        }

        const newUser = new User({
          googleId: profile.id,
          username: profile.emails[0].value.split('@')[0] + '_' + Math.random().toString(36).substr(2, 5),
          email: profile.emails[0].value,
          contrasena_hash: Math.random().toString(36).substr(2, 15),
          email_verificado: true,
          estado_cuenta: 'activo',
          perfil: {
            nivel_actual: 1,
            avatarId: 'avatar1'
          }
        });

        await newUser.save();
        return done(null, newUser);
    } catch (error) {
        return done(error, null);
    }
    }
  )
);

module.exports = passport;
*/