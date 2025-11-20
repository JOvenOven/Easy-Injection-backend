const Joi = require('joi');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const config = require('config');
const debug = require('debug')('easyinjection:models:user');
const BaseModel = require('../base/BaseModel');
const { buildObject } = require('../base/ModelHelpers');
const { Profile, AnswerHistory } = require('../value-objects/user-value-objects');

const historySchema = new mongoose.Schema({
    pregunta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    respuesta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer', required: true },
    correcta: { type: Boolean, default: false },
    tiempo_respuesta_seg: { type: Number },
    puntos_obtenidos: { type: Number },
    fecha_respuesta: { type: Date, default: Date.now }
});

const profileSchema = new mongoose.Schema({
    nivel_actual: { type: Number, default: 1 },
    avatarId: { type: String, default: 'avatar1' },
    puntos_totales: { type: Number, default: 0 }
});

const sessionSchema = new mongoose.Schema({
    token: String,
    device: String,
    browser: String,
    os: String,
    location: String,
    ip: String,
    lastActivity: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
    username: { type: String, minlength: 3, maxlength: 50, required: true, unique: true },
    email: { type: String, minlength: 5, maxlength: 255, unique: true, required: true },
    contrasena_hash: { type: String, minlength: 5, maxlength: 1024, required: true },
    perfil: profileSchema,
    historial_respuestas: [historySchema],
    fecha_registro: { type: Date, default: Date.now },
    ultimo_login: { type: Date },
    estado_cuenta: { type: String, enum: ['pendiente', 'activo', 'inactivo', 'suspendido'], default: 'pendiente' },
    email_verificado: { type: Boolean, default: false },
    token_verificacion: { type: String },
    fecha_expiracion_token: { type: Date },
    activo: { type: Boolean, default: false },
    codigo_verificacion: { type: String, maxlength: 100 },
    fecha_verificacion: { type: Date },
    googleId: { type: String, sparse: true, unique: true },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    acceptedTerms: { type: Boolean, required: true, default: false },
    acceptedTermsDate: { type: Date },
    activeSessions: [sessionSchema]
});

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

class User extends BaseModel {
    #username; #email; #contrasena_hash; #perfil; #historial_respuestas;
    #fecha_registro; #ultimo_login; #estado_cuenta; #email_verificado; #token_verificacion;
    #fecha_expiracion_token; #activo; #codigo_verificacion; #fecha_verificacion;
    #googleId; #passwordResetToken; #passwordResetExpires; #acceptedTerms; #acceptedTermsDate;
    #activeSessions;

