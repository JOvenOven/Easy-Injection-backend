const Joi = require('joi');
const mongoose = require('mongoose');
const debug = require('debug')('easyinjection:models:vulnerability');

const vulnerabilitySchema = new mongoose.Schema({
    escaneo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Scan', required: true },
    tipo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'VulnerabilityType', required: true },
    nivel_severidad_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SeverityLevel', required: true },
    parametro_afectado: { type: String, maxlength: 100 },
    url_afectada: { type: String, maxlength: 255 },
    descripcion: { type: String },
    sugerencia: { type: String },
    referencia: { type: String }
});

const VulnerabilityModel = mongoose.models.Vulnerability || mongoose.model('Vulnerability', vulnerabilitySchema);

class Vulnerability {
    #escaneo_id;
    #tipo_id;
    #nivel_severidad_id;
    #parametro_afectado;
    #url_afectada;
    #descripcion;
    #sugerencia;
    #referencia;
    #id;
    #version;

    constructor(data = {}) {
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.#escaneo_id = plainData.escaneo_id;
        this.#tipo_id = plainData.tipo_id;
        this.#nivel_severidad_id = plainData.nivel_severidad_id;
        this.#parametro_afectado = plainData.parametro_afectado;
        this.#url_afectada = plainData.url_afectada;
        this.#descripcion = plainData.descripcion;
        this.#sugerencia = plainData.sugerencia;
        this.#referencia = plainData.referencia;
        this.#id = plainData._id;
        this.#version = plainData.__v;
    }

    get escaneo_id() {
        return this.#escaneo_id;
    }

    set escaneo_id(value) {
        if (!value) {
            throw new Error('El ID del escaneo es obligatorio');
        }
        this.#escaneo_id = value;
    }

    get tipo_id() {
        return this.#tipo_id;
    }

    set tipo_id(value) {
        if (!value) {
            throw new Error('El ID del tipo de vulnerabilidad es obligatorio');
        }
        this.#tipo_id = value;
    }

    get nivel_severidad_id() {
        return this.#nivel_severidad_id;
    }

    set nivel_severidad_id(value) {
        if (!value) {
            throw new Error('El ID del nivel de severidad es obligatorio');
        }
        this.#nivel_severidad_id = value;
    }

    get parametro_afectado() {
        return this.#parametro_afectado;
    }

    set parametro_afectado(value) {
        if (value && value.length > 100) {
            throw new Error('El parámetro afectado no puede exceder 100 caracteres');
        }
        this.#parametro_afectado = value;
    }

    get url_afectada() {
        return this.#url_afectada;
    }

    set url_afectada(value) {
        if (value && value.length > 255) {
            throw new Error('La URL afectada no puede exceder 255 caracteres');
        }
        this.#url_afectada = value;
    }

    get descripcion() {
        return this.#descripcion;
    }

    set descripcion(value) {
        this.#descripcion = value;
    }

    get sugerencia() {
        return this.#sugerencia;
    }

    set sugerencia(value) {
        this.#sugerencia = value;
    }

    get referencia() {
        return this.#referencia;
    }

    set referencia(value) {
        this.#referencia = value;
    }

    get _id() {
        return this.#id;
    }

    get __v() {
        return this.#version;
    }

    getRiskScore(severityLevel, vulnerabilityType) {
        debug('getRiskScore: calculating for severity=%s type=%s', severityLevel?.nombre, vulnerabilityType?.nombre);
        const severityWeights = {
            'Crítica': 10,
            'Alta': 7,
            'Media': 4,
            'Baja': 1
        };
        
        const typeMultipliers = {
            'SQLi': 1.5,
            'XSS': 1.3,
            'CSRF': 1.2,
            'XXE': 1.4,
            'SSTI': 1.5
        };
        
        const severityName = severityLevel?.nombre || 'Media';
        const typeName = vulnerabilityType?.nombre || 'XSS';
        
        const baseScore = severityWeights[severityName] || 4;
        const multiplier = typeMultipliers[typeName] || 1.0;
        
        return Math.round(baseScore * multiplier * 10) / 10;
    }

    getPriority(severityLevel) {
        const priorities = {
            'Crítica': 1,
            'Alta': 2,
            'Media': 3,
            'Baja': 4
        };
        return priorities[severityLevel?.nombre] || 3;
    }

    isCritical(severityLevel) {
        return severityLevel?.nombre === 'Crítica';
    }

    isHighPriority(severityLevel) {
        return ['Crítica', 'Alta'].includes(severityLevel?.nombre);
    }

