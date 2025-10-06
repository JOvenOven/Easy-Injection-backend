const Joi = require('joi');
const mongoose = require('mongoose');

// Subdocumento para respuestas del usuario en el cuestionario
const userAnswerSchema = new mongoose.Schema({
    pregunta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    respuesta_seleccionada_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer', required: true },
    es_correcta: { type: Boolean, required: true },
    puntos_obtenidos: { type: Number, default: 0 }
});

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
    vulnerabilidades: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vulnerability' }],

    // Cuestionario del usuario
    respuestas_usuario: [userAnswerSchema],

    // Puntuación del escaneo
    puntuacion: {
        puntos_cuestionario: { type: Number, default: 0 },
        total_puntos_cuestionario: { type: Number, default: 0 },
        vulnerabilidades_encontradas: { type: Number, default: 0 },
        puntuacion_final: { type: Number, default: 0 }, // Puntuación sobre 100
        calificacion: { type: String, enum: ['Excelente', 'Bueno', 'Regular', 'Deficiente', 'Crítico'], default: 'Regular' }
    }
});

// Modelo
const Scan = mongoose.model('Scan', scanSchema);

// Método para calcular la puntuación final
scanSchema.methods.calculateScore = function() {
    const maxScore = 100;
    
    // Puntuación del cuestionario (60% del total)
    let quizPercentage = 0;
    if (this.puntuacion.total_puntos_cuestionario > 0) {
        quizPercentage = (this.puntuacion.puntos_cuestionario / this.puntuacion.total_puntos_cuestionario) * 60;
    }
    
    // Penalización por vulnerabilidades (40% del total)
    // Cada vulnerabilidad reduce puntos según su severidad
    let vulnerabilityPenalty = 0;
    const criticalWeight = 10;
    const highWeight = 5;
    const mediumWeight = 3;
    const lowWeight = 1;
    
    // La penalización se calcula en base al número de vulnerabilidades
    // Por ahora usamos el conteo general, pero se puede refinar por severidad
    const vulnerabilityScore = Math.max(0, 40 - (this.puntuacion.vulnerabilidades_encontradas * 5));
    
    // Puntuación final
    this.puntuacion.puntuacion_final = Math.round(quizPercentage + vulnerabilityScore);
    
    // Determinar calificación
    if (this.puntuacion.puntuacion_final >= 90) {
        this.puntuacion.calificacion = 'Excelente';
    } else if (this.puntuacion.puntuacion_final >= 75) {
        this.puntuacion.calificacion = 'Bueno';
    } else if (this.puntuacion.puntuacion_final >= 60) {
        this.puntuacion.calificacion = 'Regular';
    } else if (this.puntuacion.puntuacion_final >= 40) {
        this.puntuacion.calificacion = 'Deficiente';
    } else {
        this.puntuacion.calificacion = 'Crítico';
    }
};

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
        vulnerabilidades: Joi.array().items(Joi.string()),
        respuestas_usuario: Joi.array(),
        puntuacion: Joi.object()
    });

    return schema.validate(scan);
}

exports.Scan = Scan;
exports.validate = validateScan;
