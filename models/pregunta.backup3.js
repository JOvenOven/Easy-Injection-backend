const Joi = require('joi');
const mongoose = require('mongoose');
const debug = require('debug')('easyinjection:models:question');

const questionSchema = new mongoose.Schema({
    texto_pregunta: { type: String, required: true },
    dificultad: { 
        type: String, 
        enum: ['facil', 'media', 'dificil'], 
        required: true 
    },
    puntos: { type: Number, required: true },
    fase: {
        type: String,
        enum: ['init', 'discovery', 'parameters', 'sqli-detection', 'sqli-fingerprint', 'sqli-exploit', 'sqli', 'xss-context', 'xss-fuzzing', 'xss'],
        required: true
    }
});

const QuestionModel = mongoose.models.Question || mongoose.model('Question', questionSchema);

class Question {
    #texto_pregunta;
    #dificultad;
    #puntos;
    #fase;
    #id;
    #version;

    constructor(data = {}) {
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.#texto_pregunta = plainData.texto_pregunta;
        this.#dificultad = plainData.dificultad;
        this.#puntos = plainData.puntos;
        this.#fase = plainData.fase;
        this.#id = plainData._id;
        this.#version = plainData.__v;
    }

    get texto_pregunta() {
        return this.#texto_pregunta;
    }

    set texto_pregunta(value) {
        if (!value || value.trim().length === 0) {
            throw new Error('El texto de la pregunta es obligatorio');
        }
        this.#texto_pregunta = value;
    }

    get dificultad() {
        return this.#dificultad;
    }

    set dificultad(value) {
        const validValues = ['facil', 'media', 'dificil'];
        if (!validValues.includes(value)) {
            throw new Error(`Dificultad inválida. Debe ser uno de: ${validValues.join(', ')}`);
        }
        this.#dificultad = value;
    }

    get puntos() {
        return this.#puntos;
    }

    set puntos(value) {
        if (typeof value !== 'number' || value < 1) {
            throw new Error('Los puntos deben ser un número mayor o igual a 1');
        }
        this.#puntos = value;
    }

    get fase() {
        return this.#fase;
    }

    set fase(value) {
        const validValues = ['init', 'discovery', 'parameters', 'sqli-detection', 'sqli-fingerprint', 'sqli-exploit', 'sqli', 'xss-context', 'xss-fuzzing', 'xss'];
        if (!validValues.includes(value)) {
            throw new Error(`Fase inválida. Debe ser uno de: ${validValues.join(', ')}`);
        }
        this.#fase = value;
    }

    get _id() {
        return this.#id;
    }

    get __v() {
        return this.#version;
    }

