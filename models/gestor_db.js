const Joi = require('joi');
const mongoose = require('mongoose');

// Schema de gestores_bd
const gestorBDSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        enum: ['dalfox', 'sqlmap', 'zap', 'otros'], 
        required: true, 
        unique: true 
    },
    descripcion: { type: String, maxlength: 255 }
});

// Modelo
const GestorBD = mongoose.model('GestorBD', gestorBDSchema);

// Validación con Joi
function validateGestorBD(gestor) {
    const schema = Joi.object({
        nombre: Joi.string().valid('dalfox', 'sqlmap', 'zap', 'otros').required(),
        descripcion: Joi.string().max(255)
    });

    return schema.validate(gestor);
}

exports.GestorBD = GestorBD;
exports.validate = validateGestorBD;
