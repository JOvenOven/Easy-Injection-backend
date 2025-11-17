const Joi = require('joi');
const mongoose = require('mongoose');
const debug = require('debug')('easyinjection:models:question');
const BaseModel = require('./base/BaseModel');
const { buildObject } = require('./base/ModelHelpers');

const questionSchema = new mongoose.Schema({
    texto_pregunta: { type: String, required: true },
    dificultad: { type: String, enum: ['facil', 'media', 'dificil'], required: true },
    puntos: { type: Number, required: true },
    fase: { type: String, enum: ['init', 'discovery', 'parameters', 'sqli-detection', 'sqli-fingerprint', 'sqli-exploit', 'sqli', 'xss-context', 'xss-fuzzing', 'xss'], required: true }
});

const QuestionModel = mongoose.models.Question || mongoose.model('Question', questionSchema);

class Question extends BaseModel {
    #texto_pregunta; #dificultad; #puntos; #fase;

    constructor(data = {}) {
        super(data);
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        this.#texto_pregunta = plainData.texto_pregunta;
        this.#dificultad = plainData.dificultad;
        this.#puntos = plainData.puntos;
        this.#fase = plainData.fase;
    }

    get texto_pregunta() { return this.#texto_pregunta; }
    set texto_pregunta(value) {
        if (!value || value.trim().length === 0) throw new Error('El texto de la pregunta es obligatorio');
        this.#texto_pregunta = value;
    }

    get dificultad() { return this.#dificultad; }
    set dificultad(value) {
        if (!['facil', 'media', 'dificil'].includes(value)) throw new Error('Dificultad inválida. Debe ser facil, media o dificil');
        this.#dificultad = value;
    }

    get puntos() { return this.#puntos; }
    set puntos(value) {
        if (typeof value !== 'number' || value < 1) throw new Error('Los puntos deben ser un número mayor o igual a 1');
        this.#puntos = value;
    }

    get fase() { return this.#fase; }
    set fase(value) {
        const validValues = ['init', 'discovery', 'parameters', 'sqli-detection', 'sqli-fingerprint', 'sqli-exploit', 'sqli', 'xss-context', 'xss-fuzzing', 'xss'];
        if (!validValues.includes(value)) throw new Error('Fase inválida');
        this.#fase = value;
    }

    getDifficultyMultiplier() {
        return { 'facil': 1.0, 'media': 1.5, 'dificil': 2.0 }[this.#dificultad] || 1.0;
    }

    getPhaseCategory() {
        if (['sqli-detection', 'sqli-fingerprint', 'sqli-exploit', 'sqli'].includes(this.#fase)) return 'sqli';
        if (['xss-context', 'xss-fuzzing', 'xss'].includes(this.#fase)) return 'xss';
        return 'general';
    }

    isForPhase(phase) { return this.#fase === phase; }
    getAdjustedPoints() { return Math.round(this.#puntos * this.getDifficultyMultiplier()); }
    isSQLiQuestion() { return this.getPhaseCategory() === 'sqli'; }
    isXSSQuestion() { return this.getPhaseCategory() === 'xss'; }
    getDisplayDifficulty() { return { 'facil': 'Fácil', 'media': 'Media', 'dificil': 'Difícil' }[this.#dificultad] || this.#dificultad; }

    static createEmpty() { return new Question({ texto_pregunta: '', dificultad: 'facil', puntos: 10, fase: 'init' }); }
    static forPhase(phase, difficulty = 'facil') { return new Question({ texto_pregunta: '', dificultad: difficulty, puntos: 10, fase: phase }); }
    static validate(question) {
        return Joi.object({
            texto_pregunta: Joi.string().required(),
            dificultad: Joi.string().valid('facil', 'media', 'dificil').required(),
            puntos: Joi.number().min(1).required(),
            fase: Joi.string().valid('init', 'discovery', 'parameters', 'sqli-detection', 'sqli-fingerprint', 'sqli-exploit', 'sqli', 'xss-context', 'xss-fuzzing', 'xss').required()
        }).validate(question);
    }

    static async random(phase) {
        debug('random: getting random question for phase %s', phase);
        const count = await QuestionModel.countDocuments({ fase: phase });
        if (count === 0) return null;
        const random = Math.floor(Math.random() * count);
        const doc = await QuestionModel.findOne({ fase: phase }).skip(random);
        return Question.fromMongoose(doc);
    }

    static get Model() { return QuestionModel; }
    static get debug() { return debug; }

    toObject() { return buildObject(this, ['texto_pregunta', 'dificultad', 'puntos', 'fase']); }
    toDTO() {
        return { id: this._id, texto: this.#texto_pregunta, dificultad: this.#dificultad, displayDifficulty: this.getDisplayDifficulty(),
            puntos: this.#puntos, puntosAjustados: this.getAdjustedPoints(), fase: this.#fase, categoria: this.getPhaseCategory(), multiplicador: this.getDifficultyMultiplier() };
    }
    toString() { return `[${this.#dificultad.toUpperCase()}] ${this.#texto_pregunta.substring(0, 50)}... (${this.#puntos} pts - ${this.#fase})`; }
}

module.exports = Question;
