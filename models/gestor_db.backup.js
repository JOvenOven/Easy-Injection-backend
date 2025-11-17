const Joi = require('joi');
const mongoose = require('mongoose');

// Schema de gestores_bd
const gestorBDSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        enum: ['dalfox', 'sqlmap', 'zap', 'otros'], 
        required: true, 
        unique: true 
    },
    descripcion: { type: String, maxlength: 255 }
});

// Modelo de Mongoose
// Check if model already exists to avoid overwriting
const GestorBDModel = mongoose.models.GestorBD || mongoose.model('GestorBD', gestorBDSchema);

// Clase de dominio
class GestorBD {
    constructor(data = {}) {
        // Handle Mongoose document or plain object
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.nombre = plainData.nombre;
        this.descripcion = plainData.descripcion;
        
        // Copy Mongoose-specific fields
        if (plainData._id) this._id = plainData._id;
        if (plainData.__v !== undefined) this.__v = plainData.__v;
    }

    // Método estático de validación
    static validate(gestor) {
        const schema = Joi.object({
            nombre: Joi.string().valid('dalfox', 'sqlmap', 'zap', 'otros').required(),
            descripcion: Joi.string().max(255)
        });

        return schema.validate(gestor);
    }

    // Método de instancia para guardar
    async save() {
        if (this._id) {
            // Update existing document
            const updateData = this.toObject();
            // Remove _id and __v from update data (Mongoose handles these)
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await GestorBDModel.findByIdAndUpdate(
                this._id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`GestorBD with _id ${this._id} not found`);
            }
            
            // Update instance with saved data
            this._id = updated._id;
            this.__v = updated.__v;
            return updated;
        } else {
            // Insert new document
            const doc = new GestorBDModel(this.toObject());
            const saved = await doc.save();
            // Update instance with saved data
            this._id = saved._id;
            this.__v = saved.__v;
            return saved;
        }
    }

    // Exponer el modelo de Mongoose para queries complejas (populate, select, etc.)
    static get Model() {
        return GestorBDModel;
    }

    // Métodos estáticos de consulta
    static async find(query = {}) {
        const docs = await GestorBDModel.find(query);
        return docs.map(doc => new GestorBD(doc.toObject()));
    }

    static async findOne(query) {
        const doc = await GestorBDModel.findOne(query);
        return doc ? new GestorBD(doc.toObject()) : null;
    }

    static async findById(id) {
        const doc = await GestorBDModel.findById(id);
        return doc ? new GestorBD(doc.toObject()) : null;
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await GestorBDModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return doc ? new GestorBD(doc.toObject()) : null;
    }

    static async findByIdAndDelete(id) {
        const doc = await GestorBDModel.findByIdAndDelete(id);
        return doc ? new GestorBD(doc.toObject()) : null;
    }

    static async create(data) {
        const doc = new GestorBDModel(data);
        const saved = await doc.save();
        return new GestorBD(saved.toObject());
    }

    // Método para convertir a objeto plano (útil para compatibilidad)
    toObject() {
        const obj = {};
        
        // Only include defined fields
        if (this._id !== undefined) obj._id = this._id;
        if (this.nombre !== undefined) obj.nombre = this.nombre;
        if (this.descripcion !== undefined) obj.descripcion = this.descripcion;
        if (this.__v !== undefined) obj.__v = this.__v;
        
        return obj;
    }
}

module.exports = GestorBD;
