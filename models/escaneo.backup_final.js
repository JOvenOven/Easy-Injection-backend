const Joi = require('joi');
const mongoose = require('mongoose');
const debug = require('debug')('easyinjection:models:scan');
const { ScanFlags, Credentials, UserAnswer, Score } = require('./value-objects/scan-value-objects');

// Mongoose Schemas
const userAnswerSchema = new mongoose.Schema({
    pregunta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    respuesta_seleccionada_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer', required: true },
    es_correcta: { type: Boolean, required: true },
    puntos_obtenidos: { type: Number, default: 0 }
});

const scanSchema = new mongoose.Schema({
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    alias: { type: String, maxlength: 150, required: true },
    url: { type: String, maxlength: 255, required: true },
    flags: {
        xss: { type: Boolean, default: false },
        sqli: { type: Boolean, default: false }
    },
    tipo_autenticacion: { type: mongoose.Schema.Types.ObjectId, ref: 'AuthType' },
    credenciales: {
        usuario_login: { type: String, maxlength: 100 },
        password_login: { type: String, maxlength: 255 }
    },
    estado: { 
        type: String, 
        enum: ['pendiente', 'en_progreso', 'finalizado', 'error'], 
        default: 'pendiente' 
    },
    gestor: { type: mongoose.Schema.Types.ObjectId, ref: 'GestorBD' },
    fecha_inicio: { type: Date, default: Date.now },
    fecha_fin: { type: Date },
    cookie: { type: String, maxlength: 255 },
    vulnerabilidades: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vulnerability' }],
    respuestas_usuario: [userAnswerSchema],
    puntuacion: {
        puntos_cuestionario: { type: Number, default: 0 },
        total_puntos_cuestionario: { type: Number, default: 0 },
        vulnerabilidades_encontradas: { type: Number, default: 0 },
        puntuacion_final: { type: Number, default: 0 },
        calificacion: { type: String, enum: ['Excelente', 'Bueno', 'Regular', 'Deficiente', 'Crítico'], default: 'Regular' }
    }
});

const ScanModel = mongoose.models.Scan || mongoose.model('Scan', scanSchema);

// Domain Class
class Scan {
    #usuario_id;
    #alias;
    #url;
    #flags;
    #tipo_autenticacion;
    #credenciales;
    #estado;
    #gestor;
    #fecha_inicio;
    #fecha_fin;
    #cookie;
    #vulnerabilidades;
    #respuestas_usuario;
    #puntuacion;
    #id;
    #version;

    constructor(data = {}) {
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.#usuario_id = plainData.usuario_id;
        this.#alias = plainData.alias;
        this.#url = plainData.url;
        this.#flags = new ScanFlags(plainData.flags || {});
        this.#tipo_autenticacion = plainData.tipo_autenticacion;
        this.#credenciales = new Credentials(plainData.credenciales || {});
        this.#estado = plainData.estado || 'pendiente';
        this.#gestor = plainData.gestor;
        this.#fecha_inicio = plainData.fecha_inicio;
        this.#fecha_fin = plainData.fecha_fin;
        this.#cookie = plainData.cookie;
        this.#vulnerabilidades = plainData.vulnerabilidades || [];
        this.#respuestas_usuario = (plainData.respuestas_usuario || []).map(ua => new UserAnswer(ua));
        this.#puntuacion = new Score(plainData.puntuacion || {});
        this.#id = plainData._id;
        this.#version = plainData.__v;
    }

