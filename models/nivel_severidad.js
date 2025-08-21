const Joi = require('joi');
const mongoose = require('mongoose');

// Schema de niveles de severidad
const severityLevelSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        enum: ['Baja', 'Media', 'Alta', 'Crítica'], 
        required: true, 
        unique: true 
    },
    descripcion: { type: String, maxlength: 255 }
});

// Modelo
const SeverityLevel = mongoose.model('SeverityLevel', severityLevelSchema);

// Validación con Joi
function validateSeverityLevel(level) {
    const schema = Joi.object({
        nombre: Joi.string().valid('Baja', 'Media', 'Alta', 'Crítica').required(),
        descripcion: Joi.string().max(255)
    });

    return schema.validate(level);
}

exports.SeverityLevel = SeverityLevel;
exports.validate = validateSeverityLevel;