    getCVSSScore(severityLevel) {
        const cvssRanges = {
            'Crítica': { min: 9.0, max: 10.0 },
            'Alta': { min: 7.0, max: 8.9 },
            'Media': { min: 4.0, max: 6.9 },
            'Baja': { min: 0.1, max: 3.9 }
        };
        
        const range = cvssRanges[severityLevel?.nombre] || cvssRanges['Media'];
        return (range.min + range.max) / 2;
    }

    getRemediationEffort() {
        return this.#sugerencia && this.#sugerencia.length > 100 ? 'Alto' : 'Medio';
    }

    hasReference() {
        return Boolean(this.#referencia);
    }

    static fromMongoose(mongooseDoc) {
        if (!mongooseDoc) return null;
        debug('fromMongoose: converting to Vulnerability');
        return new Vulnerability(mongooseDoc.toObject());
    }

    static build(data) {
        return new Vulnerability(data);
    }

    static createEmpty(escaneoId) {
        return new Vulnerability({ 
            escaneo_id: escaneoId,
            tipo_id: null,
            nivel_severidad_id: null,
            parametro_afectado: '',
            url_afectada: '',
            descripcion: '',
            sugerencia: '',
            referencia: ''
        });
    }

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

    async save() {
        if (this.#id) {
            debug('save: updating Vulnerability %s', this.#id);
            const updateData = this.toObject();
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await VulnerabilityModel.findByIdAndUpdate(
                this.#id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`Vulnerability with _id ${this.#id} not found`);
            }
            
            this.#id = updated._id;
            this.#version = updated.__v;
            return updated;
        } else {
            const doc = new VulnerabilityModel(this.toObject());
            const saved = await doc.save();
            this.#id = saved._id;
            this.#version = saved.__v;
            return saved;
        }
    }

    static get Model() {
        return VulnerabilityModel;
    }

    static async find(query = {}) {
        const docs = await VulnerabilityModel.find(query);
        return docs.map(doc => Vulnerability.fromMongoose(doc));
    }

    static async findOne(query) {
        const doc = await VulnerabilityModel.findOne(query);
        return Vulnerability.fromMongoose(doc);
    }

    static async findById(id) {
        const doc = await VulnerabilityModel.findById(id);
        return Vulnerability.fromMongoose(doc);
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await VulnerabilityModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return Vulnerability.fromMongoose(doc);
    }

    static async findByIdAndDelete(id) {
        const doc = await VulnerabilityModel.findByIdAndDelete(id);
        return Vulnerability.fromMongoose(doc);
    }

    static async create(data) {
        const doc = new VulnerabilityModel(data);
        const saved = await doc.save();
        return Vulnerability.fromMongoose(saved);
    }

    toObject() {
        const obj = {};
        if (this.#id !== undefined) obj._id = this.#id;
        if (this.#escaneo_id !== undefined) obj.escaneo_id = this.#escaneo_id;
        if (this.#tipo_id !== undefined) obj.tipo_id = this.#tipo_id;
        if (this.#nivel_severidad_id !== undefined) obj.nivel_severidad_id = this.#nivel_severidad_id;
        if (this.#parametro_afectado !== undefined) obj.parametro_afectado = this.#parametro_afectado;
        if (this.#url_afectada !== undefined) obj.url_afectada = this.#url_afectada;
        if (this.#descripcion !== undefined) obj.descripcion = this.#descripcion;
        if (this.#sugerencia !== undefined) obj.sugerencia = this.#sugerencia;
        if (this.#referencia !== undefined) obj.referencia = this.#referencia;
        if (this.#version !== undefined) obj.__v = this.#version;
        return obj;
    }

    toPersistence() {
        return this.toObject();
    }

    toDTO(severityLevel, vulnerabilityType) {
        return {
            id: this.#id,
            escaneoId: this.#escaneo_id,
            tipo: vulnerabilityType?.nombre || 'Unknown',
            severidad: severityLevel?.nombre || 'Unknown',
            parametro: this.#parametro_afectado,
            url: this.#url_afectada,
            descripcion: this.#descripcion,
            sugerencia: this.#sugerencia,
            referencia: this.#referencia,
            riskScore: this.getRiskScore(severityLevel, vulnerabilityType),
            priority: this.getPriority(severityLevel),
            isCritical: this.isCritical(severityLevel),
            cvssScore: this.getCVSSScore(severityLevel)
        };
    }

    toString() {
        return `[${this.#nivel_severidad_id}] ${this.#tipo_id}: ${this.#parametro_afectado || 'N/A'} @ ${this.#url_afectada || 'N/A'}`;
    }
}

module.exports = Vulnerability;
