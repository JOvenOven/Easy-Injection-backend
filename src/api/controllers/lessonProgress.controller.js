const { LessonProgress } = require('../../models/user/lessonProgress.model');

exports.getProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const progress = await LessonProgress.getUserProgress(userId);
    
    res.json({
      success: true,
      data: progress.toDTO()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener el progreso de las lecciones',
      error: error.message
    });
  }
};

exports.getProgressStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const { lessonIds } = req.query;
    
    let lessonIdsArray = null;
    if (lessonIds) {
      lessonIdsArray = Array.isArray(lessonIds) ? lessonIds : lessonIds.split(',');
    }
    
    const stats = await LessonProgress.getProgressStats(userId, lessonIdsArray);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener las estadísticas de progreso',
      error: error.message
    });
  }
};

exports.getLessonProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { lessonId } = req.params;
    
    const lessonDetails = await LessonProgress.getLessonDetails(userId, lessonId);
    
    res.json({
      success: true,
      data: lessonDetails
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener el progreso de la lección',
      error: error.message
    });
  }
};

exports.markLessonViewed = async (req, res) => {
  try {
    const userId = req.user._id;
    const { lessonId } = req.params;
    
    const progress = await LessonProgress.markLessonViewed(userId, lessonId);
    
    const lesson = progress.findLesson(lessonId);
    
    res.json({
      success: true,
      message: 'Lección marcada como vista',
      data: {
        lessonId,
        status: lesson.status,
        firstViewedAt: lesson.firstViewedAt,
        lastViewedAt: lesson.lastViewedAt,
        viewCount: lesson.viewCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al marcar la lección como vista',
      error: error.message
    });
  }
};

exports.markLessonCompleted = async (req, res) => {
  try {
    const userId = req.user._id;
    const { lessonId } = req.params;
    
    const progress = await LessonProgress.markLessonCompleted(userId, lessonId);
    
    const lesson = progress.lessons.find(l => l.lessonId === lessonId);
    
    res.json({
      success: true,
      message: 'Lección marcada como completada',
      data: {
        lessonId,
        status: lesson.status,
        completedAt: lesson.completedAt,
        firstViewedAt: lesson.firstViewedAt,
        lastViewedAt: lesson.lastViewedAt,
        viewCount: lesson.viewCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al marcar la lección como completada',
      error: error.message
    });
  }
};

exports.resetProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    
    await LessonProgress.findOneAndDelete({ userId });
    
    res.json({
      success: true,
      message: 'Progreso reiniciado correctamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al reiniciar el progreso',
      error: error.message
    });
  }
};

