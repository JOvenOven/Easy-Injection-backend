const Joi = require('joi');
const mongoose = require('mongoose');
const debug = require('debug')('easyinjection:models:gestordb');

const gestorBDSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        enum: ['dalfox', 'sqlmap', 'zap', 'otros'], 
        required: true, 
        unique: true 
    },
    descripcion: { type: String, maxlength: 255 }
});

const GestorBDModel = mongoose.models.GestorBD || mongoose.model('GestorBD', gestorBDSchema);

class GestorBD {
    #nombre;
    #descripcion;
    #id;
    #version;

    constructor(data = {}) {
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.#nombre = plainData.nombre;
        this.#descripcion = plainData.descripcion;
        this.#id = plainData._id;
        this.#version = plainData.__v;
    }

    get nombre() {
        return this.#nombre;
    }

    set nombre(value) {
        const validValues = ['dalfox', 'sqlmap', 'zap', 'otros'];
        if (!validValues.includes(value)) {
            throw new Error(`Gestor de BD inválido. Debe ser uno de: ${validValues.join(', ')}`);
        }
        this.#nombre = value;
    }

    get descripcion() {
        return this.#descripcion;
    }

    set descripcion(value) {
        if (value && value.length > 255) {
            throw new Error('La descripción no puede exceder 255 caracteres');
        }
        this.#descripcion = value;
    }

    get _id() {
        return this.#id;
    }

    get __v() {
        return this.#version;
    }

    getToolCommand() {
        const commands = {
            'dalfox': 'dalfox',
            'sqlmap': 'sqlmap',
            'zap': 'zap.sh',
            'otros': null
        };
        return commands[this.#nombre];
    }

    getVulnerabilityTypes() {
        const types = {
            'dalfox': ['XSS'],
            'sqlmap': ['SQLi'],
            'zap': ['XSS', 'SQLi', 'CSRF'],
            'otros': []
        };
        return types[this.#nombre] || [];
    }

    supportsFeature(feature) {
        const features = {
            'dalfox': ['xss-scanning', 'payload-generation', 'blind-xss'],
            'sqlmap': ['sqli-detection', 'database-enumeration', 'os-takeover'],
            'zap': ['active-scan', 'passive-scan', 'fuzzing', 'spider'],
            'otros': []
        };
        return (features[this.#nombre] || []).includes(feature);
    }

    isXSSScanner() {
        return ['dalfox', 'zap'].includes(this.#nombre);
    }

    isSQLiScanner() {
        return ['sqlmap', 'zap'].includes(this.#nombre);
    }

    getDisplayName() {
        const names = {
            'dalfox': 'Dalfox (XSS Scanner)',
            'sqlmap': 'SQLmap (SQL Injection)',
            'zap': 'OWASP ZAP',
            'otros': 'Otro'
        };
        return names[this.#nombre] || this.#nombre;
    }

    static fromMongoose(mongooseDoc) {
        if (!mongooseDoc) return null;
        debug('fromMongoose: converting to GestorBD');
        return new GestorBD(mongooseDoc.toObject());
    }

    static build(data) {
        return new GestorBD(data);
    }

    static createEmpty() {
        return new GestorBD({ nombre: 'otros', descripcion: '' });
    }

    static validate(gestor) {
        const schema = Joi.object({
            nombre: Joi.string().valid('dalfox', 'sqlmap', 'zap', 'otros').required(),
            descripcion: Joi.string().max(255)
        });

        return schema.validate(gestor);
    }

    async save() {
        if (this.#id) {
            debug('save: updating GestorBD %s', this.#id);
            const updateData = this.toObject();
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await GestorBDModel.findByIdAndUpdate(
                this.#id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`GestorBD with _id ${this.#id} not found`);
            }
            
            this.#id = updated._id;
            this.#version = updated.__v;
            return updated;
        } else {
            const doc = new GestorBDModel(this.toObject());
            const saved = await doc.save();
            this.#id = saved._id;
            this.#version = saved.__v;
            return saved;
        }
    }

    static get Model() {
        return GestorBDModel;
    }

    static async find(query = {}) {
        const docs = await GestorBDModel.find(query);
        return docs.map(doc => GestorBD.fromMongoose(doc));
    }

    static async findOne(query) {
        const doc = await GestorBDModel.findOne(query);
        return GestorBD.fromMongoose(doc);
    }

    static async findById(id) {
        const doc = await GestorBDModel.findById(id);
        return GestorBD.fromMongoose(doc);
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await GestorBDModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return GestorBD.fromMongoose(doc);
    }

    static async findByIdAndDelete(id) {
        const doc = await GestorBDModel.findByIdAndDelete(id);
        return GestorBD.fromMongoose(doc);
    }

    static async create(data) {
        const doc = new GestorBDModel(data);
        const saved = await doc.save();
        return GestorBD.fromMongoose(saved);
    }

    toObject() {
        const obj = {};
        if (this.#id !== undefined) obj._id = this.#id;
        if (this.#nombre !== undefined) obj.nombre = this.#nombre;
        if (this.#descripcion !== undefined) obj.descripcion = this.#descripcion;
        if (this.#version !== undefined) obj.__v = this.#version;
        return obj;
    }

    toPersistence() {
        return this.toObject();
    }

    toDTO() {
        return {
            id: this.#id,
            nombre: this.#nombre,
            displayName: this.getDisplayName(),
            descripcion: this.#descripcion,
            command: this.getToolCommand(),
            vulnerabilityTypes: this.getVulnerabilityTypes(),
            isXSSScanner: this.isXSSScanner(),
            isSQLiScanner: this.isSQLiScanner()
        };
    }

    toString() {
        return `[${this.#nombre}] ${this.getDisplayName()}: ${this.#descripcion || 'Sin descripción'}`;
    }
}

module.exports = GestorBD;
