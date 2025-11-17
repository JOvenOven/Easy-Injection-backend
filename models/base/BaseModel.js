/**
 * BaseModel - Clase base para todos los modelos de dominio
 * Proporciona funcionalidad común de Mongoose y reduce código duplicado
 */
class BaseModel {
    #id;
    #version;
    
    constructor(data = {}) {
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        this.#id = plainData._id;
        this.#version = plainData.__v;
    }

    get _id() {
        return this.#id;
    }

    get __v() {
        return this.#version;
    }

    /**
     * Guarda o actualiza el documento en MongoDB
     * Debe ser sobrescrito en clases hijas si necesitan lógica personalizada
     */
    async save() {
        const ModelClass = this.constructor.Model;
        const debugFn = this.constructor.debug;
        
        if (this.#id) {
            if (debugFn) debugFn('save: updating %s %s', this.constructor.name, this.#id);
            const updateData = this.toObject();
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await ModelClass.findByIdAndUpdate(
                this.#id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`${this.constructor.name} with _id ${this.#id} not found`);
            }
            
            this.#id = updated._id;
            this.#version = updated.__v;
            return updated;
        } else {
            if (debugFn) debugFn('save: creating new %s', this.constructor.name);
            const doc = new ModelClass(this.toObject());
            const saved = await doc.save();
            this.#id = saved._id;
            this.#version = saved.__v;
            if (debugFn) debugFn('save: %s created with _id %s', this.constructor.name, saved._id);
            return saved;
        }
    }

    /**
     * Métodos estáticos wrapper de Mongoose
     * Se heredan automáticamente por todas las clases hijas
     */
    
    static async find(query = {}) {
        const docs = await this.Model.find(query);
        return docs.map(doc => this.fromMongoose(doc));
    }

    static async findOne(query) {
        const doc = await this.Model.findOne(query);
        return this.fromMongoose(doc);
    }

    static async findById(id) {
        const doc = await this.Model.findById(id);
        return this.fromMongoose(doc);
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await this.Model.findByIdAndUpdate(id, update, { new: true, ...options });
        return this.fromMongoose(doc);
    }

    static async findByIdAndDelete(id) {
        const doc = await this.Model.findByIdAndDelete(id);
        return this.fromMongoose(doc);
    }

    static async findOneAndUpdate(query, update, options = {}) {
        const doc = await this.Model.findOneAndUpdate(query, update, { new: true, ...options });
        return this.fromMongoose(doc);
    }

    static async findOneAndDelete(query) {
        const doc = await this.Model.findOneAndDelete(query);
        return this.fromMongoose(doc);
    }

    static async create(data) {
        const doc = new this.Model(data);
        const saved = await doc.save();
        return this.fromMongoose(saved);
    }

    static async deleteMany(query) {
        return await this.Model.deleteMany(query);
    }

    static async updateMany(query, update) {
        return await this.Model.updateMany(query, update);
    }

    static async countDocuments(query = {}) {
        return await this.Model.countDocuments(query);
    }

    /**
     * Factory method base - debe ser sobrescrito
     */
    static fromMongoose(mongooseDoc) {
        if (!mongooseDoc) return null;
        if (this.debug) this.debug('fromMongoose: converting to %s', this.name);
        return new this(mongooseDoc.toObject());
    }

    static build(data) {
        return new this(data);
    }

    /**
     * Método de conversión a objeto plano
     * Debe ser implementado por las clases hijas
     */
    toObject() {
        throw new Error('toObject() must be implemented by child class');
    }

    /**
     * Alias para toObject (compatibilidad)
     */
    toPersistence() {
        return this.toObject();
    }

    /**
     * Getter estático para el modelo Mongoose
     * Debe ser sobrescrito por las clases hijas
     */
    static get Model() {
        throw new Error('Model getter must be implemented by child class');
    }
}

module.exports = BaseModel;
