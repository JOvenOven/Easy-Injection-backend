const config = require('config');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const mongoose = require('mongoose');
const debug = require('debug')('easyinjection:models:user');
const { Profile, Notification, AnswerHistory } = require('./value-objects/user-value-objects');

// Mongoose Schemas
const notificationSchema = new mongoose.Schema({
    titulo: { type: String, maxlength: 100, required: true },
    mensaje: { type: String, required: true },
    leida: { type: Boolean, default: false },
    fecha_creacion: { type: Date, default: Date.now }
});

const historySchema = new mongoose.Schema({
    pregunta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Pregunta', required: true },
    respuesta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Respuesta', required: true },
    correcta: { type: Boolean, default: false },
    tiempo_respuesta_seg: { type: Number },
    puntos_obtenidos: { type: Number },
    fecha_respuesta: { type: Date, default: Date.now }
});

const profileSchema = new mongoose.Schema({
    nivel_actual: { type: Number, default: 1 },
    avatarId: { type: String, default: 'avatar1' }
});

const userSchema = new mongoose.Schema({
    username: { type: String, minlength: 3, maxlength: 50, required: true, unique: true },
    email: { type: String, minlength: 5, maxlength: 255, unique: true, required: true },
    contrasena_hash: { type: String, minlength: 5, maxlength: 1024, required: true },
    fecha_registro: { type: Date, default: Date.now },
    ultimo_login: { type: Date },
    estado_cuenta: { type: String, enum: ['pendiente', 'activo', 'inactivo', 'suspendido'], default: 'pendiente' },
    email_verificado: { type: Boolean, default: false },
    token_verificacion: { type: String },
    fecha_expiracion_token: { type: Date },
    perfil: profileSchema,
    notificaciones: [notificationSchema],
    historial_respuestas: [historySchema]
});

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

// Domain Class
class User {
    #username;
    #email;
    #contrasena_hash;
    #fecha_registro;
    #ultimo_login;
    #estado_cuenta;
    #email_verificado;
    #token_verificacion;
    #fecha_expiracion_token;
    #perfil;
    #notificaciones;
    #historial_respuestas;
    #id;
    #version;

    constructor(data = {}) {
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.#username = plainData.username;
        this.#email = plainData.email;
        this.#contrasena_hash = plainData.contrasena_hash;
        this.#fecha_registro = plainData.fecha_registro;
        this.#ultimo_login = plainData.ultimo_login;
        this.#estado_cuenta = plainData.estado_cuenta || 'pendiente';
        this.#email_verificado = plainData.email_verificado !== undefined ? plainData.email_verificado : false;
        this.#token_verificacion = plainData.token_verificacion;
        this.#fecha_expiracion_token = plainData.fecha_expiracion_token;
        this.#perfil = new Profile(plainData.perfil || {});
        this.#notificaciones = (plainData.notificaciones || []).map(n => new Notification(n));
        this.#historial_respuestas = (plainData.historial_respuestas || []).map(h => new AnswerHistory(h));
        this.#id = plainData._id;
        this.#version = plainData.__v;
    }

