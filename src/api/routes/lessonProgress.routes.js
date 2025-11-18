const express = require('express');
const router = express.Router();
const lessonProgressController = require('../controllers/lessonProgress.controller');
const auth = require('../middleware/auth.middleware');

router.use(auth);

router.get('/progress', lessonProgressController.getProgress);
router.get('/progress/stats', lessonProgressController.getProgressStats);
router.get('/progress/:lessonId', lessonProgressController.getLessonProgress);
router.post('/progress/:lessonId/view', lessonProgressController.markLessonViewed);
router.post('/progress/:lessonId/complete', lessonProgressController.markLessonCompleted);
router.delete('/progress/reset', lessonProgressController.resetProgress);

module.exports = router;

