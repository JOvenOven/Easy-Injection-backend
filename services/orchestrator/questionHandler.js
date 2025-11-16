/**
 * Question handler for educational questions during scans
 */

const Question = require('../../models/pregunta');
const Answer = require('../../models/respuesta');

class QuestionHandler {
    constructor(emitter, logger) {
        this.emitter = emitter;
        this.logger = logger;
        this.isPaused = false;
        this.pauseResolver = null;
    }

    /**
     * Wait if scan is paused
     */
    async waitIfPaused() {
        while (this.isPaused) {
            await new Promise(resolve => {
                this.pauseResolver = resolve;
            });
        }
    }

    /**
     * Get a random question from database by phase
     * @param {String} phase - Phase identifier
     * @returns {Promise<Object|null>} Question data with answers or null if not found
     */
    async getRandomQuestionByPhase(phase) {
        try {
            // Try to find questions for the specific phase
            let questions = await Question.find({ fase: phase });
            
            // If no questions found for specific phase, try general phase
            if (questions.length === 0) {
                if (phase.startsWith('sqli-')) {
                    questions = await Question.find({ fase: 'sqli' });
                } else if (phase.startsWith('xss-')) {
                    questions = await Question.find({ fase: 'xss' });
                }
            }
            
            // If still no questions, return null
            if (questions.length === 0) {
                this.logger.addLog(`No se encontraron preguntas para la fase: ${phase}`, 'warning');
                return null;
            }
            
            // Get random question
            const randomIndex = Math.floor(Math.random() * questions.length);
            const question = questions[randomIndex];
            
            // Get all answers for this question
            const answerDocs = await Answer.Model.find({ pregunta_id: question._id }).sort({ es_correcta: -1 });
            const answers = answerDocs.map(doc => new Answer(doc.toObject()));
            
            if (answers.length === 0) {
                this.logger.addLog(`No se encontraron respuestas para la pregunta: ${question.texto_pregunta}`, 'warning');
                return null;
            }
            
            // Find correct answer index
            const correctAnswerIndex = answers.findIndex(a => a.es_correcta === true);
            
            // Shuffle answers for randomness
            const shuffledAnswers = [...answers].sort(() => Math.random() - 0.5);
            const shuffledCorrectIndex = shuffledAnswers.findIndex(a => a.es_correcta === true);
            
            // Build question data object
            return {
                phase: phase,
                question: question.texto_pregunta,
                options: shuffledAnswers.map(a => a.texto_respuesta),
                correctAnswer: shuffledCorrectIndex,
                points: question.puntos,
                questionId: question._id,
                answerIds: shuffledAnswers.map(a => a._id)
            };
        } catch (error) {
            this.logger.addLog(`Error obteniendo pregunta de la base de datos: ${error.message}`, 'error');
            return null;
        }
    }

    /**
     * Ask a question and wait for answer
     * @param {String} phase - Phase identifier (optional, uses questionData.phase if provided)
     * @param {Object} questionData - Question data (optional, if not provided, fetches from DB)
     * @returns {Promise<void>}
     */
    async askQuestion(questionData = null, phase = null) {
        this.isPaused = true;
        this.logger.addLog('⏸ Escaneo pausado - Pregunta de teoría', 'info');
        
        // If questionData is provided, use it (backward compatibility)
        // Otherwise, fetch from database using phase
        let questionToAsk;
        
        if (questionData) {
            questionToAsk = questionData;
        } else if (phase) {
            questionToAsk = await this.getRandomQuestionByPhase(phase);
            if (!questionToAsk) {
                this.logger.addLog('No se pudo obtener pregunta de la base de datos', 'error');
                this.isPaused = false;
                return;
            }
        } else {
            this.logger.addLog('Error: Se debe proporcionar questionData o phase', 'error');
            this.isPaused = false;
            return;
        }
        
        return new Promise((resolve) => {
            this.emitter.emit('question:asked', questionToAsk);
            
            // Use on() instead of once() to allow multiple attempts
            const answerHandler = (answer) => {
                const isCorrect = answer.selectedAnswer === questionToAsk.correctAnswer;
                
                // Always emit result for tracking
                this.emitter.emit('question:result', {
                    ...questionToAsk,
                    userAnswer: answer.selectedAnswer,
                    correct: isCorrect,
                    pointsEarned: isCorrect ? questionToAsk.points : 0
                });
                
                if (isCorrect) {
                    // Correct answer - resolve and continue
                    this.logger.addLog('✓ Respuesta correcta! Continuando escaneo...', 'success');
                    this.isPaused = false;
                    
                    // Remove listener before resolving
                    this.emitter.off('question:answered', answerHandler);
                    
                    // Resume waiting tasks
                    if (this.pauseResolver) {
                        this.pauseResolver();
                        this.pauseResolver = null;
                    }
                    
                    resolve();
                } else {
                    // Incorrect answer - stay paused and wait for another answer
                    this.logger.addLog('✗ Respuesta incorrecta. Esperando respuesta correcta...', 'warning');
                    // Don't resolve, keep waiting for correct answer
                }
            };
            
            this.emitter.on('question:answered', answerHandler);
        });
    }

    /**
     * Answer a question (called externally)
     * @param {Object} answer - Answer data
     */
    answerQuestion(answer) {
        this.emitter.emit('question:answered', answer);
    }

    /**
     * Check if currently paused
     * @returns {boolean}
     */
    isCurrentlyPaused() {
        return this.isPaused;
    }
}

module.exports = QuestionHandler;