    getDifficultyMultiplier() {
        const multipliers = {
            'facil': 1.0,
            'media': 1.5,
            'dificil': 2.0
        };
        return multipliers[this.#dificultad] || 1.0;
    }

    getPhaseCategory() {
        const sqliPhases = ['sqli-detection', 'sqli-fingerprint', 'sqli-exploit', 'sqli'];
        const xssPhases = ['xss-context', 'xss-fuzzing', 'xss'];
        
        if (sqliPhases.includes(this.#fase)) return 'sqli';
        if (xssPhases.includes(this.#fase)) return 'xss';
        return 'general';
    }

    isForPhase(phase) {
        return this.#fase === phase;
    }

    getAdjustedPoints() {
        return Math.round(this.#puntos * this.getDifficultyMultiplier());
    }

    isSQLiQuestion() {
        return this.getPhaseCategory() === 'sqli';
    }

    isXSSQuestion() {
        return this.getPhaseCategory() === 'xss';
    }

    getDisplayDifficulty() {
        const display = {
            'facil': 'Fácil',
            'media': 'Media',
            'dificil': 'Difícil'
        };
        return display[this.#dificultad] || this.#dificultad;
    }

    static fromMongoose(mongooseDoc) {
        if (!mongooseDoc) return null;
        debug('fromMongoose: converting to Question');
        return new Question(mongooseDoc.toObject());
    }

    static build(data) {
        return new Question(data);
    }

    static createEmpty() {
        return new Question({ 
            texto_pregunta: '', 
            dificultad: 'facil', 
            puntos: 10,
            fase: 'init'
        });
    }

    static forPhase(phase, difficulty = 'facil') {
        return new Question({
            texto_pregunta: '',
            dificultad: difficulty,
            puntos: 10,
            fase: phase
        });
    }

    static validate(question) {
        const schema = Joi.object({
            texto_pregunta: Joi.string().required(),
            dificultad: Joi.string().valid('facil', 'media', 'dificil').required(),
            puntos: Joi.number().min(1).required(),
            fase: Joi.string().valid('init', 'discovery', 'parameters', 'sqli-detection', 'sqli-fingerprint', 'sqli-exploit', 'sqli', 'xss-context', 'xss-fuzzing', 'xss').required()
        });

        return schema.validate(question);
    }

    async save() {
        if (this.#id) {
            debug('save: updating Question %s', this.#id);
            const updateData = this.toObject();
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await QuestionModel.findByIdAndUpdate(
                this.#id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`Question with _id ${this.#id} not found`);
            }
            
            this.#id = updated._id;
            this.#version = updated.__v;
            return updated;
        } else {
            const doc = new QuestionModel(this.toObject());
            const saved = await doc.save();
            this.#id = saved._id;
            this.#version = saved.__v;
            return saved;
        }
    }

    static get Model() {
        if (!QuestionModel) {
            throw new Error('QuestionModel is not initialized. Make sure mongoose is connected.');
        }
        return QuestionModel;
    }

    static async find(query = {}) {
        if (!QuestionModel) {
            throw new Error('QuestionModel is not initialized. Make sure mongoose is connected.');
        }
        const docs = await QuestionModel.find(query);
        return docs.map(doc => Question.fromMongoose(doc));
    }

    static async findOne(query) {
        const doc = await QuestionModel.findOne(query);
        return Question.fromMongoose(doc);
    }

    static async findById(id) {
        const doc = await QuestionModel.findById(id);
        return Question.fromMongoose(doc);
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await QuestionModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return Question.fromMongoose(doc);
    }

    static async findByIdAndDelete(id) {
        const doc = await QuestionModel.findByIdAndDelete(id);
        return Question.fromMongoose(doc);
    }

    static async create(data) {
        const doc = new QuestionModel(data);
        const saved = await doc.save();
        return Question.fromMongoose(saved);
    }

    static async random(phase) {
        debug('random: getting random question for phase %s', phase);
        const count = await QuestionModel.countDocuments({ fase: phase });
        if (count === 0) return null;
        
        const random = Math.floor(Math.random() * count);
        const doc = await QuestionModel.findOne({ fase: phase }).skip(random);
        return Question.fromMongoose(doc);
    }

    toObject() {
        const obj = {};
        if (this.#id !== undefined) obj._id = this.#id;
        if (this.#texto_pregunta !== undefined) obj.texto_pregunta = this.#texto_pregunta;
        if (this.#dificultad !== undefined) obj.dificultad = this.#dificultad;
        if (this.#puntos !== undefined) obj.puntos = this.#puntos;
        if (this.#fase !== undefined) obj.fase = this.#fase;
        if (this.#version !== undefined) obj.__v = this.#version;
        return obj;
    }

    toPersistence() {
        return this.toObject();
    }

    toDTO() {
        return {
            id: this.#id,
            texto: this.#texto_pregunta,
            dificultad: this.#dificultad,
            displayDifficulty: this.getDisplayDifficulty(),
            puntos: this.#puntos,
            puntosAjustados: this.getAdjustedPoints(),
            fase: this.#fase,
            categoria: this.getPhaseCategory(),
            multiplicador: this.getDifficultyMultiplier()
        };
    }

    toString() {
        return `[${this.#dificultad.toUpperCase()}] ${this.#texto_pregunta.substring(0, 50)}... (${this.#puntos} pts - ${this.#fase})`;
    }
}

module.exports = Question;
