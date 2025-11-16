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
        default: Date.now 
    }
});

// Subdocumento para perfil
const profileSchema = new mongoose.Schema({
    nivel_actual: { 
        type: Number, 
        default: 1 
    },
    avatarId: { 
        type: String,
        default: 'avatar1'
    } // ID del avatar predefinido
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

// Modelo de Mongoose
// Check if model already exists to avoid overwriting
const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

// Clase de dominio
class User {
    constructor(data = {}) {
        // Handle Mongoose document or plain object
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.username = plainData.username;
        this.email = plainData.email;
        this.contrasena_hash = plainData.contrasena_hash;
        this.fecha_registro = plainData.fecha_registro;
        this.ultimo_login = plainData.ultimo_login;
        this.estado_cuenta = plainData.estado_cuenta || 'pendiente';
        this.email_verificado = plainData.email_verificado !== undefined ? plainData.email_verificado : false;
        this.token_verificacion = plainData.token_verificacion;
        this.fecha_expiracion_token = plainData.fecha_expiracion_token;
        this.perfil = plainData.perfil || { nivel_actual: 1, avatarId: 'avatar1' };
        this.notificaciones = plainData.notificaciones || [];
        this.historial_respuestas = plainData.historial_respuestas || [];
        
        // Copy Mongoose-specific fields
        if (plainData._id) this._id = plainData._id;
        if (plainData.__v !== undefined) this.__v = plainData.__v;
    }

    // Método estático de validación
    static validate(user) {
        const schema = Joi.object({
            username: Joi.string().min(3).max(50).required(),
            email: Joi.string().min(5).max(255).required().email(),
            password: Joi.string().min(5).max(1024).required()
        });

        return schema.validate(user);
    }

    // Método de instancia para generar token JWT
    generateAuthToken() {
        const token = jwt.sign(
            { _id: this._id, username: this.username, email: this.email },
            config.get('jwtPrivateKey'),
            { expiresIn: '24h' }
        );
        return token;
    }

    // Método de instancia para guardar
    async save() {
        if (this._id) {
            // Update existing document
            const updateData = this.toObject();
            // Remove _id and __v from update data (Mongoose handles these)
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await UserModel.findByIdAndUpdate(
                this._id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`User with _id ${this._id} not found`);
            }
            
            // Update instance with saved data
            this._id = updated._id;
            this.__v = updated.__v;
            return updated;
        } else {
            // Insert new document
            const doc = new UserModel(this.toObject());
            const saved = await doc.save();
            // Update instance with saved data
            this._id = saved._id;
            this.__v = saved.__v;
            return saved;
        }
    }

    // Exponer el modelo de Mongoose para queries complejas (populate, select, etc.)
    static get Model() {
        return UserModel;
    }

    // Métodos estáticos de consulta
    static async find(query = {}) {
        const docs = await UserModel.find(query);
        return docs.map(doc => new User(doc.toObject()));
    }

    static async findOne(query) {
        const doc = await UserModel.findOne(query);
        return doc ? new User(doc.toObject()) : null;
    }

    static async findById(id) {
        const doc = await UserModel.findById(id);
        return doc ? new User(doc.toObject()) : null;
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await UserModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return doc ? new User(doc.toObject()) : null;
    }

    static async findByIdAndDelete(id) {
        const doc = await UserModel.findByIdAndDelete(id);
        return doc ? new User(doc.toObject()) : null;
    }

    static async create(data) {
        const doc = new UserModel(data);
        const saved = await doc.save();
        return new User(saved.toObject());
    }

    // Método para convertir a objeto plano (útil para compatibilidad)
    toObject() {
        const obj = {};
        
        // Only include defined fields
        if (this._id !== undefined) obj._id = this._id;
        if (this.username !== undefined) obj.username = this.username;
        if (this.email !== undefined) obj.email = this.email;
        if (this.contrasena_hash !== undefined) obj.contrasena_hash = this.contrasena_hash;
        if (this.fecha_registro !== undefined) obj.fecha_registro = this.fecha_registro;
        if (this.ultimo_login !== undefined) obj.ultimo_login = this.ultimo_login;
        if (this.estado_cuenta !== undefined) obj.estado_cuenta = this.estado_cuenta;
        if (this.email_verificado !== undefined) obj.email_verificado = this.email_verificado;
        if (this.token_verificacion !== undefined) obj.token_verificacion = this.token_verificacion;
        if (this.fecha_expiracion_token !== undefined) obj.fecha_expiracion_token = this.fecha_expiracion_token;
        if (this.perfil !== undefined) obj.perfil = this.perfil;
        if (this.notificaciones !== undefined) obj.notificaciones = this.notificaciones;
        if (this.historial_respuestas !== undefined) obj.historial_respuestas = this.historial_respuestas;
        if (this.__v !== undefined) obj.__v = this.__v;
        
        return obj;
    }
}

module.exports = User;
