const Joi = require('joi');
const mongoose = require('mongoose');

// Schema de reportes
const reportSchema = new mongoose.Schema({
    escaneo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Scan', required: true },
    fecha_generado: { type: Date, default: Date.now },

    // Datos adicionales útiles en reportes
    resumen: {
        total_vulnerabilidades: { type: Number, default: 0 },
        criticas: { type: Number, default: 0 },
        altas: { type: Number, default: 0 },
        medias: { type: Number, default: 0 },
        bajas: { type: Number, default: 0 }
    }
});

// Modelo
const Report = mongoose.model('Report', reportSchema);

// Validación con Joi
function validateReport(report) {
    const schema = Joi.object({
        escaneo_id: Joi.string().required(),
        resumen: Joi.object({
            total_vulnerabilidades: Joi.number().min(0),
            criticas: Joi.number().min(0),
            altas: Joi.number().min(0),
            medias: Joi.number().min(0),
            bajas: Joi.number().min(0)
        })
    });

    return schema.validate(report);
}

exports.Report = Report;
exports.validate = validateReport;
