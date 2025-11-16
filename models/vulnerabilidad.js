const Joi = require('joi');
const mongoose = require('mongoose');

// Schema de vulnerabilidades
const vulnerabilitySchema = new mongoose.Schema({
    escaneo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Scan', required: true },

    // Ahora se referencian los catálogos
    tipo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'VulnerabilityType', required: true },
    nivel_severidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SeverityLevel', required: true },

    parametro_afectado: { type: String, maxlength: 100 },
    url_afectada: { type: String, maxlength: 255 },
    descripcion: { type: String },
    sugerencia: { type: String },
    referencia: { type: String }
});

// Modelo de Mongoose
// Check if model already exists to avoid overwriting
const VulnerabilityModel = mongoose.models.Vulnerability || mongoose.model('Vulnerability', vulnerabilitySchema);

// Clase de dominio
class Vulnerability {
    constructor(data = {}) {
        // Handle Mongoose document or plain object
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.escaneo_id = plainData.escaneo_id;
        this.tipo_id = plainData.tipo_id;
        this.nivel_severidad_id = plainData.nivel_severidad_id;
        this.parametro_afectado = plainData.parametro_afectado;
        this.url_afectada = plainData.url_afectada;
        this.descripcion = plainData.descripcion;
        this.sugerencia = plainData.sugerencia;
        this.referencia = plainData.referencia;
        
        // Copy Mongoose-specific fields
        if (plainData._id) this._id = plainData._id;
        if (plainData.__v !== undefined) this.__v = plainData.__v;
    }

    // Método estático de validación
    static validate(vuln) {
        const schema = Joi.object({
            escaneo_id: Joi.string().required(),
            tipo_id: Joi.string().required(),
            nivel_severidad_id: Joi.string().required(),
            parametro_afectado: Joi.string().max(100),
            url_afectada: Joi.string().max(255),
            descripcion: Joi.string(),
            sugerencia: Joi.string(),
            referencia: Joi.string().uri()
        });

        return schema.validate(vuln);
    }

    // Método de instancia para guardar
    async save() {
        if (this._id) {
            // Update existing document
            const updateData = this.toObject();
            // Remove _id and __v from update data (Mongoose handles these)
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await VulnerabilityModel.findByIdAndUpdate(
                this._id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`Vulnerability with _id ${this._id} not found`);
            }
            
            // Update instance with saved data
            this._id = updated._id;
            this.__v = updated.__v;
            return updated;
        } else {
            // Insert new document
            const doc = new VulnerabilityModel(this.toObject());
            const saved = await doc.save();
            // Update instance with saved data
            this._id = saved._id;
            this.__v = saved.__v;
            return saved;
        }
    }

    // Exponer el modelo de Mongoose para queries complejas (populate, select, etc.)
    static get Model() {
        return VulnerabilityModel;
    }

    // Métodos estáticos de consulta
    static async find(query = {}) {
        const docs = await VulnerabilityModel.find(query);
        return docs.map(doc => new Vulnerability(doc.toObject()));
    }

    static async findOne(query) {
        const doc = await VulnerabilityModel.findOne(query);
        return doc ? new Vulnerability(doc.toObject()) : null;
    }

    static async findById(id) {
        const doc = await VulnerabilityModel.findById(id);
        return doc ? new Vulnerability(doc.toObject()) : null;
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await VulnerabilityModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return doc ? new Vulnerability(doc.toObject()) : null;
    }

    static async findByIdAndDelete(id) {
        const doc = await VulnerabilityModel.findByIdAndDelete(id);
        return doc ? new Vulnerability(doc.toObject()) : null;
    }

    static async create(data) {
        const doc = new VulnerabilityModel(data);
        const saved = await doc.save();
        return new Vulnerability(saved.toObject());
    }

    // Método para convertir a objeto plano (útil para compatibilidad)
    toObject() {
        const obj = {};
        
        // Only include defined fields
        if (this._id !== undefined) obj._id = this._id;
        if (this.escaneo_id !== undefined) obj.escaneo_id = this.escaneo_id;
        if (this.tipo_id !== undefined) obj.tipo_id = this.tipo_id;
        if (this.nivel_severidad_id !== undefined) obj.nivel_severidad_id = this.nivel_severidad_id;
        if (this.parametro_afectado !== undefined) obj.parametro_afectado = this.parametro_afectado;
        if (this.url_afectada !== undefined) obj.url_afectada = this.url_afectada;
        if (this.descripcion !== undefined) obj.descripcion = this.descripcion;
        if (this.sugerencia !== undefined) obj.sugerencia = this.sugerencia;
        if (this.referencia !== undefined) obj.referencia = this.referencia;
        if (this.__v !== undefined) obj.__v = this.__v;
        
        return obj;
    }
}

module.exports = Vulnerability;
