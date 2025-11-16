const Joi = require('joi');
const mongoose = require('mongoose');

// Schema de respuestas
const answerSchema = new mongoose.Schema({
    pregunta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    texto_respuesta: { type: String, required: true },
    es_correcta: { type: Boolean, default: false }
});

// Modelo de Mongoose
// Check if model already exists to avoid overwriting
const AnswerModel = mongoose.models.Answer || mongoose.model('Answer', answerSchema);

// Clase de dominio
class Answer {
    constructor(data = {}) {
        // Handle Mongoose document or plain object
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.pregunta_id = plainData.pregunta_id;
        this.texto_respuesta = plainData.texto_respuesta;
        this.es_correcta = plainData.es_correcta !== undefined ? plainData.es_correcta : false;
        
        // Copy Mongoose-specific fields
        if (plainData._id) this._id = plainData._id;
        if (plainData.__v !== undefined) this.__v = plainData.__v;
    }

    // Método estático de validación
    static validate(answer) {
        const schema = Joi.object({
            pregunta_id: Joi.string().required(),
            texto_respuesta: Joi.string().required(),
            es_correcta: Joi.boolean()
        });

        return schema.validate(answer);
    }

    // Método de instancia para guardar
    async save() {
        if (this._id) {
            // Update existing document
            const updateData = this.toObject();
            // Remove _id and __v from update data (Mongoose handles these)
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await AnswerModel.findByIdAndUpdate(
                this._id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`Answer with _id ${this._id} not found`);
            }
            
            // Update instance with saved data
            this._id = updated._id;
            this.__v = updated.__v;
            return updated;
        } else {
            // Insert new document
            const doc = new AnswerModel(this.toObject());
            const saved = await doc.save();
            // Update instance with saved data
            this._id = saved._id;
            this.__v = saved.__v;
            return saved;
        }
    }

    // Exponer el modelo de Mongoose para queries complejas (populate, select, etc.)
    static get Model() {
        if (!AnswerModel) {
            throw new Error('AnswerModel is not initialized. Make sure mongoose is connected.');
        }
        return AnswerModel;
    }

    // Métodos estáticos de consulta
    static async find(query = {}) {
        if (!AnswerModel) {
            throw new Error('AnswerModel is not initialized. Make sure mongoose is connected.');
        }
        const docs = await AnswerModel.find(query);
        return docs.map(doc => new Answer(doc.toObject()));
    }

    static async findOne(query) {
        const doc = await AnswerModel.findOne(query);
        return doc ? new Answer(doc.toObject()) : null;
    }

    static async findById(id) {
        const doc = await AnswerModel.findById(id);
        return doc ? new Answer(doc.toObject()) : null;
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await AnswerModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return doc ? new Answer(doc.toObject()) : null;
    }

    static async findByIdAndDelete(id) {
        const doc = await AnswerModel.findByIdAndDelete(id);
        return doc ? new Answer(doc.toObject()) : null;
    }

    static async create(data) {
        const doc = new AnswerModel(data);
        const saved = await doc.save();
        return new Answer(saved.toObject());
    }

    // Método para convertir a objeto plano (útil para compatibilidad)
    toObject() {
        const obj = {};
        
        // Only include defined fields
        if (this._id !== undefined) obj._id = this._id;
        if (this.pregunta_id !== undefined) obj.pregunta_id = this.pregunta_id;
        if (this.texto_respuesta !== undefined) obj.texto_respuesta = this.texto_respuesta;
        if (this.es_correcta !== undefined) obj.es_correcta = this.es_correcta;
        if (this.__v !== undefined) obj.__v = this.__v;
        
        return obj;
    }
}

module.exports = Answer;
