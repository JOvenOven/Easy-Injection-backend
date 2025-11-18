const express = require("express");
const auth = require("../middleware/auth.middleware");
const { Activity } = require("../../models/user/activity.model");
const router = express.Router();

router.get("/", auth, async (req, res) => {
  try {
    const activities = await Activity.Model.find({ user_id: req.user._id })
      .sort({ date: -1 })
      .limit(10);
    res.json(activities);
  } catch (error) {
    console.error('Error en /api/activity:', error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

router.put("/:id/read", auth, async (req, res) => {
  try {
    const activity = await Activity.Model.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      { read: true },
      { new: true }
    );
    if (!activity) {
      return res.status(404).json({ error: "Actividad no encontrada" });
    }
    res.json({ message: "Actividad marcada como leída" });
  } catch (error) {
    console.error('Error en /api/activity/:id/read:', error);
    res.status(500).json({ error: "Error interno del servidor", details: error.message });
  }
});

module.exports = router;
