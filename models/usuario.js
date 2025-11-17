const Joi = require('joi');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('config');
const debug = require('debug')('easyinjection:models:user');
const BaseModel = require('./base/BaseModel');
const { buildObject } = require('./base/ModelHelpers');
const { Profile, Notification, AnswerHistory } = require('./value-objects/user-value-objects');

const notificationSchema = new mongoose.Schema({
    mensaje: { type: String, required: true, maxlength: 500 },
    fecha: { type: Date, default: Date.now },
    leida: { type: Boolean, default: false }
});

const historySchema = new mongoose.Schema({
    pregunta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    veces_correcta: { type: Number, default: 0 },
    veces_incorrecta: { type: Number, default: 0 },
    ultima_respuesta: { type: Date, default: Date.now }
});

const profileSchema = new mongoose.Schema({
    avatarId: { type: String, default: 'avatar1', maxlength: 10 },
    nivel: { type: Number, default: 1 },
    puntos_totales: { type: Number, default: 0 }
});

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true, maxlength: 50 },
    email: { type: String, unique: true, required: true, maxlength: 100 },
    contrasena_hash: { type: String, required: true, maxlength: 255 },
    perfil: profileSchema,
    notificaciones: [notificationSchema],
    historial_respuestas: [historySchema],
    fecha_registro: { type: Date, default: Date.now },
    ultimo_login: { type: Date },
    estado_cuenta: { type: String, enum: ['pendiente', 'activo', 'inactivo', 'suspendido'], default: 'pendiente' },
    email_verificado: { type: Boolean, default: false },
    token_verificacion: { type: String, maxlength: 100 },
    fecha_expiracion_token: { type: Date },
    activo: { type: Boolean, default: false },
    codigo_verificacion: { type: String, maxlength: 100 },
    fecha_verificacion: { type: Date }
});

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

class User extends BaseModel {
    #username; #email; #contrasena_hash; #perfil; #notificaciones; #historial_respuestas;
    #fecha_registro; #ultimo_login; #estado_cuenta; #email_verificado; #token_verificacion;
    #fecha_expiracion_token; #activo; #codigo_verificacion; #fecha_verificacion;

    constructor(data = {}) {
        super(data);
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        this.#username = plainData.username;
        this.#email = plainData.email;
        this.#contrasena_hash = plainData.contrasena_hash;
        this.#perfil = new Profile(plainData.perfil || {});
        this.#notificaciones = (plainData.notificaciones || []).map(n => new Notification(n));
        this.#historial_respuestas = (plainData.historial_respuestas || []).map(h => new AnswerHistory(h));
        this.#fecha_registro = plainData.fecha_registro;
        this.#ultimo_login = plainData.ultimo_login;
        this.#estado_cuenta = plainData.estado_cuenta || 'pendiente';
        this.#email_verificado = plainData.email_verificado !== undefined ? plainData.email_verificado : false;
        this.#token_verificacion = plainData.token_verificacion;
        this.#fecha_expiracion_token = plainData.fecha_expiracion_token;
        this.#activo = plainData.activo || false;
        this.#codigo_verificacion = plainData.codigo_verificacion;
        this.#fecha_verificacion = plainData.fecha_verificacion;
    }

