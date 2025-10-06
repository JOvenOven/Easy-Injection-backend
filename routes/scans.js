const express = require('express');
const auth = require('../middleware/auth');
const { Scan } = require('../models/escaneo');
const { Vulnerability } = require('../models/vulnerabilidad');
const { VulnerabilityType } = require('../models/tipo_vulnerabilidad');
const { NivelSeveridad } = require('../models/nivel_severidad');
const router = express.Router();

// GET /api/scans - Get all scans for the authenticated user
router.get('/', auth, async (req, res) => {
    try {
        const scans = await Scan.find({ usuario_id: req.user._id })
            .populate('vulnerabilidades')
            .sort({ fecha_inicio: -1 });

        // Get vulnerability counts and types for each scan
        const scansWithDetails = await Promise.all(scans.map(async (scan) => {
            const vulnerabilities = await Vulnerability.find({ escaneo_id: scan._id })
                .populate('tipo_id', 'nombre')
                .populate('nivel_severidad_id', 'nombre nivel');

            const vulnerabilityCount = vulnerabilities.length;
            const vulnerabilityTypes = [...new Set(vulnerabilities.map(v => v.tipo_id?.nombre).filter(Boolean))];

            return {
                _id: scan._id,
                alias: scan.alias,
                url: scan.url,
                fecha_inicio: scan.fecha_inicio,
                fecha_fin: scan.fecha_fin,
                estado: scan.estado,
                flags: scan.flags,
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
        const vulnerabilities = await Vulnerability.find({ escaneo_id: scan._id })
            .populate('tipo_id', 'nombre descripcion')
            .populate('nivel_severidad_id', 'nombre nivel color');

        res.json({
            success: true,
            scan: {
                _id: scan._id,
                alias: scan.alias,
                url: scan.url,
                fecha_inicio: scan.fecha_inicio,
                fecha_fin: scan.fecha_fin,
                estado: scan.estado,
                flags: scan.flags,
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
        const { Question } = require('../models/pregunta');
        const { Answer } = require('../models/respuesta');

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
        const vulnerabilities = await Vulnerability.find({ escaneo_id: scan._id })
            .populate('tipo_id', 'nombre descripcion')
            .populate('nivel_severidad_id', 'nombre nivel color');

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
        const quizResults = [];
        if (scan.respuestas_usuario && scan.respuestas_usuario.length > 0) {
            for (const userAnswer of scan.respuestas_usuario) {
                const question = await Question.findById(userAnswer.pregunta_id);
                const allAnswers = await Answer.find({ pregunta_id: userAnswer.pregunta_id });
                const selectedAnswer = await Answer.findById(userAnswer.respuesta_seleccionada_id);
                const correctAnswer = allAnswers.find(a => a.es_correcta);

                quizResults.push({
                    pregunta: question,
                    respuestas: allAnswers,
                    respuesta_seleccionada: selectedAnswer,
                    respuesta_correcta: correctAnswer,
                    es_correcta: userAnswer.es_correcta,
                    puntos_obtenidos: userAnswer.puntos_obtenidos
                });
            }
        }

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
                    flags: scan.flags
                },
                vulnerabilidades: vulnerabilities,
                resumen_vulnerabilidades: {
                    total: vulnerabilities.length,
                    por_severidad: severityCounts
                },
                cuestionario: quizResults,
                puntuacion: scan.puntuacion
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

        await scan.save();

        res.status(201).json({
            success: true,
            scan: {
                _id: scan._id,
                alias: scan.alias,
                url: scan.url,
                fecha_inicio: scan.fecha_inicio,
                estado: scan.estado,
                flags: scan.flags
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

        res.json({
            success: true,
            scan: {
                _id: scan._id,
                alias: scan.alias,
                url: scan.url,
                fecha_inicio: scan.fecha_inicio,
                fecha_fin: scan.fecha_fin,
                estado: scan.estado,
                flags: scan.flags
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
        await Vulnerability.deleteMany({ escaneo_id: scan._id });

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
        await Scan.findByIdAndUpdate(req.params.id, {
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

module.exports = router;
