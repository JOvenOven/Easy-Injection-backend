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

// Modelo de Mongoose
// Check if model already exists to avoid overwriting
const ScanModel = mongoose.models.Scan || mongoose.model('Scan', scanSchema);

// Clase de dominio
class Scan {
    constructor(data = {}) {
        // Handle Mongoose document or plain object
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.usuario_id = plainData.usuario_id;
        this.alias = plainData.alias;
        this.url = plainData.url;
        this.flags = plainData.flags || { xss: false, sqli: false };
        this.tipo_autenticacion = plainData.tipo_autenticacion;
        this.credenciales = plainData.credenciales;
        this.estado = plainData.estado || 'pendiente';
        this.gestor = plainData.gestor;
        this.fecha_inicio = plainData.fecha_inicio;
        this.fecha_fin = plainData.fecha_fin;
        this.cookie = plainData.cookie;
        this.vulnerabilidades = plainData.vulnerabilidades || [];
        this.respuestas_usuario = plainData.respuestas_usuario || [];
        this.puntuacion = plainData.puntuacion || {
            puntos_cuestionario: 0,
            total_puntos_cuestionario: 0,
            vulnerabilidades_encontradas: 0,
            puntuacion_final: 0,
            calificacion: 'Regular'
        };
        
        // Copy Mongoose-specific fields
        if (plainData._id) this._id = plainData._id;
        if (plainData.__v !== undefined) this.__v = plainData.__v;
    }

    // Método estático de validación
    static validate(scan) {
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

    // Método de instancia para calcular la puntuación final
    calculateScore() {
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
    }

    // Método de instancia para guardar
    async save() {
        if (this._id) {
            // Update existing document
            const updateData = this.toObject();
            // Remove _id and __v from update data (Mongoose handles these)
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await ScanModel.findByIdAndUpdate(
                this._id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`Scan with _id ${this._id} not found`);
            }
            
            // Update instance with saved data
            this._id = updated._id;
            this.__v = updated.__v;
            return updated;
        } else {
            // Insert new document
            const doc = new ScanModel(this.toObject());
            const saved = await doc.save();
            // Update instance with saved data
            this._id = saved._id;
            this.__v = saved.__v;
            return saved;
        }
    }

    // Exponer el modelo de Mongoose para queries complejas (populate, select, etc.)
    static get Model() {
        return ScanModel;
    }

    // Métodos estáticos de consulta
    static async find(query = {}) {
        const docs = await ScanModel.find(query);
        return docs.map(doc => new Scan(doc.toObject()));
    }

    static async findOne(query) {
        const doc = await ScanModel.findOne(query);
        return doc ? new Scan(doc.toObject()) : null;
    }

    static async findById(id) {
        const doc = await ScanModel.findById(id);
        return doc ? new Scan(doc.toObject()) : null;
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await ScanModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return doc ? new Scan(doc.toObject()) : null;
    }

    static async findByIdAndDelete(id) {
        const doc = await ScanModel.findByIdAndDelete(id);
        return doc ? new Scan(doc.toObject()) : null;
    }

    static async findOneAndUpdate(query, update, options = {}) {
        const doc = await ScanModel.findOneAndUpdate(query, update, { new: true, ...options });
        return doc ? new Scan(doc.toObject()) : null;
    }

    static async findOneAndDelete(query) {
        const doc = await ScanModel.findOneAndDelete(query);
        return doc ? new Scan(doc.toObject()) : null;
    }

    static async create(data) {
        const doc = new ScanModel(data);
        const saved = await doc.save();
        return new Scan(saved.toObject());
    }

    // Método para convertir a objeto plano (útil para compatibilidad)
    toObject() {
        const obj = {};
        
        // Only include defined fields
        if (this._id !== undefined) obj._id = this._id;
        if (this.usuario_id !== undefined) obj.usuario_id = this.usuario_id;
        if (this.alias !== undefined) obj.alias = this.alias;
        if (this.url !== undefined) obj.url = this.url;
        if (this.flags !== undefined) obj.flags = this.flags;
        if (this.tipo_autenticacion !== undefined) obj.tipo_autenticacion = this.tipo_autenticacion;
        if (this.credenciales !== undefined) obj.credenciales = this.credenciales;
        if (this.estado !== undefined) obj.estado = this.estado;
        if (this.gestor !== undefined) obj.gestor = this.gestor;
        if (this.fecha_inicio !== undefined) obj.fecha_inicio = this.fecha_inicio;
        if (this.fecha_fin !== undefined) obj.fecha_fin = this.fecha_fin;
        if (this.cookie !== undefined) obj.cookie = this.cookie;
        if (this.vulnerabilidades !== undefined) obj.vulnerabilidades = this.vulnerabilidades;
        if (this.respuestas_usuario !== undefined) obj.respuestas_usuario = this.respuestas_usuario;
        if (this.puntuacion !== undefined) obj.puntuacion = this.puntuacion;
        if (this.__v !== undefined) obj.__v = this.__v;
        
        return obj;
    }
}

module.exports = Scan;