    get username() { return this.#username; }
    set username(value) { if (!value || value.length > 50) throw new Error('Username es obligatorio y no puede exceder 50 caracteres'); this.#username = value; }

    get email() { return this.#email; }
    set email(value) { if (!value || value.length > 100) throw new Error('Email es obligatorio y no puede exceder 100 caracteres'); this.#email = value; }

    get contrasena_hash() { return this.#contrasena_hash; }
    set contrasena_hash(value) { if (!value) throw new Error('La contraseña hash es obligatoria'); this.#contrasena_hash = value; }

    get perfil() { return this.#perfil; }
    set perfil(value) { this.#perfil = new Profile(value); }

    get notificaciones() { return this.#notificaciones; }
    set notificaciones(value) { this.#notificaciones = (value || []).map(n => new Notification(n)); }

    get historial_respuestas() { return this.#historial_respuestas; }
    set historial_respuestas(value) { this.#historial_respuestas = (value || []).map(h => new AnswerHistory(h)); }

    get fecha_registro() { return this.#fecha_registro; }
    set fecha_registro(value) { this.#fecha_registro = value; }

    get ultimo_login() { return this.#ultimo_login; }
    set ultimo_login(value) { this.#ultimo_login = value; }

    get estado_cuenta() { return this.#estado_cuenta; }
    set estado_cuenta(value) {
        const validStates = ['pendiente', 'activo', 'inactivo', 'suspendido'];
        if (value && !validStates.includes(value)) throw new Error(`Estado de cuenta inválido: ${value}`);
        this.#estado_cuenta = value;
    }

    get email_verificado() { return this.#email_verificado; }
    set email_verificado(value) { this.#email_verificado = Boolean(value); }

    get token_verificacion() { return this.#token_verificacion; }
    set token_verificacion(value) { if (value && value.length > 100) throw new Error('El token de verificación no puede exceder 100 caracteres'); this.#token_verificacion = value; }

    get fecha_expiracion_token() { return this.#fecha_expiracion_token; }
    set fecha_expiracion_token(value) { this.#fecha_expiracion_token = value; }

    get activo() { return this.#activo; }
    set activo(value) { this.#activo = Boolean(value); }

    get codigo_verificacion() { return this.#codigo_verificacion; }
    set codigo_verificacion(value) { if (value && value.length > 100) throw new Error('El código de verificación no puede exceder 100 caracteres'); this.#codigo_verificacion = value; }

    get fecha_verificacion() { return this.#fecha_verificacion; }
    set fecha_verificacion(value) { this.#fecha_verificacion = value; }

    activate() { this.#activo = true; this.#fecha_verificacion = new Date(); this.#codigo_verificacion = null; }
    deactivate() { this.#activo = false; }
    isActive() { return this.#activo; }

    generateAuthToken() {
        debug('generateAuthToken: generating JWT for user', this.#username);
        const token = jwt.sign(
            { _id: this._id, username: this.#username, email: this.#email },
            config.get('jwtPrivateKey'),
            { expiresIn: '24h' }
        );
        return token;
    }

    verifyEmail(code) {
        if (this.#codigo_verificacion !== code) return false;
        this.activate();
        return true;
    }

    addNotification(message) {
        if (!this.#notificaciones) this.#notificaciones = [];
        this.#notificaciones.push(new Notification({ mensaje: message, fecha: new Date(), leida: false }));
    }

    markNotificationAsRead(notificationId) {
        const notification = this.#notificaciones.find(n => n._id && n._id.toString() === notificationId);
        if (notification) notification.markAsRead();
    }

    getUnreadNotificationCount() { return this.#notificaciones.filter(n => !n.isRead()).length; }

    getTotalPoints() { return this.#perfil.getTotalPoints(); }
    getLevel() { return this.#perfil.getLevel(); }
    addPoints(points) { this.#perfil.addPoints(points); }
    levelUp() { this.#perfil.levelUp(); }

    updateAnswerHistory(preguntaId, esCorrecta) {
        if (!this.#historial_respuestas) this.#historial_respuestas = [];
        let historyItem = this.#historial_respuestas.find(h => h.pregunta_id && h.pregunta_id.toString() === preguntaId.toString());
        if (!historyItem) {
            historyItem = new AnswerHistory({ pregunta_id: preguntaId, veces_correcta: 0, veces_incorrecta: 0, ultima_respuesta: new Date() });
            this.#historial_respuestas.push(historyItem);
        }
        historyItem.recordAnswer(esCorrecta);
    }

    getAccuracy() {
        if (!this.#historial_respuestas || this.#historial_respuestas.length === 0) return 0;
        const totalCorrect = this.#historial_respuestas.reduce((sum, h) => sum + h.veces_correcta, 0);
        const totalIncorrect = this.#historial_respuestas.reduce((sum, h) => sum + h.veces_incorrecta, 0);
        const total = totalCorrect + totalIncorrect;
        return total > 0 ? (totalCorrect / total) * 100 : 0;
    }

    static createEmpty() {
        return new User({
            username: '', email: '', contrasena_hash: '', perfil: Profile.createEmpty().toObject(),
            notificaciones: [], historial_respuestas: [], activo: false
        });
    }

    static validate(user) {
        return Joi.object({
            username: Joi.string().max(50).required(),
            email: Joi.string().email().max(100).required(),
            contrasena_hash: Joi.string().max(255).required(),
            perfil: Joi.object({ avatarId: Joi.number().min(1).max(6), nivel: Joi.number(), puntos_totales: Joi.number() }),
            notificaciones: Joi.array(),
            historial_respuestas: Joi.array(),
            activo: Joi.boolean(),
            codigo_verificacion: Joi.string().max(100),
            fecha_verificacion: Joi.date()
        }).validate(user);
    }

    static get Model() { return UserModel; }
    static get debug() { return debug; }

    toObject() { return buildObject(this, ['username', 'email', 'contrasena_hash', 'perfil', 'notificaciones', 'historial_respuestas', 'fecha_registro', 'ultimo_login', 'estado_cuenta', 'email_verificado', 'token_verificacion', 'fecha_expiracion_token', 'activo', 'codigo_verificacion', 'fecha_verificacion']); }

    toDTO() {
        return {
            id: this._id, username: this.#username, email: this.#email,
            perfil: this.#perfil.toObject(), activo: this.#activo, fechaRegistro: this.#fecha_registro,
            nivel: this.getLevel(), puntosTotales: this.getTotalPoints(), precision: this.getAccuracy(),
            notificacionesSinLeer: this.getUnreadNotificationCount()
        };
    }

    toString() { return `${this.#username} (${this.#email}) - Level ${this.getLevel()}`; }
}

module.exports = User;
module.exports.Profile = Profile;
module.exports.Notification = Notification;
module.exports.AnswerHistory = AnswerHistory;
