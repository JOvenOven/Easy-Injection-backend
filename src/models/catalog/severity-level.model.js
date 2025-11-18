const Joi = require('joi');
const mongoose = require('mongoose');
const debug = require('debug')('easyinjection:models:severity');
const BaseModel = require('../base/BaseModel');
const { buildObject } = require('../base/ModelHelpers');

// Schema de niveles de severidad
const severityLevelSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        enum: ['Baja', 'Media', 'Alta', 'Crítica'], 
        required: true, 
        unique: true 
    },
    descripcion: { type: String, maxlength: 255 }
});

const SeverityLevelModel = mongoose.models.SeverityLevel || mongoose.model('SeverityLevel', severityLevelSchema);

/**
 * Clase de dominio SeverityLevel con encapsulamiento OOP
 * Representa un nivel de severidad de vulnerabilidad
 */
class SeverityLevel extends BaseModel {
    #nombre;
    #descripcion;

    constructor(data = {}) {
        super(data);
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.#nombre = plainData.nombre;
        this.#descripcion = plainData.descripcion;
    }

    // Getters y Setters
    get nombre() {
        return this.#nombre;
    }

    set nombre(value) {
        const validValues = ['Baja', 'Media', 'Alta', 'Crítica'];
        if (!validValues.includes(value)) {
            throw new Error(`Nombre de severidad inválido. Debe ser uno de: ${validValues.join(', ')}`);
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
    getWeight() {
        const weights = { 'Baja': 1, 'Media': 2, 'Alta': 3, 'Crítica': 4 };
        return weights[this.#nombre] || 0;
    }

    isMoreSevereThan(other) {
        return this.getWeight() > other.getWeight();
    }

    getColor() {
        const colors = {
            'Baja': '#4ecdc4',
            'Media': '#ffe66d',
            'Alta': '#ff6b6b',
            'Crítica': '#c92a2a'
        };
        return colors[this.#nombre] || '#gray';
    }

    isCritical() {
        return this.#nombre === 'Crítica';
    }

    // Factory Methods
    static createEmpty() {
        return new SeverityLevel({ nombre: 'Baja', descripcion: '' });
    }

    static validate(level) {
        const schema = Joi.object({
            nombre: Joi.string().valid('Baja', 'Media', 'Alta', 'Crítica').required(),
            descripcion: Joi.string().max(255)
        });

        return schema.validate(level);
    }

    static get Model() {
        return SeverityLevelModel;
    }

    static get debug() {
        return debug;
    }

    toObject() {
        return buildObject(this, ['nombre', 'descripcion']);
    }

    toString() {
        return `[${this.#nombre}] ${this.#descripcion || 'Sin descripción'}`;
    }
}

function validateSeverityLevel(level) {
    return SeverityLevel.validate(level);
}

exports.SeverityLevel = SeverityLevel;
exports.validate = validateSeverityLevel;
