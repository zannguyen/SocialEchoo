require("dotenv").config();
const passport = require("passport");
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const jwt = require("jsonwebtoken");

const User = require("../models/user.model");
const Token = require("../models/token.model");

const opts = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();

// Lấy secret từ env
const secret = process.env.SECRET;
const refreshSecret = process.env.REFRESH_SECRET;

// Nếu chưa load, log ra và sử dụng dummy key để tránh crash (chỉ dev)
if (!secret || !refreshSecret) {
  console.warn(
    "⚠️  SECRET or REFRESH_SECRET not found in .env. Using dummy secrets for dev only!"
  );
}

opts.secretOrKey = secret || "dummy_secret_for_dev_only";

passport.use(
  new JwtStrategy(opts, async (jwt_payload, done) => {
    try {
      const user = await User.findOne({ email: jwt_payload.email });

      if (!user) return done(null, false);

      const refreshTokenFromDB = await Token.findOne({ user: user._id });
      if (!refreshTokenFromDB) return done(null, false);

      let refreshPayload;
      try {
        refreshPayload = jwt.verify(
          refreshTokenFromDB.refreshToken,
          refreshSecret || "dummy_refresh_for_dev_only"
        );
      } catch {
        return done(null, false);
      }

      if (refreshPayload.email !== jwt_payload.email) return done(null, false);

      const tokenExpiration = new Date(jwt_payload.exp * 1000);
      const now = new Date();
      const timeDifference = tokenExpiration.getTime() - now.getTime();

      if (timeDifference > 0 && timeDifference < 30 * 60 * 1000) {
        const payloadNew = {
          _id: user._id,
          email: user.email,
        };
        const newToken = jwt.sign(
          payloadNew,
          secret || "dummy_secret_for_dev_only",
          { expiresIn: "6h" }
        );
        return done(null, { user, newToken });
      }

      return done(null, { user });
    } catch (err) {
      return done(err, false);
    }
  })
);
