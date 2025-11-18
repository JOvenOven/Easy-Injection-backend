const Joi = require('joi');
const mongoose = require('mongoose');
const debug = require('debug')('easyinjection:models:gestordb');
const BaseModel = require('../base/BaseModel');
const { buildObject } = require('../base/ModelHelpers');

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

class GestorBD extends BaseModel {
    #nombre;
    #descripcion;

    constructor(data = {}) {
        super(data);
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.#nombre = plainData.nombre;
        this.#descripcion = plainData.descripcion;
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

    // Métodos de dominio
    getFullName() {
        const names = {
            'dalfox': 'Dalfox (XSS Scanner)',
            'sqlmap': 'SQLMap (SQL Injection)',
            'zap': 'OWASP ZAP',
            'otros': 'Otros Gestores'
        };
        return names[this.#nombre] || this.#nombre;
    }

    isAutomatedScanner() {
        return ['dalfox', 'sqlmap', 'zap'].includes(this.#nombre);
    }

    supportsXSS() {
        return ['dalfox', 'zap'].includes(this.#nombre);
    }

    supportsSQLi() {
        return ['sqlmap', 'zap'].includes(this.#nombre);
    }

    getVulnerabilityTypes() {
        const types = {
            'dalfox': ['XSS'],
            'sqlmap': ['SQLi'],
            'zap': ['XSS', 'SQLi', 'CSRF', 'XXE'],
            'otros': []
        };
        return types[this.#nombre] || [];
    }

    getDefaultTimeout() {
        const timeouts = {
            'dalfox': 300,
            'sqlmap': 600,
            'zap': 900,
            'otros': 300
        };
        return timeouts[this.#nombre] || 300;
    }

    static createEmpty() {
        return new GestorBD({ nombre: 'sqlmap', descripcion: '' });
    }

    static validate(gestor) {
        const schema = Joi.object({
            nombre: Joi.string().valid('dalfox', 'sqlmap', 'zap', 'otros').required(),
            descripcion: Joi.string().max(255)
        });

        return schema.validate(gestor);
    }

    static get Model() {
        return GestorBDModel;
    }

    static get debug() {
        return debug;
    }

    toObject() {
        return buildObject(this, ['nombre', 'descripcion']);
    }

    toString() {
        return `[${this.getFullName()}] ${this.#descripcion || 'Sin descripción'}`;
    }
}

function validateGestorBD(gestor) {
    return GestorBD.validate(gestor);
}

exports.GestorBD = GestorBD;
exports.DbManager = GestorBD;
exports.validate = validateGestorBD;
