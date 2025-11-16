const Joi = require('joi');
const mongoose = require('mongoose');

// Schema de reportes
const reportSchema = new mongoose.Schema({
    escaneo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Scan', required: true },
    fecha_generado: { type: Date, default: Date.now },

    // Datos adicionales útiles en reportes
    resumen: {
        total_vulnerabilidades: { type: Number, default: 0 },
        criticas: { type: Number, default: 0 },
        altas: { type: Number, default: 0 },
        medias: { type: Number, default: 0 },
        bajas: { type: Number, default: 0 }
    }
});

// Modelo de Mongoose
// Check if model already exists to avoid overwriting
const ReportModel = mongoose.models.Report || mongoose.model('Report', reportSchema);

// Clase de dominio
class Report {
    constructor(data = {}) {
        // Handle Mongoose document or plain object
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.escaneo_id = plainData.escaneo_id;
        this.fecha_generado = plainData.fecha_generado;
        this.resumen = plainData.resumen || {
            total_vulnerabilidades: 0,
            criticas: 0,
            altas: 0,
            medias: 0,
            bajas: 0
        };
        
        // Copy Mongoose-specific fields
        if (plainData._id) this._id = plainData._id;
        if (plainData.__v !== undefined) this.__v = plainData.__v;
    }

    // Método estático de validación
    static validate(report) {
        const schema = Joi.object({
            escaneo_id: Joi.string().required(),
            resumen: Joi.object({
                total_vulnerabilidades: Joi.number().min(0),
                criticas: Joi.number().min(0),
                altas: Joi.number().min(0),
                medias: Joi.number().min(0),
                bajas: Joi.number().min(0)
            })
        });

        return schema.validate(report);
    }

    // Método de instancia para guardar
    async save() {
        if (this._id) {
            // Update existing document
            const updateData = this.toObject();
            // Remove _id and __v from update data (Mongoose handles these)
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await ReportModel.findByIdAndUpdate(
                this._id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`Report with _id ${this._id} not found`);
            }
            
            // Update instance with saved data
            this._id = updated._id;
            this.__v = updated.__v;
            return updated;
        } else {
            // Insert new document
            const doc = new ReportModel(this.toObject());
            const saved = await doc.save();
            // Update instance with saved data
            this._id = saved._id;
            this.__v = saved.__v;
            return saved;
        }
    }

    // Exponer el modelo de Mongoose para queries complejas (populate, select, etc.)
    static get Model() {
        return ReportModel;
    }

    // Métodos estáticos de consulta
    static async find(query = {}) {
        const docs = await ReportModel.find(query);
        return docs.map(doc => new Report(doc.toObject()));
    }

    static async findOne(query) {
        const doc = await ReportModel.findOne(query);
        return doc ? new Report(doc.toObject()) : null;
    }

    static async findById(id) {
        const doc = await ReportModel.findById(id);
        return doc ? new Report(doc.toObject()) : null;
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await ReportModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return doc ? new Report(doc.toObject()) : null;
    }

    static async findByIdAndDelete(id) {
        const doc = await ReportModel.findByIdAndDelete(id);
        return doc ? new Report(doc.toObject()) : null;
    }

    static async create(data) {
        const doc = new ReportModel(data);
        const saved = await doc.save();
        return new Report(saved.toObject());
    }

    // Método para convertir a objeto plano (útil para compatibilidad)
    toObject() {
        const obj = {};
        
        // Only include defined fields
        if (this._id !== undefined) obj._id = this._id;
        if (this.escaneo_id !== undefined) obj.escaneo_id = this.escaneo_id;
        if (this.fecha_generado !== undefined) obj.fecha_generado = this.fecha_generado;
        if (this.resumen !== undefined) obj.resumen = this.resumen;
        if (this.__v !== undefined) obj.__v = this.__v;
        
        return obj;
    }
}

module.exports = Report;
