const config = require('config');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const mongoose = require('mongoose');

// Subdocumento para notificaciones
const notificationSchema = new mongoose.Schema({
    titulo: { 
        type: String, 
        maxlength: 100, 
        required: true 
    },
    mensaje: { 
        type: String, 
        required: true 
    },
    leida: { 
        type: Boolean, 
        default: false
    },
    fecha_creacion: { 
        type: Date, 
        default: Date.now 
    }
});

// Subdocumento para historial de respuestas
const historySchema = new mongoose.Schema({
    pregunta_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Pregunta', 
        required: true 
    },
    respuesta_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Respuesta', 
        required: true 
    },
    correcta: { 
        type: Boolean, 
        default: false 
    },
    tiempo_respuesta_seg: { 
        type: Number 
    },
    puntos_obtenidos: { 
        type: Number 
    },
    fecha_respuesta: { 
        type: Date, 
        default: Date.now }
});

// Subdocumento para perfil
const profileSchema = new mongoose.Schema({
    nivel_actual: { 
        type: Number, 
        default: 1 
    },
    avatar: { 
        type: Buffer 
    } // guardamos la imagen como binario
});

// Schema de usuarios
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        minlength: 3,
        maxlength: 50,
        required: true,
        unique: true
    },
    email: {
        type: String,
        minlength: 5,
        maxlength: 255,
        unique: true,
        required: true
    },
    contrasena_hash: {
        type: String,
        minlength: 5,
        maxlength: 1024,
        required: true
    },
    fecha_registro: { 
        type: Date, 
        default: Date.now 
    },
    ultimo_login: { 
        type: Date 
    },
    estado_cuenta: {
        type: String,
        enum: ['pendiente', 'activo', 'inactivo', 'suspendido'],
        default: 'pendiente'
    },
    email_verificado: { // Este campo no está en la documentación
        type: Boolean,
        default: false
    },
    token_verificacion: { 
        type: String 
    },
    fecha_expiracion_token: { 
        type: Date 
    },

    perfil: profileSchema,
    notificaciones: [notificationSchema],
    historial_respuestas: [historySchema]
});

// Método para generar token JWT
userSchema.methods.generateAuthToken = function () {
    const token = jwt.sign(
        { _id: this._id, username: this.username, email: this.email },
        config.get('jwtPrivateKey'),
        { expiresIn: '1h' }
    );
    return token;
};

// Modelo
const User = mongoose.model('User', userSchema);

// Validación con Joi
function validateUser(user) {
    const schema = Joi.object({
        username: Joi.string().min(3).max(50).required(),
        email: Joi.string().min(5).max(255).required().email(),
        password: Joi.string().min(5).max(1024).required()
    });

    return schema.validate(user);
}

exports.User = User;
exports.validate = validateUser;
