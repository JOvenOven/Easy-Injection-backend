const Joi = require('joi');
const mongoose = require('mongoose');
const debug = require('debug')('easyinjection:models:answer');

const answerSchema = new mongoose.Schema({
    pregunta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    texto_respuesta: { type: String, required: true },
    es_correcta: { type: Boolean, default: false }
});

const AnswerModel = mongoose.models.Answer || mongoose.model('Answer', answerSchema);

class Answer {
    #pregunta_id;
    #texto_respuesta;
    #es_correcta;
    #id;
    #version;

    constructor(data = {}) {
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.#pregunta_id = plainData.pregunta_id;
        this.#texto_respuesta = plainData.texto_respuesta;
        this.#es_correcta = plainData.es_correcta !== undefined ? plainData.es_correcta : false;
        this.#id = plainData._id;
        this.#version = plainData.__v;
    }

    get pregunta_id() {
        return this.#pregunta_id;
    }

    set pregunta_id(value) {
        if (!value) {
            throw new Error('El ID de la pregunta es obligatorio');
        }
        this.#pregunta_id = value;
    }

    get texto_respuesta() {
        return this.#texto_respuesta;
    }

    set texto_respuesta(value) {
        if (!value || value.trim().length === 0) {
            throw new Error('El texto de la respuesta es obligatorio');
        }
        this.#texto_respuesta = value;
    }

    get es_correcta() {
        return this.#es_correcta;
    }

    set es_correcta(value) {
        this.#es_correcta = Boolean(value);
    }

    get _id() {
        return this.#id;
    }

    get __v() {
        return this.#version;
    }

    isCorrect() {
        return this.#es_correcta === true;
    }

    isIncorrect() {
        return this.#es_correcta === false;
    }

    getDisplayText() {
        return this.#texto_respuesta;
    }

    getPoints(questionPoints, questionDifficulty) {
        if (!this.#es_correcta) return 0;
        
        const multipliers = {
            'facil': 1.0,
            'media': 1.5,
            'dificil': 2.0
        };
        
        const multiplier = multipliers[questionDifficulty] || 1.0;
        return Math.round(questionPoints * multiplier);
    }

    markAsCorrect() {
        this.#es_correcta = true;
    }

    markAsIncorrect() {
        this.#es_correcta = false;
    }

    static fromMongoose(mongooseDoc) {
        if (!mongooseDoc) return null;
        debug('fromMongoose: converting to Answer');
        return new Answer(mongooseDoc.toObject());
    }

    static build(data) {
        return new Answer(data);
    }

    static createEmpty(preguntaId) {
        return new Answer({ 
            pregunta_id: preguntaId,
            texto_respuesta: '',
            es_correcta: false
        });
    }

    static createCorrect(preguntaId, texto) {
        return new Answer({ 
            pregunta_id: preguntaId,
            texto_respuesta: texto,
            es_correcta: true
        });
    }

    static createIncorrect(preguntaId, texto) {
        return new Answer({ 
            pregunta_id: preguntaId,
            texto_respuesta: texto,
            es_correcta: false
        });
    }

    static validate(answer) {
        const schema = Joi.object({
            pregunta_id: Joi.string().required(),
            texto_respuesta: Joi.string().required(),
            es_correcta: Joi.boolean()
        });

        return schema.validate(answer);
    }

    async save() {
        if (this.#id) {
            debug('save: updating Answer %s', this.#id);
            const updateData = this.toObject();
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await AnswerModel.findByIdAndUpdate(
                this.#id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`Answer with _id ${this.#id} not found`);
            }
            
            this.#id = updated._id;
            this.#version = updated.__v;
            return updated;
        } else {
            const doc = new AnswerModel(this.toObject());
            const saved = await doc.save();
            this.#id = saved._id;
            this.#version = saved.__v;
            return saved;
        }
    }

    static get Model() {
        if (!AnswerModel) {
            throw new Error('AnswerModel is not initialized. Make sure mongoose is connected.');
        }
        return AnswerModel;
    }

    static async find(query = {}) {
        if (!AnswerModel) {
            throw new Error('AnswerModel is not initialized. Make sure mongoose is connected.');
        }
        const docs = await AnswerModel.find(query);
        return docs.map(doc => Answer.fromMongoose(doc));
    }

    static async findOne(query) {
        const doc = await AnswerModel.findOne(query);
        return Answer.fromMongoose(doc);
    }

    static async findById(id) {
        const doc = await AnswerModel.findById(id);
        return Answer.fromMongoose(doc);
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await AnswerModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return Answer.fromMongoose(doc);
    }

    static async findByIdAndDelete(id) {
        const doc = await AnswerModel.findByIdAndDelete(id);
        return Answer.fromMongoose(doc);
    }

    static async create(data) {
        const doc = new AnswerModel(data);
        const saved = await doc.save();
        return Answer.fromMongoose(saved);
    }

    static async findCorrectAnswer(preguntaId) {
        const doc = await AnswerModel.findOne({ pregunta_id: preguntaId, es_correcta: true });
        return Answer.fromMongoose(doc);
    }

    toObject() {
        const obj = {};
        if (this.#id !== undefined) obj._id = this.#id;
        if (this.#pregunta_id !== undefined) obj.pregunta_id = this.#pregunta_id;
        if (this.#texto_respuesta !== undefined) obj.texto_respuesta = this.#texto_respuesta;
        if (this.#es_correcta !== undefined) obj.es_correcta = this.#es_correcta;
        if (this.#version !== undefined) obj.__v = this.#version;
        return obj;
    }

    toPersistence() {
        return this.toObject();
    }

    toDTO() {
        return {
            id: this.#id,
            preguntaId: this.#pregunta_id,
            texto: this.#texto_respuesta,
            esCorrecta: this.#es_correcta,
            displayText: this.getDisplayText()
        };
    }

    toString() {
        const correctMark = this.#es_correcta ? '✓' : '✗';
        return `${correctMark} ${this.#texto_respuesta}`;
    }
}

module.exports = Answer;
