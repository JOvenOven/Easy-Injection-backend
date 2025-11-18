const Joi = require('joi');
const mongoose = require('mongoose');
const debug = require('debug')('easyinjection:models:answer');
const BaseModel = require('../base/BaseModel');
const { buildObject } = require('../base/ModelHelpers');

const answerSchema = new mongoose.Schema({
    pregunta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    texto_respuesta: { type: String, required: true },
    es_correcta: { type: Boolean, default: false }
});

const AnswerModel = mongoose.models.Answer || mongoose.model('Answer', answerSchema);

class Answer extends BaseModel {
    #pregunta_id; #texto_respuesta; #es_correcta;

    constructor(data = {}) {
        super(data);
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        this.#pregunta_id = plainData.pregunta_id;
        this.#texto_respuesta = plainData.texto_respuesta;
        this.#es_correcta = plainData.es_correcta !== undefined ? plainData.es_correcta : false;
    }

    get pregunta_id() { return this.#pregunta_id; }
    set pregunta_id(value) {
        if (!value) throw new Error('El ID de la pregunta es obligatorio');
        this.#pregunta_id = value;
    }

    get texto_respuesta() { return this.#texto_respuesta; }
    set texto_respuesta(value) {
        if (!value || value.trim().length === 0) throw new Error('El texto de la respuesta es obligatorio');
        this.#texto_respuesta = value;
    }

    get es_correcta() { return this.#es_correcta; }
    set es_correcta(value) { this.#es_correcta = Boolean(value); }

    isCorrect() { return this.#es_correcta === true; }
    isIncorrect() { return this.#es_correcta === false; }
    getDisplayText() { return this.#texto_respuesta; }

    getPoints(questionPoints, questionDifficulty) {
        if (!this.#es_correcta) return 0;
        const multipliers = { 'facil': 1.0, 'media': 1.5, 'dificil': 2.0 };
        const multiplier = multipliers[questionDifficulty] || 1.0;
        return Math.round(questionPoints * multiplier);
    }

    markAsCorrect() { this.#es_correcta = true; }
    markAsIncorrect() { this.#es_correcta = false; }

    static createEmpty(preguntaId) { return new Answer({ pregunta_id: preguntaId, texto_respuesta: '', es_correcta: false }); }
    static createCorrect(preguntaId, texto) { return new Answer({ pregunta_id: preguntaId, texto_respuesta: texto, es_correcta: true }); }
    static createIncorrect(preguntaId, texto) { return new Answer({ pregunta_id: preguntaId, texto_respuesta: texto, es_correcta: false }); }

    static validate(answer) {
        return Joi.object({
            pregunta_id: Joi.string().required(),
            texto_respuesta: Joi.string().required(),
            es_correcta: Joi.boolean()
        }).validate(answer);
    }

    static async findCorrectAnswer(preguntaId) {
        const doc = await AnswerModel.findOne({ pregunta_id: preguntaId, es_correcta: true });
        return Answer.fromMongoose(doc);
    }

    static get Model() { return AnswerModel; }
    static get debug() { return debug; }

    toObject() { return buildObject(this, ['pregunta_id', 'texto_respuesta', 'es_correcta']); }
    toDTO() { return { 
        _id: this._id,
        id: this._id, 
        pregunta_id: this.#pregunta_id,
        preguntaId: this.#pregunta_id, 
        texto_respuesta: this.#texto_respuesta,
        texto: this.#texto_respuesta, 
        es_correcta: this.#es_correcta,
        esCorrecta: this.#es_correcta, 
        displayText: this.getDisplayText() 
    }; }
    toString() { return `${this.#es_correcta ? '✓' : '✗'} ${this.#texto_respuesta}`; }
}

function validateAnswer(answer) {
    return Answer.validate(answer);
}

exports.Answer = Answer;
exports.validate = validateAnswer;
