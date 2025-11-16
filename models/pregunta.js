const Joi = require('joi');
const mongoose = require('mongoose');

// Schema de preguntas
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

// Modelo de Mongoose
// Check if model already exists to avoid overwriting
const QuestionModel = mongoose.models.Question || mongoose.model('Question', questionSchema);

// Clase de dominio
class Question {
    constructor(data = {}) {
        // Handle Mongoose document or plain object
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.texto_pregunta = plainData.texto_pregunta;
        this.dificultad = plainData.dificultad;
        this.puntos = plainData.puntos;
        this.fase = plainData.fase;
        
        // Copy Mongoose-specific fields
        if (plainData._id) this._id = plainData._id;
        if (plainData.__v !== undefined) this.__v = plainData.__v;
    }

    // Método estático de validación
    static validate(question) {
        const schema = Joi.object({
            texto_pregunta: Joi.string().required(),
            dificultad: Joi.string().valid('facil', 'media', 'dificil').required(),
            puntos: Joi.number().min(1).required(),
            fase: Joi.string().valid('init', 'discovery', 'parameters', 'sqli-detection', 'sqli-fingerprint', 'sqli-exploit', 'sqli', 'xss-context', 'xss-fuzzing', 'xss').required()
        });

        return schema.validate(question);
    }

    // Método de instancia para guardar
    async save() {
        if (this._id) {
            // Update existing document
            const updateData = this.toObject();
            // Remove _id and __v from update data (Mongoose handles these)
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await QuestionModel.findByIdAndUpdate(
                this._id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`Question with _id ${this._id} not found`);
            }
            
            // Update instance with saved data
            this._id = updated._id;
            this.__v = updated.__v;
            return updated;
        } else {
            // Insert new document
            const doc = new QuestionModel(this.toObject());
            const saved = await doc.save();
            // Update instance with saved data
            this._id = saved._id;
            this.__v = saved.__v;
            return saved;
        }
    }

    // Exponer el modelo de Mongoose para queries complejas (populate, select, etc.)
    static get Model() {
        if (!QuestionModel) {
            throw new Error('QuestionModel is not initialized. Make sure mongoose is connected.');
        }
        return QuestionModel;
    }

    // Métodos estáticos de consulta
    static async find(query = {}) {
        if (!QuestionModel) {
            throw new Error('QuestionModel is not initialized. Make sure mongoose is connected.');
        }
        const docs = await QuestionModel.find(query);
        return docs.map(doc => new Question(doc.toObject()));
    }

    static async findOne(query) {
        const doc = await QuestionModel.findOne(query);
        return doc ? new Question(doc.toObject()) : null;
    }

    static async findById(id) {
        const doc = await QuestionModel.findById(id);
        return doc ? new Question(doc.toObject()) : null;
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await QuestionModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return doc ? new Question(doc.toObject()) : null;
    }

    static async findByIdAndDelete(id) {
        const doc = await QuestionModel.findByIdAndDelete(id);
        return doc ? new Question(doc.toObject()) : null;
    }

    static async create(data) {
        const doc = new QuestionModel(data);
        const saved = await doc.save();
        return new Question(saved.toObject());
    }

    // Método para convertir a objeto plano (útil para compatibilidad)
    toObject() {
        const obj = {};
        
        // Only include defined fields
        if (this._id !== undefined) obj._id = this._id;
        if (this.texto_pregunta !== undefined) obj.texto_pregunta = this.texto_pregunta;
        if (this.dificultad !== undefined) obj.dificultad = this.dificultad;
        if (this.puntos !== undefined) obj.puntos = this.puntos;
        if (this.fase !== undefined) obj.fase = this.fase;
        if (this.__v !== undefined) obj.__v = this.__v;
        
        return obj;
    }
}

module.exports = Question;
