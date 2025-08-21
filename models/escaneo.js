const Joi = require('joi');
const mongoose = require('mongoose');

// Schema de escaneos
const scanSchema = new mongoose.Schema({
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    alias: { type: String, maxlength: 150, required: true },
    url: { type: String, maxlength: 255, required: true },

    flags: {
        xss: { type: Boolean, default: false },
        sqli: { type: Boolean, default: false }
    },

    tipo_autenticacion: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'AuthType' 
    },

    credenciales: {
        usuario_login: { type: String, maxlength: 100 },
        password_login: { type: String, maxlength: 255 }
    },

    estado: { 
        type: String, 
        enum: ['pendiente', 'en_progreso', 'finalizado', 'error'], 
        default: 'pendiente' 
    },

    gestor: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'GestorBD' 
    },

    fecha_inicio: { type: Date, default: Date.now },
    fecha_fin: { type: Date },
    cookie: { type: String, maxlength: 255 },

    // Referencias a vulnerabilidades
    vulnerabilidades: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vulnerability' }]
});

// Modelo
const Scan = mongoose.model('Scan', scanSchema);

// Validación con Joi
function validateScan(scan) {
    const schema = Joi.object({
        usuario_id: Joi.string().required(),
        alias: Joi.string().max(150).required(),
        url: Joi.string().uri().max(255).required(),
        flags: Joi.object({
            xss: Joi.boolean(),
            sqli: Joi.boolean()
        }),
        tipo_autenticacion: Joi.string(),
        credenciales: Joi.object({
            usuario_login: Joi.string().max(100),
            password_login: Joi.string().max(255)
        }),
        estado: Joi.string().valid('pendiente', 'en_progreso', 'finalizado', 'error'),
        gestor: Joi.string(),
        cookie: Joi.string().max(255),
        vulnerabilidades: Joi.array().items(Joi.string())
    });

    return schema.validate(scan);
}

exports.Scan = Scan;
exports.validate = validateScan;
