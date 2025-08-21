const mongoose = require('mongoose');

// Schema de tipos de vulnerabilidad
const vulnerabilityTypeSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        enum: ['XSS', 'SQLi', 'CSRF', 'XXE', 'SSTI'], 
        required: true, 
        unique: true 
    },
    descripcion: { type: String, maxlength: 255 }
});

// Modelo
const VulnerabilityType = mongoose.model('VulnerabilityType', vulnerabilityTypeSchema);

// Validación con Joi
function validateVulnerabilityType(type) {
    const schema = Joi.object({
        nombre: Joi.string().valid('XSS', 'SQLi', 'CSRF', 'XXE', 'SSTI').required(),
        descripcion: Joi.string().max(255)
    });

    return schema.validate(type);
}

exports.VulnerabilityType = VulnerabilityType;
exports.validate = validateVulnerabilityType;
