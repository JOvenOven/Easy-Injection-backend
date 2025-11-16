const socketIO = require('socket.io');
const ScanOrchestrator = require('./scanOrchestrator');
const Scan = require('../models/escaneo');
const Vulnerability = require('../models/vulnerabilidad');
const VulnerabilityType = require('../models/tipo_vulnerabilidad');
const SeverityLevel = require('../models/nivel_severidad');
const Question = require('../models/pregunta');
const Answer = require('../models/respuesta');
const jwt = require('jsonwebtoken');
const config = require('config');

class SocketService {
    constructor() {
        this.io = null;
        this.activeScans = new Map(); // scanId -> orchestrator instance
    }

    initialize(server) {
        this.io = socketIO(server, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:4200',
                methods: ['GET', 'POST'],
                credentials: true
            }
        });

        // Authentication middleware
        this.io.use((socket, next) => {
            const token = socket.handshake.auth.token;
            
            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }

            try {
                const decoded = jwt.verify(token, config.get('jwtPrivateKey'));
                socket.userId = decoded._id;
                next();
            } catch (error) {
                next(new Error('Authentication error: Invalid token'));
            }
        });

        this.io.on('connection', (socket) => {
            console.log(`Client connected: ${socket.id}, User: ${socket.userId}`);

            // Join scan room
            socket.on('scan:join', async (data) => {
                const { scanId } = data;
                
                try {
                    // Verify scan belongs to user
                    const scan = await Scan.findById(scanId);
                    if (!scan) {
                        return socket.emit('error', { message: 'Scan not found' });
                    }
                    
                    if (scan.usuario_id.toString() !== socket.userId) {
                        return socket.emit('error', { message: 'Unauthorized' });
                    }

                    socket.join(`scan:${scanId}`);
                    console.log(`Socket ${socket.id} joined scan room: ${scanId}`);

                    // Send current scan status if active
                    const orchestrator = this.activeScans.get(scanId);
                    if (orchestrator) {
                        socket.emit('scan:status', orchestrator.getStatus());
                    }
                } catch (error) {
                    console.error('Error joining scan room:', error);
                    socket.emit('error', { message: 'Error joining scan room' });
                }
            });

            // Start a new scan
            socket.on('scan:start', async (data) => {
                const { scanId, config: scanConfig } = data;

                try {
                    // Verify scan exists and belongs to user
                    const scan = await Scan.findById(scanId);
                    if (!scan || scan.usuario_id.toString() !== socket.userId) {
                        return socket.emit('error', { message: 'Unauthorized or scan not found' });
                    }

                    // Check if scan is already running
                    if (this.activeScans.has(scanId)) {
                        return socket.emit('error', { message: 'Scan already running' });
                    }

                    // Create orchestrator instance
                    const orchestrator = new ScanOrchestrator(scanId, scanConfig);
                    this.activeScans.set(scanId, orchestrator);

                    // Set up event listeners
                    this.setupOrchestratorListeners(orchestrator, scanId);

                    // Send initial status with phases to all clients in room
                    this.io.to(`scan:${scanId}`).emit('scan:status', orchestrator.getStatus());

                    // Update scan status in database
                    scan.estado = 'en_progreso';
                    scan.fecha_inicio = new Date();
                    await scan.save();

                    // Start the scan
                    orchestrator.start().catch(error => {
                        console.error('Scan execution error:', error);
                        this.io.to(`scan:${scanId}`).emit('scan:error', { 
                            message: error.message 
                        });
                    });

                    socket.emit('scan:started', { scanId });
                } catch (error) {
                    console.error('Error starting scan:', error);
                    socket.emit('error', { message: 'Error starting scan' });
                }
            });

            // Answer a question
            socket.on('question:answer', (data) => {
                const { scanId, selectedAnswer } = data;
                const orchestrator = this.activeScans.get(scanId);
                
                if (orchestrator) {
                    orchestrator.answerQuestion({ selectedAnswer });
                }
            });

            // Pause scan
            socket.on('scan:pause', async (data) => {
                const { scanId } = data;
                const orchestrator = this.activeScans.get(scanId);
                
                if (!orchestrator) {
                    return socket.emit('error', { message: 'Scan not found' });
                }

                // Verify scan belongs to user
                try {
                    const scan = await Scan.findById(scanId);
                    if (!scan || scan.usuario_id.toString() !== socket.userId) {
                        return socket.emit('error', { message: 'Unauthorized' });
                    }
                } catch (error) {
                    return socket.emit('error', { message: 'Error verifying scan' });
                }

                orchestrator.pause();
                this.io.to(`scan:${scanId}`).emit('scan:paused', { scanId });
            });

            // Resume scan
            socket.on('scan:resume', async (data) => {
                const { scanId } = data;
                const orchestrator = this.activeScans.get(scanId);
                
                if (!orchestrator) {
                    return socket.emit('error', { message: 'Scan not found' });
                }

                // Verify scan belongs to user
                try {
                    const scan = await Scan.findById(scanId);
                    if (!scan || scan.usuario_id.toString() !== socket.userId) {
                        return socket.emit('error', { message: 'Unauthorized' });
                    }
                } catch (error) {
                    return socket.emit('error', { message: 'Error verifying scan' });
                }

                orchestrator.resume();
                this.io.to(`scan:${scanId}`).emit('scan:resumed', { scanId });
            });

            // Stop scan
            socket.on('scan:stop', async (data) => {
                const { scanId } = data;
                const orchestrator = this.activeScans.get(scanId);
                
                if (!orchestrator) {
                    return socket.emit('error', { message: 'Scan not found' });
                }

                // Verify scan belongs to user
                try {
                    const scan = await Scan.findById(scanId);
                    if (!scan || scan.usuario_id.toString() !== socket.userId) {
                        return socket.emit('error', { message: 'Unauthorized' });
                    }

                    // Update scan status in database
                    scan.estado = 'detenido';
                    scan.fecha_fin = new Date();
                    await scan.save();
                } catch (error) {
                    console.error('Error stopping scan:', error);
                }

                orchestrator.stop();
                this.activeScans.delete(scanId);
                this.io.to(`scan:${scanId}`).emit('scan:stopped', { scanId });
            });

            // Leave scan room
            socket.on('scan:leave', (data) => {
                const { scanId } = data;
                socket.leave(`scan:${scanId}`);
                console.log(`Socket ${socket.id} left scan room: ${scanId}`);
            });

            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
            });
        });

        console.log('Socket.io service initialized');
    }

    setupOrchestratorListeners(orchestrator, scanId) {
        const room = `scan:${scanId}`;

        // Phase events
        orchestrator.on('phase:started', (data) => {
            this.io.to(room).emit('phase:started', data);
        });

        orchestrator.on('phase:completed', (data) => {
            this.io.to(room).emit('phase:completed', data);
        });

        // Subphase events
        orchestrator.on('subphase:started', (data) => {
            this.io.to(room).emit('subphase:started', data);
        });

        orchestrator.on('subphase:completed', (data) => {
            this.io.to(room).emit('subphase:completed', data);
        });

        // Log events
        orchestrator.on('log:added', (logEntry) => {
            this.io.to(room).emit('log:added', logEntry);
        });

        // Discovery events
        orchestrator.on('endpoint:discovered', (endpoint) => {
            this.io.to(room).emit('endpoint:discovered', endpoint);
        });

        orchestrator.on('parameter:discovered', (parameter) => {
            this.io.to(room).emit('parameter:discovered', parameter);
        });

        orchestrator.on('vulnerability:found', (vulnerability) => {
            this.io.to(room).emit('vulnerability:found', vulnerability);
        });

        // Question events
        orchestrator.on('question:asked', (question) => {
            this.io.to(room).emit('question:asked', question);
        });

        orchestrator.on('question:result', (result) => {
            this.io.to(room).emit('question:result', result);
        });

        // Scan pause/resume/stop events
        orchestrator.on('scan:paused', (data) => {
            this.io.to(room).emit('scan:paused', data);
        });

        orchestrator.on('scan:resumed', (data) => {
            this.io.to(room).emit('scan:resumed', data);
        });

        orchestrator.on('scan:stopped', (data) => {
            this.io.to(room).emit('scan:stopped', data);
        });

        // Scan completion
        orchestrator.on('scan:completed', async (data) => {
            try {
                const scan = await Scan.findById(scanId);
                if (!scan) {
                    console.error(`Scan ${scanId} not found`);
                    return;
                }

                // Save all vulnerabilities to database
                const savedVulnerabilityIds = await this.saveVulnerabilities(scanId, data.vulnerabilities || []);
                
                // Save all question answers to database
                const savedAnswers = await this.saveQuestionAnswers(scanId, data.questionResults || []);
                
                // Calculate and save score
                const quizPoints = savedAnswers.reduce((sum, ans) => sum + (ans.puntos_obtenidos || 0), 0);
                let totalQuizPoints = 0;
                for (const ans of savedAnswers) {
                    try {
                        const question = await Question.findById(ans.pregunta_id);
                        if (question) {
                            totalQuizPoints += question.puntos;
                        }
                    } catch (err) {
                        console.error(`Error fetching question ${ans.pregunta_id}:`, err);
                    }
                }
                
                // Update scan with all data
                scan.estado = 'finalizado';
                scan.fecha_fin = new Date();
                scan.vulnerabilidades = savedVulnerabilityIds;
                scan.respuestas_usuario = savedAnswers;
                scan.puntuacion = {
                    puntos_cuestionario: quizPoints,
                    total_puntos_cuestionario: totalQuizPoints || 100, // Default to 100 if no questions
                    vulnerabilidades_encontradas: savedVulnerabilityIds.length
                };
                
                // Calculate final score using the model method
                scan.calculateScore();
                
                await scan.save();

                console.log(`Scan ${scanId} completed and saved. Score: ${scan.puntuacion.puntuacion_final}, Grade: ${scan.puntuacion.calificacion}`);

                this.io.to(room).emit('scan:completed', data);
                
                // Clean up
                this.activeScans.delete(scanId);
            } catch (error) {
                console.error('Error completing scan:', error);
                this.io.to(room).emit('scan:error', { message: 'Error guardando el escaneo: ' + error.message });
            }
        });

        // Error events
        orchestrator.on('scan:error', async (data) => {
            try {
                const scan = await Scan.findById(scanId);
                if (scan) {
                    scan.estado = 'error';
                    await scan.save();
                }

                this.io.to(room).emit('scan:error', data);
                this.activeScans.delete(scanId);
            } catch (error) {
                console.error('Error handling scan error:', error);
            }
        });
    }

    getScanStatus(scanId) {
        const orchestrator = this.activeScans.get(scanId);
        return orchestrator ? orchestrator.getStatus() : null;
    }

    isScanning(scanId) {
        return this.activeScans.has(scanId);
    }

    /**
     * Save vulnerabilities to database
     * @param {String} scanId - Scan ID
     * @param {Array} vulnerabilities - Array of vulnerability objects from orchestrator
     * @returns {Array} Array of saved vulnerability IDs
     */
    async saveVulnerabilities(scanId, vulnerabilities) {
        const savedIds = [];

        for (const vuln of vulnerabilities) {
            try {
                // Map vulnerability type (SQLi, XSS) to VulnerabilityType
                let typeName = vuln.type;
                if (typeName === 'SQLi') typeName = 'SQLi';
                else if (typeName === 'XSS') typeName = 'XSS';
                
                let vulnerabilityType = await VulnerabilityType.findOne({ nombre: typeName });
                if (!vulnerabilityType) {
                    // Create if doesn't exist
                    vulnerabilityType = new VulnerabilityType({
                        nombre: typeName,
                        descripcion: `Vulnerabilidad de tipo ${typeName}`
                    });
                    await vulnerabilityType.save();
                }

                // Map severity (critical, high, medium, low) to SeverityLevel
                const severityMap = {
                    'critical': 'Crítica',
                    'high': 'Alta',
                    'medium': 'Media',
                    'low': 'Baja',
                    'critica': 'Crítica',
                    'alta': 'Alta',
                    'media': 'Media',
                    'baja': 'Baja'
                };
                
                const severityName = severityMap[vuln.severity?.toLowerCase()] || 'Media';
                let severityLevel = await SeverityLevel.findOne({ nombre: severityName });
                if (!severityLevel) {
                    // Create if doesn't exist
                    severityLevel = new SeverityLevel({
                        nombre: severityName,
                        descripcion: `Nivel de severidad ${severityName}`
                    });
                    await severityLevel.save();
                }

                // Create vulnerability
                const vulnerability = new Vulnerability({
                    escaneo_id: scanId,
                    tipo_id: vulnerabilityType._id,
                    nivel_severidad_id: severityLevel._id,
                    parametro_afectado: vuln.parameter || null,
                    url_afectada: vuln.endpoint || null,
                    descripcion: vuln.description || `Vulnerabilidad ${typeName} detectada`,
                    sugerencia: this._getVulnerabilitySuggestion(typeName),
                    referencia: null
                });

                await vulnerability.save();
                savedIds.push(vulnerability._id);
            } catch (error) {
                console.error(`Error saving vulnerability: ${error.message}`, vuln);
            }
        }

        return savedIds;
    }

    /**
     * Save question answers to database
     * @param {String} scanId - Scan ID
     * @param {Array} questionResults - Array of question result objects from orchestrator
     * @returns {Array} Array of saved answer objects with pregunta_id, respuesta_seleccionada_id, etc.
     */
    async saveQuestionAnswers(scanId, questionResults) {
        const savedAnswers = [];

        for (const result of questionResults) {
            try {
                let question;
                let savedAnswerIds = [];
                
                // If questionId is provided, use it directly (questions from DB)
                if (result.questionId) {
                    question = await Question.findById(result.questionId);
                    if (!question) {
                        console.error(`Question with ID ${result.questionId} not found`);
                        continue;
                    }
                    
                    // Use answerIds if provided, otherwise find by text
                    if (result.answerIds && result.answerIds.length > 0) {
                        savedAnswerIds = result.answerIds;
                    } else {
                        // Find answers by text
                        const answerOptions = result.options || [];
                        for (const optionText of answerOptions) {
                            const answer = await Answer.findOne({ 
                                pregunta_id: question._id,
                                texto_respuesta: optionText
                            });
                            if (answer) {
                                savedAnswerIds.push(answer._id);
                            }
                        }
                    }
                } else {
                    // Find or create question by text (backward compatibility)
                    question = await Question.findOne({ texto_pregunta: result.question });
                    if (!question) {
                        // Determine difficulty based on points
                        let dificultad = 'facil';
                        if (result.points > 15) dificultad = 'dificil';
                        else if (result.points > 10) dificultad = 'media';

                        question = new Question({
                            texto_pregunta: result.question,
                            dificultad: dificultad,
                            puntos: result.points || 10,
                            fase: result.phase || 'init' // Use phase from result or default to 'init'
                        });
                        await question.save();
                    }

                    // Find or create all answer options
                    const answerOptions = result.options || [];
                    
                    for (let i = 0; i < answerOptions.length; i++) {
                        let answer = await Answer.findOne({ 
                            pregunta_id: question._id,
                            texto_respuesta: answerOptions[i]
                        });
                        
                        if (!answer) {
                            answer = new Answer({
                                pregunta_id: question._id,
                                texto_respuesta: answerOptions[i],
                                es_correcta: i === result.correctAnswer
                            });
                            await answer.save();
                        }
                        
                        savedAnswerIds.push(answer._id);
                    }
                }

                // Get the selected answer ID
                const selectedAnswerIndex = result.userAnswer !== undefined ? result.userAnswer : -1;
                const respuesta_seleccionada_id = savedAnswerIds[selectedAnswerIndex] || savedAnswerIds[0];

                // Create user answer entry
                const userAnswer = {
                    pregunta_id: question._id,
                    respuesta_seleccionada_id: respuesta_seleccionada_id,
                    es_correcta: result.correct || false,
                    puntos_obtenidos: result.pointsEarned || 0
                };

                savedAnswers.push(userAnswer);
            } catch (error) {
                console.error(`Error saving question answer: ${error.message}`, result);
            }
        }

        return savedAnswers;
    }

    /**
     * Get vulnerability suggestion based on type
     * @param {String} type - Vulnerability type
     * @returns {String} Suggestion text
     */
    _getVulnerabilitySuggestion(type) {
        const suggestions = {
            'SQLi': 'Utilice consultas preparadas (prepared statements) o parámetros parametrizados para prevenir inyecciones SQL. Valide y sanitice toda la entrada del usuario.',
            'XSS': 'Implemente validación de entrada y escapado de salida. Use Content Security Policy (CSP) y considere sanitizar el contenido HTML antes de mostrarlo.',
            'CSRF': 'Implemente tokens CSRF (tokens sincronizadores) y verifique el origen de las peticiones.',
            'XXE': 'Deshabilite el procesamiento de entidades externas XML. Use procesadores XML seguros que no procesen DTDs externos.',
            'SSTI': 'Evite usar motores de plantillas que evalúen código arbitrario. Use motores de plantillas seguros o sanitice las plantillas.'
        };
        return suggestions[type] || 'Revise y corrija la vulnerabilidad siguiendo las mejores prácticas de seguridad.';
    }
}

// Singleton instance
const socketService = new SocketService();

module.exports = socketService;
