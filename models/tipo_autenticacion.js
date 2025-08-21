const mongoose = require('mongoose');

// Schema de tipos_autenticacion
const authTypeSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        enum: ['usuario_password', 'token', 'oauth2', 'apikey'], 
        required: true, 
        unique: true 
    },
    descripcion: { type: String, maxlength: 255 }
});

// Modelo
const AuthType = mongoose.model('AuthType', authTypeSchema);

// Validación con Joi
function validateAuthType(auth) {
    const schema = Joi.object({
        nombre: Joi.string().valid('usuario_password', 'token', 'oauth2', 'apikey').required(),
        descripcion: Joi.string().max(255)
    });

    return schema.validate(auth);
}

exports.AuthType = AuthType;
exports.validate = validateAuthType;
