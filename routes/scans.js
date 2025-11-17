const express = require('express');
const auth = require('../middleware/auth');
const Scan = require('../models/escaneo');
const Vulnerability = require('../models/vulnerabilidad');
const VulnerabilityType = require('../models/tipo_vulnerabilidad');
const SeverityLevel = require('../models/nivel_severidad');
const debug = require('debug')('easyinjection:routes:scans');
const router = express.Router();

// GET /api/scans - Get all scans for the authenticated user
router.get('/', auth, async (req, res) => {
    try {
        debug('GET /scans - userId: %s', req.user._id);
        const scanDocs = await Scan.Model.find({ usuario_id: req.user._id })
            .populate('vulnerabilidades')
            .sort({ fecha_inicio: -1 });
        const scans = scanDocs.map(doc => new Scan(doc.toObject()));

        // Get vulnerability counts and types for each scan
        const scansWithDetails = await Promise.all(scans.map(async (scan) => {
            const vulnDocs = await Vulnerability.Model.find({ escaneo_id: scan._id })
                .populate('tipo_id', 'nombre')
                .populate('nivel_severidad_id', 'nombre nivel');
            const vulnerabilities = vulnDocs.map(doc => doc.toObject());

            const vulnerabilityCount = vulnerabilities.length;
            const vulnerabilityTypes = [...new Set(vulnerabilities.map(v => v.tipo_id?.nombre).filter(Boolean))];

            // Convert Value Objects to plain objects
            const flagsPlain = scan.flags && typeof scan.flags.toObject === 'function'
                ? scan.flags.toObject()
                : scan.flags;

            return {
                _id: scan._id,
                alias: scan.alias,
                url: scan.url,
                fecha_inicio: scan.fecha_inicio,
                fecha_fin: scan.fecha_fin,
                estado: scan.estado,
                flags: flagsPlain,
                vulnerabilidades: {
                    count: vulnerabilityCount,
                    types: vulnerabilityTypes
                }
            };
        }));

        res.json({
            success: true,
            scans: scansWithDetails
        });
    } catch (error) {
        console.error('Error fetching scans:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// GET /api/scans/:id - Get specific scan details
router.get('/:id', auth, async (req, res) => {
    try {
        debug('GET /scans/:id - scanId: %s, userId: %s', req.params.id, req.user._id);
        const scan = await Scan.findOne({ 
            _id: req.params.id, 
            usuario_id: req.user._id 
        });

        if (!scan) {
            return res.status(404).json({
                success: false,
                error: 'Escaneo no encontrado'
            });
        }

        // Get detailed vulnerabilities
        const vulnDocs = await Vulnerability.Model.find({ escaneo_id: scan._id })
            .populate('tipo_id', 'nombre descripcion')
            .populate('nivel_severidad_id', 'nombre nivel color');
        const vulnerabilities = vulnDocs.map(doc => doc.toObject());

        // Convert Value Objects to plain objects
        const flagsPlain = scan.flags && typeof scan.flags.toObject === 'function'
            ? scan.flags.toObject()
            : scan.flags;

        res.json({
            success: true,
            scan: {
                _id: scan._id,
                alias: scan.alias,
                url: scan.url,
                fecha_inicio: scan.fecha_inicio,
                fecha_fin: scan.fecha_fin,
                estado: scan.estado,
                flags: flagsPlain,
                vulnerabilidades: vulnerabilities
            }
        });
    } catch (error) {
        console.error('Error fetching scan details:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// GET /api/scans/:id/report - Get complete scan report with vulnerabilities and quiz results
router.get('/:id/report', auth, async (req, res) => {
    try {
        const Question = require('../models/pregunta');
        const Answer = require('../models/respuesta');

        const scan = await Scan.findOne({ 
            _id: req.params.id, 
            usuario_id: req.user._id 
        });

        if (!scan) {
            return res.status(404).json({
                success: false,
                error: 'Escaneo no encontrado'
            });
        }

        // Get detailed vulnerabilities with counts by severity
        const vulnDocs = await Vulnerability.Model.find({ escaneo_id: scan._id })
            .populate('tipo_id', 'nombre descripcion')
            .populate('nivel_severidad_id', 'nombre nivel color');
        const vulnerabilities = vulnDocs.map(doc => doc.toObject());

        // Count vulnerabilities by severity
        const severityCounts = {
            critica: 0,
            alta: 0,
            media: 0,
            baja: 0
        };

        vulnerabilities.forEach(vuln => {
            const severity = vuln.nivel_severidad_id?.nombre?.toLowerCase();
            if (severity === 'crítica' || severity === 'critica') {
                severityCounts.critica++;
            } else if (severity === 'alta') {
                severityCounts.alta++;
            } else if (severity === 'media') {
                severityCounts.media++;
            } else if (severity === 'baja') {
                severityCounts.baja++;
            }
        });

        // Populate quiz questions and answers
        debug('Processing quiz results - Total answers: %s', scan.respuestas_usuario?.length || 0);
        const quizResults = [];
        if (scan.respuestas_usuario && scan.respuestas_usuario.length > 0) {
            for (let i = 0; i < scan.respuestas_usuario.length; i++) {
                const userAnswer = scan.respuestas_usuario[i];
                debug('Processing answer %s - pregunta_id: %s, respuesta_id: %s', 
                    i + 1, userAnswer.pregunta_id, userAnswer.respuesta_seleccionada_id);
                
                const questionDoc = await Question.findById(userAnswer.pregunta_id);
                debug('Question found: %s, texto: %s', questionDoc ? 'YES' : 'NO', questionDoc?.texto_pregunta);
                const question = questionDoc ? new Question(questionDoc.toObject()) : null;
                
                const allAnswersDocs = await Answer.find({ pregunta_id: userAnswer.pregunta_id });
                debug('Answers found: %s answers', allAnswersDocs?.length || 0);
                const allAnswers = allAnswersDocs.map(doc => new Answer(doc.toObject()));
                
                const selectedAnswerDoc = await Answer.findById(userAnswer.respuesta_seleccionada_id);
                debug('Selected answer found: %s', selectedAnswerDoc ? 'YES' : 'NO');
                const selectedAnswer = selectedAnswerDoc ? new Answer(selectedAnswerDoc.toObject()) : null;
                
                const correctAnswer = allAnswers.find(a => a.es_correcta);
                debug('Correct answer found: %s', correctAnswer ? 'YES' : 'NO');

                // Convert to plain objects for response
                const questionPlain = question ? question.toObject() : null;
                const answersPlain = allAnswers.map(a => a.toObject());
                const selectedPlain = selectedAnswer ? selectedAnswer.toObject() : null;
                const correctPlain = correctAnswer ? correctAnswer.toObject() : null;

                debug('Question plain object: %O', questionPlain);
                debug('Selected answer plain: %O', selectedPlain);

                quizResults.push({
                    pregunta: questionPlain,
                    respuestas: answersPlain,
                    respuesta_seleccionada: selectedPlain,
                    respuesta_correcta: correctPlain,
                    es_correcta: userAnswer.es_correcta,
                    puntos_obtenidos: userAnswer.puntos_obtenidos
                });
            }
        }
        debug('Quiz results processed: %s questions', quizResults.length);

        // Convert Value Objects to plain objects
        const flagsPlain = scan.flags && typeof scan.flags.toObject === 'function'
            ? scan.flags.toObject()
            : scan.flags;
        
        const puntuacionPlain = scan.puntuacion && typeof scan.puntuacion.toObject === 'function'
            ? scan.puntuacion.toObject()
            : scan.puntuacion;

        res.json({
            success: true,
            report: {
                scan: {
                    _id: scan._id,
                    alias: scan.alias,
                    url: scan.url,
                    fecha_inicio: scan.fecha_inicio,
                    fecha_fin: scan.fecha_fin,
                    estado: scan.estado,
                    flags: flagsPlain
                },
                vulnerabilidades: vulnerabilities,
                resumen_vulnerabilidades: {
                    total: vulnerabilities.length,
                    por_severidad: severityCounts
                },
                cuestionario: quizResults,
                puntuacion: puntuacionPlain
            }
        });
    } catch (error) {
        console.error('Error fetching scan report:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// POST /api/scans - Create a new scan
router.post('/', auth, async (req, res) => {
    try {
        debug('POST /scans - userId: %s', req.user._id);
        debug('POST /scans - Request body: %O', req.body);
        const { alias, url, flags, tipo_autenticacion, credenciales } = req.body;

        const scan = new Scan({
            usuario_id: req.user._id,
            alias,
            url,
            flags: flags || { xss: false, sqli: false },
            tipo_autenticacion,
            credenciales,
            estado: 'pendiente'
        });

        debug('POST /scans - Saving new scan...');
        await scan.save();
        debug('POST /scans - Scan saved with _id: %s', scan._id);

        // Convert Value Objects to plain objects
        const flagsPlain = scan.flags && typeof scan.flags.toObject === 'function'
            ? scan.flags.toObject()
            : scan.flags;

        res.status(201).json({
            success: true,
            scan: {
                _id: scan._id,
                alias: scan.alias,
                url: scan.url,
                fecha_inicio: scan.fecha_inicio,
                estado: scan.estado,
                flags: flagsPlain
            }
        });
    } catch (error) {
        console.error('Error creating scan:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// PUT /api/scans/:id - Update scan status
router.put('/:id', auth, async (req, res) => {
    try {
        const { estado, fecha_fin } = req.body;

        const scan = await Scan.findOneAndUpdate(
            { _id: req.params.id, usuario_id: req.user._id },
            { 
                estado,
                fecha_fin: fecha_fin ? new Date(fecha_fin) : undefined
            },
            { new: true }
        );

        if (!scan) {
            return res.status(404).json({
                success: false,
                error: 'Escaneo no encontrado'
            });
        }

        // Convert Value Objects to plain objects
        const flagsPlain = scan.flags && typeof scan.flags.toObject === 'function'
            ? scan.flags.toObject()
            : scan.flags;

        res.json({
            success: true,
            scan: {
                _id: scan._id,
                alias: scan.alias,
                url: scan.url,
                fecha_inicio: scan.fecha_inicio,
                fecha_fin: scan.fecha_fin,
                estado: scan.estado,
                flags: flagsPlain
            }
        });
    } catch (error) {
        console.error('Error updating scan:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// DELETE /api/scans/:id - Delete a scan
router.delete('/:id', auth, async (req, res) => {
    try {
        const scan = await Scan.findOneAndDelete({ 
            _id: req.params.id, 
            usuario_id: req.user._id 
        });

        if (!scan) {
            return res.status(404).json({
                success: false,
                error: 'Escaneo no encontrado'
            });
        }

        // Also delete associated vulnerabilities
        await Vulnerability.Model.deleteMany({ escaneo_id: scan._id });

        res.json({
            success: true,
            message: 'Escaneo eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error deleting scan:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// POST /api/scans/:id/vulnerabilities - Add vulnerability to scan
router.post('/:id/vulnerabilities', auth, async (req, res) => {
    try {
        const { tipo_id, nivel_severidad_id, parametro_afectado, url_afectada, descripcion, sugerencia, referencia } = req.body;

        const vulnerability = new Vulnerability({
            escaneo_id: req.params.id,
            tipo_id,
            nivel_severidad_id,
            parametro_afectado,
            url_afectada,
            descripcion,
            sugerencia,
            referencia
        });

        await vulnerability.save();

        // Update scan to include this vulnerability
        await Scan.Model.findByIdAndUpdate(req.params.id, {
            $push: { vulnerabilidades: vulnerability._id }
        });

        res.status(201).json({
            success: true,
            vulnerability: {
                _id: vulnerability._id,
                tipo_id: vulnerability.tipo_id,
                nivel_severidad_id: vulnerability.nivel_severidad_id,
                parametro_afectado: vulnerability.parametro_afectado,
                url_afectada: vulnerability.url_afectada,
                descripcion: vulnerability.descripcion,
                sugerencia: vulnerability.sugerencia,
                referencia: vulnerability.referencia
            }
        });
    } catch (error) {
        console.error('Error adding vulnerability:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// POST /api/scans/:id/start - Start a scan execution
router.post('/:id/start', auth, async (req, res) => {
    try {
        const scan = await Scan.findOne({
            _id: req.params.id,
            usuario_id: req.user._id
        });

        if (!scan) {
            return res.status(404).json({
                success: false,
                error: 'Escaneo no encontrado'
            });
        }

        // Check if scan is already running
        const socketService = require('../services/socketService');
        if (socketService.isScanning(scan._id.toString())) {
            return res.status(400).json({
                success: false,
                error: 'El escaneo ya está en ejecución'
            });
        }

        // Extract optional config from request body
        const { dbms, customHeaders } = req.body;

        res.json({
            success: true,
            message: 'Use WebSocket connection to start the scan',
            scanId: scan._id,
            config: {
                dbms: dbms || 'auto',
                customHeaders: customHeaders || ''
            }
        });
    } catch (error) {
        console.error('Error starting scan:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// GET /api/scans/:id/status - Get current scan status
router.get('/:id/status', auth, async (req, res) => {
    try {
        const scan = await Scan.findOne({
            _id: req.params.id,
            usuario_id: req.user._id
        });

        if (!scan) {
            return res.status(404).json({
                success: false,
                error: 'Escaneo no encontrado'
            });
        }

        const socketService = require('../services/socketService');
        const status = socketService.getScanStatus(scan._id.toString());

        res.json({
            success: true,
            status: status || {
                scanId: scan._id,
                isRunning: false,
                dbStatus: scan.estado
            }
        });
    } catch (error) {
        console.error('Error fetching scan status:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

module.exports = router;
