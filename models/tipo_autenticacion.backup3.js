const Joi = require('joi');
const mongoose = require('mongoose');
const debug = require('debug')('easyinjection:models:authtype');

const authTypeSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        enum: ['usuario_password', 'token', 'oauth2', 'apikey'], 
        required: true, 
        unique: true 
    },
    descripcion: { type: String, maxlength: 255 }
});

const AuthTypeModel = mongoose.models.AuthType || mongoose.model('AuthType', authTypeSchema);

class AuthType {
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
        const validValues = ['usuario_password', 'token', 'oauth2', 'apikey'];
        if (!validValues.includes(value)) {
            throw new Error(`Tipo de autenticación inválido. Debe ser uno de: ${validValues.join(', ')}`);
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

    requiresCredentials() {
        return ['usuario_password', 'apikey'].includes(this.#nombre);
    }

    isOAuth() {
        return this.#nombre === 'oauth2';
    }

    isTokenBased() {
        return ['token', 'oauth2', 'apikey'].includes(this.#nombre);
    }

    getDisplayName() {
        const names = {
            'usuario_password': 'Usuario y Contraseña',
            'token': 'Token de Autenticación',
            'oauth2': 'OAuth 2.0',
            'apikey': 'API Key'
        };
        return names[this.#nombre] || this.#nombre;
    }

    getSecurityLevel() {
        const levels = {
            'usuario_password': 'Media',
            'token': 'Alta',
            'oauth2': 'Alta',
            'apikey': 'Media'
        };
        return levels[this.#nombre] || 'Desconocida';
    }

    static fromMongoose(mongooseDoc) {
        if (!mongooseDoc) return null;
        debug('fromMongoose: converting to AuthType');
        return new AuthType(mongooseDoc.toObject());
    }

    static build(data) {
        return new AuthType(data);
    }

    static createEmpty() {
        return new AuthType({ nombre: 'usuario_password', descripcion: '' });
    }

    static validate(auth) {
        const schema = Joi.object({
            nombre: Joi.string().valid('usuario_password', 'token', 'oauth2', 'apikey').required(),
            descripcion: Joi.string().max(255)
        });

        return schema.validate(auth);
    }

    async save() {
        if (this.#id) {
            debug('save: updating AuthType %s', this.#id);
            const updateData = this.toObject();
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await AuthTypeModel.findByIdAndUpdate(
                this.#id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`AuthType with _id ${this.#id} not found`);
            }
            
            this.#id = updated._id;
            this.#version = updated.__v;
            return updated;
        } else {
            const doc = new AuthTypeModel(this.toObject());
            const saved = await doc.save();
            this.#id = saved._id;
            this.#version = saved.__v;
            return saved;
        }
    }

    static get Model() {
        return AuthTypeModel;
    }

    static async find(query = {}) {
        const docs = await AuthTypeModel.find(query);
        return docs.map(doc => AuthType.fromMongoose(doc));
    }

    static async findOne(query) {
        const doc = await AuthTypeModel.findOne(query);
        return AuthType.fromMongoose(doc);
    }

    static async findById(id) {
        const doc = await AuthTypeModel.findById(id);
        return AuthType.fromMongoose(doc);
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await AuthTypeModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return AuthType.fromMongoose(doc);
    }

    static async findByIdAndDelete(id) {
        const doc = await AuthTypeModel.findByIdAndDelete(id);
        return AuthType.fromMongoose(doc);
    }

    static async create(data) {
        const doc = new AuthTypeModel(data);
        const saved = await doc.save();
        return AuthType.fromMongoose(saved);
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
            requiresCredentials: this.requiresCredentials(),
            isOAuth: this.isOAuth(),
            isTokenBased: this.isTokenBased(),
            securityLevel: this.getSecurityLevel()
        };
    }

    toString() {
        return `[${this.#nombre}] ${this.getDisplayName()}: ${this.#descripcion || 'Sin descripción'}`;
    }
}

module.exports = AuthType;