    get usuario_id() { return this.#usuario_id; }
    set usuario_id(value) {
        if (!value) throw new Error('El ID del usuario es obligatorio');
        this.#usuario_id = value;
    }

    get alias() { return this.#alias; }
    set alias(value) {
        if (!value || value.length > 150) throw new Error('El alias es obligatorio y no puede exceder 150 caracteres');
        this.#alias = value;
    }

    get url() { return this.#url; }
    set url(value) {
        if (!value || value.length > 255) throw new Error('La URL es obligatoria y no puede exceder 255 caracteres');
        this.#url = value;
    }

    get flags() { return this.#flags; }
    set flags(value) { this.#flags = new ScanFlags(value); }

    get tipo_autenticacion() { return this.#tipo_autenticacion; }
    set tipo_autenticacion(value) { this.#tipo_autenticacion = value; }

    get credenciales() { return this.#credenciales; }
    set credenciales(value) { this.#credenciales = new Credentials(value); }

    get estado() { return this.#estado; }
    set estado(value) {
        const validStates = ['pendiente', 'en_progreso', 'finalizado', 'error'];
        if (!validStates.includes(value)) throw new Error(`Estado inválido: ${value}`);
        this.#estado = value;
    }

    get gestor() { return this.#gestor; }
    set gestor(value) { this.#gestor = value; }

    get fecha_inicio() { return this.#fecha_inicio; }
    set fecha_inicio(value) { this.#fecha_inicio = value; }

    get fecha_fin() { return this.#fecha_fin; }
    set fecha_fin(value) { this.#fecha_fin = value; }

    get cookie() { return this.#cookie; }
    set cookie(value) {
        if (value && value.length > 255) throw new Error('La cookie no puede exceder 255 caracteres');
        this.#cookie = value;
    }

    get vulnerabilidades() { return this.#vulnerabilidades; }
    set vulnerabilidades(value) { this.#vulnerabilidades = value || []; }

    get respuestas_usuario() { return this.#respuestas_usuario; }
    set respuestas_usuario(value) {
        this.#respuestas_usuario = (value || []).map(ua => new UserAnswer(ua));
    }

    get puntuacion() { return this.#puntuacion; }
    set puntuacion(value) { this.#puntuacion = new Score(value); }

    get _id() { return this.#id; }
    get __v() { return this.#version; }

    isPending() {
        return this.#estado === 'pendiente';
    }

    isInProgress() {
        return this.#estado === 'en_progreso';
    }

    isFinished() {
        return this.#estado === 'finalizado';
    }

    hasError() {
        return this.#estado === 'error';
    }

    start() {
        debug('start: starting scan');
        this.#estado = 'en_progreso';
        this.#fecha_inicio = new Date();
    }

    finish() {
        debug('finish: scan completed');
        this.#estado = 'finalizado';
        this.#fecha_fin = new Date();
    }

    markAsError() {
        this.#estado = 'error';
        this.#fecha_fin = new Date();
    }

    getDuration() {
        if (!this.#fecha_inicio) return 0;
        const end = this.#fecha_fin || new Date();
        return Math.round((end - this.#fecha_inicio) / 1000);
    }

    hasVulnerabilities() {
        return this.#vulnerabilidades && this.#vulnerabilidades.length > 0;
    }

    getVulnerabilityCount() {
        return this.#vulnerabilidades ? this.#vulnerabilidades.length : 0;
    }

    addVulnerability(vulnId) {
        if (!this.#vulnerabilidades) this.#vulnerabilidades = [];
        this.#vulnerabilidades.push(vulnId);
        this.#puntuacion.addVulnerability();
    }

    addUserAnswer(answer) {
        if (!this.#respuestas_usuario) this.#respuestas_usuario = [];
        const userAnswer = new UserAnswer(answer);
        this.#respuestas_usuario.push(userAnswer);
        if (userAnswer.isCorrect()) {
            this.#puntuacion.addQuestionPoints(userAnswer.puntos_obtenidos);
        }
    }

    calculateScore() {
        debug('calculateScore: calculating final score');
        return this.#puntuacion.calculateFinalScore();
    }

    requiresAuthentication() {
        return Boolean(this.#tipo_autenticacion);
    }

    hasCredentials() {
        return this.#credenciales.hasCredentials();
    }

    static fromMongoose(mongooseDoc) {
        if (!mongooseDoc) return null;
        debug('fromMongoose: converting to Scan');
        return new Scan(mongooseDoc.toObject());
    }

    static build(data) {
        return new Scan(data);
    }

    static createEmpty(usuarioId) {
        return new Scan({
            usuario_id: usuarioId,
            alias: '',
            url: '',
            flags: ScanFlags.createEmpty().toObject(),
            credenciales: Credentials.createEmpty().toObject(),
            estado: 'pendiente',
            vulnerabilidades: [],
            respuestas_usuario: [],
            puntuacion: Score.createEmpty().toObject()
        });
    }

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

    async save() {
        if (this.#id) {
            debug('save: updating Scan %s', this.#id);
            const updateData = this.toObject();
            debug('save: updateData = %O', updateData);
            delete updateData._id;
            delete updateData.__v;
            
            debug('save: calling findByIdAndUpdate...');
            const updated = await ScanModel.findByIdAndUpdate(
                this.#id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            debug('save: update result = %O', updated ? 'SUCCESS' : 'NULL');
            
            if (!updated) {
                throw new Error(`Scan with _id ${this.#id} not found`);
            }
            
            this.#id = updated._id;
            this.#version = updated.__v;
            debug('save: Scan updated successfully');
            return updated;
        } else {
            debug('save: creating new Scan');
            const doc = new ScanModel(this.toObject());
            const saved = await doc.save();
            this.#id = saved._id;
            this.#version = saved.__v;
            debug('save: Scan created with _id %s', saved._id);
            return saved;
        }
    }

    static get Model() {
        return ScanModel;
    }

    static async find(query = {}) {
        const docs = await ScanModel.find(query);
        return docs.map(doc => Scan.fromMongoose(doc));
    }

    static async findOne(query) {
        const doc = await ScanModel.findOne(query);
        return Scan.fromMongoose(doc);
    }

    static async findById(id) {
        const doc = await ScanModel.findById(id);
        return Scan.fromMongoose(doc);
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await ScanModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return Scan.fromMongoose(doc);
    }

    static async findByIdAndDelete(id) {
        const doc = await ScanModel.findByIdAndDelete(id);
        return Scan.fromMongoose(doc);
    }

    static async findOneAndUpdate(query, update, options = {}) {
        const doc = await ScanModel.findOneAndUpdate(query, update, { new: true, ...options });
        return Scan.fromMongoose(doc);
    }

    static async findOneAndDelete(query) {
        const doc = await ScanModel.findOneAndDelete(query);
        return Scan.fromMongoose(doc);
    }

    static async create(data) {
        const doc = new ScanModel(data);
        const saved = await doc.save();
        return Scan.fromMongoose(saved);
    }

    toObject() {
        const obj = {};
        if (this.#id !== undefined) obj._id = this.#id;
        if (this.#usuario_id !== undefined) obj.usuario_id = this.#usuario_id;
        if (this.#alias !== undefined) obj.alias = this.#alias;
        if (this.#url !== undefined) obj.url = this.#url;
        if (this.#flags !== undefined) obj.flags = this.#flags.toObject();
        if (this.#tipo_autenticacion !== undefined) obj.tipo_autenticacion = this.#tipo_autenticacion;
        if (this.#credenciales !== undefined) obj.credenciales = this.#credenciales.toObject();
        if (this.#estado !== undefined) obj.estado = this.#estado;
        if (this.#gestor !== undefined) obj.gestor = this.#gestor;
        if (this.#fecha_inicio !== undefined) obj.fecha_inicio = this.#fecha_inicio;
        if (this.#fecha_fin !== undefined) obj.fecha_fin = this.#fecha_fin;
        if (this.#cookie !== undefined) obj.cookie = this.#cookie;
        if (this.#vulnerabilidades !== undefined) obj.vulnerabilidades = this.#vulnerabilidades;
        if (this.#respuestas_usuario !== undefined) obj.respuestas_usuario = this.#respuestas_usuario.map(ua => ua.toObject());
        if (this.#puntuacion !== undefined) obj.puntuacion = this.#puntuacion.toObject();
        if (this.#version !== undefined) obj.__v = this.#version;
        return obj;
    }

    toPersistence() {
        return this.toObject();
    }

    toDTO() {
        return {
            id: this.#id,
            usuarioId: this.#usuario_id,
            alias: this.#alias,
            url: this.#url,
            flags: this.#flags.getEnabledFlags(),
            estado: this.#estado,
            fechaInicio: this.#fecha_inicio,
            fechaFin: this.#fecha_fin,
            duracion: this.getDuration(),
            vulnerabilidades: this.getVulnerabilityCount(),
            puntuacionFinal: this.#puntuacion.puntuacion_final,
            calificacion: this.#puntuacion.calificacion,
            quizPercentage: this.#puntuacion.getQuizPercentage()
        };
    }

    toString() {
        return `[${this.#estado.toUpperCase()}] ${this.#alias}: ${this.#url} (${this.getVulnerabilityCount()} vulns)`;
    }
}

module.exports = Scan;
module.exports.ScanFlags = ScanFlags;
module.exports.Credentials = Credentials;
module.exports.UserAnswer = UserAnswer;
module.exports.Score = Score;
