const Joi = require('joi');
const mongoose = require('mongoose');

// Schema de vulnerabilidades
const vulnerabilitySchema = new mongoose.Schema({
    escaneo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Scan', required: true },

    // Ahora se referencian los catálogos
    tipo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'VulnerabilityType', required: true },
    nivel_severidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SeverityLevel', required: true },

    parametro_afectado: { type: String, maxlength: 100 },
    url_afectada: { type: String, maxlength: 255 },
    descripcion: { type: String },
    sugerencia: { type: String },
    referencia: { type: String }
});

// Modelo
const Vulnerability = mongoose.model('Vulnerability', vulnerabilitySchema);

// Validación con Joi
function validateVulnerability(vuln) {
    const schema = Joi.object({
        escaneo_id: Joi.string().required(),
        tipo_id: Joi.string().required(),
        nivel_severidad_id: Joi.string().required(),
        parametro_afectado: Joi.string().max(100),
        url_afectada: Joi.string().max(255),
        descripcion: Joi.string(),
        sugerencia: Joi.string(),
        referencia: Joi.string().uri()
    });

    return schema.validate(vuln);
}

exports.Vulnerability = Vulnerability;
exports.validate = validateVulnerability;
