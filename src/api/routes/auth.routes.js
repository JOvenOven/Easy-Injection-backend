const express = require("express");
const passport = require("passport");
const auth = require("../middleware/auth.middleware");
const {
  createSessionData,
} = require("../middleware/session-tracker.middleware");
const router = express.Router();

router.get("/verify", auth, async (req, res) => {
  try {
    res.json({
      message: "Token válido",
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error interno del servidor",
    });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const { User } = require("../../models/user/user.model");
    const userDoc = await User.Model.findById(req.user._id).select(
      "-contrasena_hash -token_verificacion"
    );

    if (!userDoc) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    const user = User.fromMongoose(userDoc);
    res.json({
      user: user.toDTO()
    });
  } catch (error) {
    res.status(500).json({
      error: "Error interno del servidor",
    });
  }
});

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  async (req, res) => {
    try {
      const token = req.user.generateAuthToken();
      const sessionData = createSessionData(req, token);

      if (!req.user.activeSessions) {
        req.user.activeSessions = [];
      }

      req.user.activeSessions = req.user.activeSessions.filter(session => 
        !(session.device === sessionData.device && 
          session.browser === sessionData.browser &&
          session.ip === sessionData.ip)
      );

      req.user.activeSessions.push(sessionData);

      if (req.user.activeSessions.length > 10) {
        req.user.activeSessions.sort((a, b) => 
          new Date(b.lastActivity) - new Date(a.lastActivity)
        );
        req.user.activeSessions = req.user.activeSessions.slice(0, 10);
      }

      await req.user.save();
      res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
    } catch (error) {
      res.redirect("/login?error=internal_server_error");
    }
  }
);

module.exports = router;