    constructor(data = {}) {
        super(data);
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        this.#username = plainData.username;
        this.#email = plainData.email;
        this.#contrasena_hash = plainData.contrasena_hash;
        this.#perfil = new Profile(plainData.perfil || {});
        this.#historial_respuestas = (plainData.historial_respuestas || []).map(h => new AnswerHistory(h));
        this.#fecha_registro = plainData.fecha_registro || new Date();
        this.#ultimo_login = plainData.ultimo_login;
        this.#estado_cuenta = plainData.estado_cuenta || 'pendiente';
        this.#email_verificado = plainData.email_verificado !== undefined ? plainData.email_verificado : false;
        this.#token_verificacion = plainData.token_verificacion;
        this.#fecha_expiracion_token = plainData.fecha_expiracion_token;
        this.#activo = plainData.activo || false;
        this.#codigo_verificacion = plainData.codigo_verificacion;
        this.#fecha_verificacion = plainData.fecha_verificacion;
        this.#googleId = plainData.googleId;
        this.#passwordResetToken = plainData.passwordResetToken;
        this.#passwordResetExpires = plainData.passwordResetExpires;
        this.#acceptedTerms = plainData.acceptedTerms !== undefined ? plainData.acceptedTerms : false;
        this.#acceptedTermsDate = plainData.acceptedTermsDate;
        this.#activeSessions = plainData.activeSessions || [];
        debug('Usuario creado: %s (%s)', this.#username, this.#email);
    }

    get username() { return this.#username; }
    set username(value) { if (!value || value.length > 50) throw new Error('Username es obligatorio y no puede exceder 50 caracteres'); this.#username = value; }

    get email() { return this.#email; }
    set email(value) { if (!value || value.length > 255) throw new Error('Email es obligatorio y no puede exceder 255 caracteres'); this.#email = value; }

    get contrasena_hash() { return this.#contrasena_hash; }
    set contrasena_hash(value) { if (!value) throw new Error('La contraseña hash es obligatoria'); this.#contrasena_hash = value; }

    get perfil() { return this.#perfil; }
    set perfil(value) { this.#perfil = new Profile(value); }

    get historial_respuestas() { return this.#historial_respuestas; }
    set historial_respuestas(value) { this.#historial_respuestas = (value || []).map(h => new AnswerHistory(h)); }

    get fecha_registro() { return this.#fecha_registro; }
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
    set token_verificacion(value) { this.#token_verificacion = value; }

    get fecha_expiracion_token() { return this.#fecha_expiracion_token; }
    set fecha_expiracion_token(value) { this.#fecha_expiracion_token = value; }

    get activo() { return this.#activo; }
    set activo(value) { this.#activo = Boolean(value); }

    get codigo_verificacion() { return this.#codigo_verificacion; }
    set codigo_verificacion(value) { this.#codigo_verificacion = value; }

    get fecha_verificacion() { return this.#fecha_verificacion; }
    set fecha_verificacion(value) { this.#fecha_verificacion = value; }

    get googleId() { return this.#googleId; }
    set googleId(value) { this.#googleId = value; }

    get passwordResetToken() { return this.#passwordResetToken; }
    set passwordResetToken(value) { this.#passwordResetToken = value; }

    get passwordResetExpires() { return this.#passwordResetExpires; }
    set passwordResetExpires(value) { this.#passwordResetExpires = value; }

    get acceptedTerms() { return this.#acceptedTerms; }
    set acceptedTerms(value) { this.#acceptedTerms = Boolean(value); }

    get acceptedTermsDate() { return this.#acceptedTermsDate; }
    set acceptedTermsDate(value) { this.#acceptedTermsDate = value; }

    get activeSessions() { return [...this.#activeSessions]; }

    activate() {
        debug('Activando usuario: %s', this.#username);
        this.#activo = true;
        this.#fecha_verificacion = new Date();
        this.#codigo_verificacion = null;
        this.#email_verificado = true;
        this.#estado_cuenta = 'activo';
    }

    deactivate() {
        debug('Desactivando usuario: %s', this.#username);
        this.#activo = false;
        this.#estado_cuenta = 'inactivo';
    }

    isActive() { return this.#activo === true; }
    isPending() { return this.#estado_cuenta === 'pendiente'; }
    isSuspended() { return this.#estado_cuenta === 'suspendido'; }

    generateAuthToken() {
        debug('Generando token JWT para usuario: %s', this.#username);
        const token = jwt.sign(
            { _id: this._id, username: this.#username, email: this.#email },
            config.get('jwtPrivateKey'),
            { expiresIn: '24h' }
        );
        return token;
    }

    verifyEmail(code) {
        debug('Verificando email con código para: %s', this.#username);
        if (this.#codigo_verificacion !== code) return false;
        this.activate();
        return true;
    }

    updateLogin() {
        this.#ultimo_login = new Date();
        debug('Login actualizado para usuario: %s', this.#username);
    }

    getTotalPoints() { return this.#perfil.getTotalPoints(); }
    getLevel() { return this.#perfil.getLevel(); }
    addPoints(points) {
        debug('Agregando %d puntos a usuario: %s', points, this.#username);
        this.#perfil.addPoints(points);
    }
    levelUp() { this.#perfil.levelUp(); }
    updateLevel(level) { this.#perfil.updateLevel(level); }
    setAvatar(avatarId) { this.#perfil.setAvatar(avatarId); }
    getAvatarId() { return this.#perfil.getAvatarId(); }

    updateAnswerHistory(preguntaId, respuestaId, esCorrecta, tiempoRespuesta = 0, puntosObtenidos = 0) {
        if (!this.#historial_respuestas) this.#historial_respuestas = [];
        const newHistory = new AnswerHistory({
            pregunta_id: preguntaId,
            respuesta_id: respuestaId,
            correcta: esCorrecta,
            tiempo_respuesta_seg: tiempoRespuesta,
            puntos_obtenidos: puntosObtenidos,
            fecha_respuesta: new Date()
        });
        this.#historial_respuestas.push(newHistory);
        debug('Historial de respuestas actualizado para usuario: %s', this.#username);
    }

    getAccuracy() {
        if (!this.#historial_respuestas || this.#historial_respuestas.length === 0) return 0;
        const totalCorrect = this.#historial_respuestas.filter(h => h.correcta).length;
        const total = this.#historial_respuestas.length;
        return total > 0 ? (totalCorrect / total) * 100 : 0;
    }

    getTotalAnswers() {
        return this.#historial_respuestas ? this.#historial_respuestas.length : 0;
    }

    addSession(sessionData) {
        if (!this.#activeSessions) this.#activeSessions = [];
        // Remover sesión duplicada del mismo dispositivo/navegador/IP
        this.#activeSessions = this.#activeSessions.filter(s => 
            !(s.device === sessionData.device && 
              s.browser === sessionData.browser &&
              s.ip === sessionData.ip)
        );
        this.#activeSessions.push(sessionData);
        debug('Sesión agregada para usuario: %s', this.#username);
    }

    removeSession(token) {
        this.#activeSessions = this.#activeSessions.filter(s => s.token !== token);
        debug('Sesión removida para usuario: %s', this.#username);
    }

    clearAllSessions() {
        this.#activeSessions = [];
        debug('Todas las sesiones eliminadas para usuario: %s', this.#username);
    }

    getActiveSessionCount() {
        return this.#activeSessions ? this.#activeSessions.length : 0;
    }

    acceptTerms() {
        this.#acceptedTerms = true;
        this.#acceptedTermsDate = new Date();
        debug('Términos aceptados por usuario: %s', this.#username);
    }

    setPasswordResetToken(token, expiresInHours = 1) {
        this.#passwordResetToken = token;
        this.#passwordResetExpires = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
        debug('Token de reseteo de contraseña establecido para: %s', this.#username);
    }

    clearPasswordResetToken() {
        this.#passwordResetToken = null;
        this.#passwordResetExpires = null;
    }

    isPasswordResetTokenValid() {
        return this.#passwordResetToken && this.#passwordResetExpires && this.#passwordResetExpires > new Date();
    }

    static createEmpty() {
        return new User({
            username: '', email: '', contrasena_hash: '', perfil: Profile.createEmpty().toObject(),
            historial_respuestas: [], activo: false
        });
    }

    static validate(user) {
        return Joi.object({
            username: Joi.string().min(3).max(50).required(),
            email: Joi.string().email().min(5).max(255).required(),
            password: Joi.string().min(5).max(1024).required(),
            googleId: Joi.string(),
            acceptedTerms: Joi.boolean()
        }).validate(user);
    }

    static get Model() { return UserModel; }
    static get debug() { return debug; }

    toObject() {
        return {
            ...buildObject(this, [
                'username', 'email', 'contrasena_hash', 'perfil', 'historial_respuestas',
                'fecha_registro', 'ultimo_login', 'estado_cuenta', 'email_verificado',
                'token_verificacion', 'fecha_expiracion_token', 'activo', 'codigo_verificacion',
                'fecha_verificacion', 'googleId', 'passwordResetToken', 'passwordResetExpires',
                'acceptedTerms', 'acceptedTermsDate'
            ]),
            activeSessions: this.#activeSessions
        };
    }

    toDTO() {
        return {
            id: this._id,
            username: this.#username,
            email: this.#email,
            perfil: this.#perfil.toObject(),
            activo: this.#activo,
            estadoCuenta: this.#estado_cuenta,
            emailVerificado: this.#email_verificado,
            fecha_registro: this.#fecha_registro,
            ultimo_login: this.#ultimo_login,
            nivel: this.getLevel(),
            puntosTotales: this.getTotalPoints(),
            precision: this.getAccuracy(),
            totalRespuestas: this.getTotalAnswers(),
            sesionesActivas: this.getActiveSessionCount(),
            googleConnected: !!this.#googleId,
            acceptedTerms: this.#acceptedTerms
        };
    }

    toString() {
        return `${this.#username} (${this.#email}) - Nivel ${this.getLevel()}`;
    }
}

function validateUser(user) {
    return User.validate(user);
}

exports.User = User;
exports.validate = validateUser;