    get username() { return this.#username; }
    set username(value) {
        if (!value || value.length < 3 || value.length > 50) {
            throw new Error('El username debe tener entre 3 y 50 caracteres');
        }
        this.#username = value;
    }

    get email() { return this.#email; }
    set email(value) {
        if (!value || value.length < 5 || value.length > 255) {
            throw new Error('El email debe tener entre 5 y 255 caracteres');
        }
        this.#email = value;
    }

    get contrasena_hash() { return this.#contrasena_hash; }
    set contrasena_hash(value) {
        if (!value || value.length < 5) {
            throw new Error('El hash de contraseña es inválido');
        }
        this.#contrasena_hash = value;
    }

    get fecha_registro() { return this.#fecha_registro; }
    set fecha_registro(value) { this.#fecha_registro = value; }

    get ultimo_login() { return this.#ultimo_login; }
    set ultimo_login(value) { this.#ultimo_login = value; }

    get estado_cuenta() { return this.#estado_cuenta; }
    set estado_cuenta(value) {
        const validStates = ['pendiente', 'activo', 'inactivo', 'suspendido'];
        if (!validStates.includes(value)) {
            throw new Error(`Estado de cuenta inválido: ${value}`);
        }
        this.#estado_cuenta = value;
    }

    get email_verificado() { return this.#email_verificado; }
    set email_verificado(value) { this.#email_verificado = Boolean(value); }

    get token_verificacion() { return this.#token_verificacion; }
    set token_verificacion(value) { this.#token_verificacion = value; }

    get fecha_expiracion_token() { return this.#fecha_expiracion_token; }
    set fecha_expiracion_token(value) { this.#fecha_expiracion_token = value; }

    get perfil() { return this.#perfil; }
    set perfil(value) { this.#perfil = new Profile(value); }

    get notificaciones() { return this.#notificaciones; }
    set notificaciones(value) {
        this.#notificaciones = (value || []).map(n => new Notification(n));
    }

    get historial_respuestas() { return this.#historial_respuestas; }
    set historial_respuestas(value) {
        this.#historial_respuestas = (value || []).map(h => new AnswerHistory(h));
    }

    get _id() { return this.#id; }
    get __v() { return this.#version; }

    isActive() {
        return this.#estado_cuenta === 'activo';
    }

    isPending() {
        return this.#estado_cuenta === 'pendiente';
    }

    isSuspended() {
        return this.#estado_cuenta === 'suspendido';
    }

    isEmailVerified() {
        return this.#email_verificado === true;
    }

    activate() {
        debug('activate: activating user %s', this.#username);
        this.#estado_cuenta = 'activo';
        this.#email_verificado = true;
    }

    suspend() {
        this.#estado_cuenta = 'suspendido';
    }

    deactivate() {
        this.#estado_cuenta = 'inactivo';
    }

    updateLastLogin() {
        this.#ultimo_login = new Date();
    }

    verifyEmail() {
        debug('verifyEmail: verifying email for %s', this.#email);
        this.#email_verificado = true;
        this.#token_verificacion = null;
        this.#fecha_expiracion_token = null;
    }

    isTokenExpired() {
        if (!this.#fecha_expiracion_token) return true;
        return new Date() > this.#fecha_expiracion_token;
    }

    addNotification(titulo, mensaje) {
        debug('addNotification: adding notification "%s" to user %s', titulo, this.#username);
        const notification = Notification.create(titulo, mensaje);
        this.#notificaciones.push(notification);
        return notification;
    }

    getUnreadNotifications() {
        return this.#notificaciones.filter(n => n.isUnread());
    }

    getUnreadCount() {
        return this.getUnreadNotifications().length;
    }

    markAllNotificationsAsRead() {
        this.#notificaciones.forEach(n => n.markAsRead());
    }

    addAnswerToHistory(preguntaId, respuestaId, correcta, puntos, tiempoSeg) {
        const history = AnswerHistory.create(preguntaId, respuestaId, correcta, puntos, tiempoSeg);
        this.#historial_respuestas.push(history);
        return history;
    }

    getCorrectAnswersCount() {
        return this.#historial_respuestas.filter(h => h.isCorrect()).length;
    }

    getTotalPoints() {
        return this.#historial_respuestas.reduce((sum, h) => sum + h.getPoints(), 0);
    }

    getAccuracy() {
        if (this.#historial_respuestas.length === 0) return 0;
        const correct = this.getCorrectAnswersCount();
        return Math.round((correct / this.#historial_respuestas.length) * 100);
    }

    levelUp() {
        return this.#perfil.levelUp();
    }

    getLevel() {
        return this.#perfil.getLevel();
    }

    generateAuthToken() {
        debug('generateAuthToken: generating token for user %s', this.#username);
        const token = jwt.sign(
            { _id: this.#id, username: this.#username, email: this.#email },
            config.get('jwtPrivateKey'),
            { expiresIn: '24h' }
        );
        return token;
    }

    static fromMongoose(mongooseDoc) {
        if (!mongooseDoc) return null;
        debug('fromMongoose: converting to User');
        return new User(mongooseDoc.toObject());
    }

    static build(data) {
        return new User(data);
    }

    static createEmpty() {
        return new User({
            username: '',
            email: '',
            contrasena_hash: '',
            estado_cuenta: 'pendiente',
            email_verificado: false,
            perfil: Profile.createDefault().toObject(),
            notificaciones: [],
            historial_respuestas: []
        });
    }

    static validate(user) {
        const schema = Joi.object({
            username: Joi.string().min(3).max(50).required(),
            email: Joi.string().min(5).max(255).required().email(),
            password: Joi.string().min(5).max(1024).required()
        });

        return schema.validate(user);
    }

    async save() {
        if (this.#id) {
            debug('save: updating User %s', this.#id);
            const updateData = this.toObject();
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await UserModel.findByIdAndUpdate(
                this.#id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`User with _id ${this.#id} not found`);
            }
            
            this.#id = updated._id;
            this.#version = updated.__v;
            return updated;
        } else {
            const doc = new UserModel(this.toObject());
            const saved = await doc.save();
            this.#id = saved._id;
            this.#version = saved.__v;
            return saved;
        }
    }

    static get Model() {
        return UserModel;
    }

    static async find(query = {}) {
        const docs = await UserModel.find(query);
        return docs.map(doc => User.fromMongoose(doc));
    }

    static async findOne(query) {
        const doc = await UserModel.findOne(query);
        return User.fromMongoose(doc);
    }

    static async findById(id) {
        const doc = await UserModel.findById(id);
        return User.fromMongoose(doc);
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await UserModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return User.fromMongoose(doc);
    }

    static async findByIdAndDelete(id) {
        const doc = await UserModel.findByIdAndDelete(id);
        return User.fromMongoose(doc);
    }

    static async create(data) {
        const doc = new UserModel(data);
        const saved = await doc.save();
        return User.fromMongoose(saved);
    }

    toObject() {
        const obj = {};
        if (this.#id !== undefined) obj._id = this.#id;
        if (this.#username !== undefined) obj.username = this.#username;
        if (this.#email !== undefined) obj.email = this.#email;
        if (this.#contrasena_hash !== undefined) obj.contrasena_hash = this.#contrasena_hash;
        if (this.#fecha_registro !== undefined) obj.fecha_registro = this.#fecha_registro;
        if (this.#ultimo_login !== undefined) obj.ultimo_login = this.#ultimo_login;
        if (this.#estado_cuenta !== undefined) obj.estado_cuenta = this.#estado_cuenta;
        if (this.#email_verificado !== undefined) obj.email_verificado = this.#email_verificado;
        if (this.#token_verificacion !== undefined) obj.token_verificacion = this.#token_verificacion;
        if (this.#fecha_expiracion_token !== undefined) obj.fecha_expiracion_token = this.#fecha_expiracion_token;
        if (this.#perfil !== undefined) obj.perfil = this.#perfil.toObject();
        if (this.#notificaciones !== undefined) obj.notificaciones = this.#notificaciones.map(n => n.toObject());
        if (this.#historial_respuestas !== undefined) obj.historial_respuestas = this.#historial_respuestas.map(h => h.toObject());
        if (this.#version !== undefined) obj.__v = this.#version;
        return obj;
    }

    toPersistence() {
        return this.toObject();
    }

    toDTO() {
        return {
            id: this.#id,
            username: this.#username,
            email: this.#email,
            fechaRegistro: this.#fecha_registro,
            ultimoLogin: this.#ultimo_login,
            estadoCuenta: this.#estado_cuenta,
            emailVerificado: this.#email_verificado,
            nivel: this.getLevel(),
            avatarId: this.#perfil.avatarId,
            notificacionesSinLeer: this.getUnreadCount(),
            puntosAcumulados: this.getTotalPoints(),
            precision: this.getAccuracy(),
            respuestasCorrectas: this.getCorrectAnswersCount()
        };
    }

    toPublicProfile() {
        return {
            id: this.#id,
            username: this.#username,
            nivel: this.getLevel(),
            avatarId: this.#perfil.avatarId,
            puntosAcumulados: this.getTotalPoints(),
            precision: this.getAccuracy()
        };
    }

    toString() {
        return `[${this.#estado_cuenta.toUpperCase()}] ${this.#username} (${this.#email}) - Nivel ${this.getLevel()}`;
    }
}

module.exports = User;
module.exports.Profile = Profile;
module.exports.Notification = Notification;
module.exports.AnswerHistory = AnswerHistory;
