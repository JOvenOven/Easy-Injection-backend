const Joi = require('joi');
const mongoose = require('mongoose');
const debug = require('debug')('easyinjection:models:report');
const ReportSummary = require('./value-objects/report-summary');

// Schema de reportes
const reportSchema = new mongoose.Schema({
    escaneo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Scan', required: true },
    fecha_generado: { type: Date, default: Date.now },
    resumen: {
        total_vulnerabilidades: { type: Number, default: 0 },
        criticas: { type: Number, default: 0 },
        altas: { type: Number, default: 0 },
        medias: { type: Number, default: 0 },
        bajas: { type: Number, default: 0 }
    }
});

// Modelo de Mongoose
const ReportModel = mongoose.models.Report || mongoose.model('Report', reportSchema);

/**
 * Clase de dominio Report con encapsulamiento OOP
 * Representa un reporte de escaneo de vulnerabilidades
 */
class Report {
    // Campos privados
    #escaneo_id;
    #fecha_generado;
    #resumen;  // ReportSummary (Value Object)
    #id;
    #version;

    /**
     * Constructor privado - usar factory methods
     * @private
     */
    constructor(data = {}) {
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        
        this.#escaneo_id = plainData.escaneo_id;
        this.#fecha_generado = plainData.fecha_generado;
        this.#resumen = new ReportSummary(plainData.resumen || {});
        this.#id = plainData._id;
        this.#version = plainData.__v;
    }

    // Getters y Setters
    get escaneo_id() {
        return this.#escaneo_id;
    }

    set escaneo_id(value) {
        if (!value) {
            throw new Error('El ID del escaneo es obligatorio');
        }
        this.#escaneo_id = value;
    }

    get fecha_generado() {
        return this.#fecha_generado;
    }

    get resumen() {
        return this.#resumen;
    }

    get _id() {
        return this.#id;
    }

    get __v() {
        return this.#version;
    }

    // Métodos de dominio
    /**
     * Actualiza el resumen desde vulnerabilidades
     * @param {Array} vulnerabilidades - Array de vulnerabilidades
     */
    updateSummary(vulnerabilidades) {
        this.#resumen = ReportSummary.fromVulnerabilities(vulnerabilidades);
    }

    /**
     * Obtiene resumen ejecutivo del reporte
     * @returns {Object}
     */
    getExecutiveSummary() {
        return {
            fecha: this.#fecha_generado,
            total_vulnerabilidades: this.#resumen.total_vulnerabilidades,
            nivel_riesgo: this.#resumen.getRiskLevel(),
            score_seguridad: this.#resumen.getSecurityHealthScore(),
            criticas: this.#resumen.criticas,
            requiere_accion_inmediata: this.#resumen.hasHighPriorityVulnerabilities()
        };
    }

    /**
     * Genera estructura para reporte PDF
     * @returns {Object}
     */
    generatePDFData() {
        return {
            titulo: `Reporte de Seguridad - ${new Date(this.#fecha_generado).toLocaleDateString()}`,
            fecha: this.#fecha_generado,
            escaneo_id: this.#escaneo_id,
            resumen_ejecutivo: this.getExecutiveSummary(),
            desglose: this.#resumen.toObject(),
            recomendaciones: this.#getRecommendations()
        };
    }

    /**
     * Genera estructura para reporte HTML
     * @returns {Object}
     */
    generateHTMLData() {
        return {
            ...this.generatePDFData(),
            riskLevelClass: this.#resumen.getRiskLevel().toLowerCase(),
            criticalPercentage: this.#resumen.getCriticalPercentage()
        };
    }

    /**
     * Verifica si el reporte es reciente (< 7 días)
     * @returns {boolean}
     */
    isRecent() {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return new Date(this.#fecha_generado) > sevenDaysAgo;
    }

    /**
     * Obtiene edad del reporte en días
     * @returns {number}
     */
    getAgeInDays() {
        const now = new Date();
        const reportDate = new Date(this.#fecha_generado);
        const diffTime = Math.abs(now - reportDate);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * Obtiene recomendaciones basadas en vulnerabilidades
     * @private
     * @returns {Array<string>}
     */
    #getRecommendations() {
        const recommendations = [];

        if (this.#resumen.criticas > 0) {
            recommendations.push('🚨 Atención inmediata requerida: Se encontraron vulnerabilidades críticas');
            recommendations.push('Priorizar corrección de vulnerabilidades críticas antes de continuar');
        }

        if (this.#resumen.altas > 3) {
            recommendations.push('⚠️ Alto número de vulnerabilidades de severidad alta detectadas');
            recommendations.push('Implementar plan de remediación escalonado');
        }

        if (this.#resumen.total_vulnerabilidades === 0) {
            recommendations.push('✅ No se encontraron vulnerabilidades en este escaneo');
            recommendations.push('Mantener buenas prácticas de seguridad y realizar escaneos periódicos');
        }

        if (this.#resumen.medias > 10) {
            recommendations.push('Revisar y corregir vulnerabilidades de severidad media acumuladas');
        }

        return recommendations;
    }

    // Factory Methods
    /**
     * Crea instancia desde documento Mongoose
     * @param {Document} mongooseDoc
     * @returns {Report|null}
     */
    static fromMongoose(mongooseDoc) {
        if (!mongooseDoc) return null;
        debug('Report.fromMongoose: converting to Report');
        return new Report(mongooseDoc.toObject());
    }

    /**
     * Crea instancia desde datos planos
     * @param {Object} data
     * @returns {Report}
     */
    static build(data) {
        return new Report(data);
    }

    /**
     * Crea reporte desde un escaneo
     * @param {Object|String} scan - Escaneo o ID del escaneo
     * @param {Array} vulnerabilidades - Vulnerabilidades encontradas
     * @returns {Report}
     */
    static fromScan(scan, vulnerabilidades = []) {
        const scanId = typeof scan === 'string' ? scan : scan._id || scan.id;
        const resumen = ReportSummary.fromVulnerabilities(vulnerabilidades);

        return new Report({
            escaneo_id: scanId,
            fecha_generado: new Date(),
            resumen: resumen.toObject()
        });
    }

    /**
     * Crea reporte vacío
     * @param {String} escaneoId
     * @returns {Report}
     */
    static createEmpty(escaneoId) {
        return new Report({
            escaneo_id: escaneoId,
            fecha_generado: new Date(),
            resumen: ReportSummary.createEmpty().toObject()
        });
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
        if (this.#id) {
            debug('Report.save: updating Report %s', this.#id);
            const updateData = this.toObject();
            delete updateData._id;
            delete updateData.__v;
            
            const updated = await ReportModel.findByIdAndUpdate(
                this.#id,
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!updated) {
                throw new Error(`Report with _id ${this.#id} not found`);
            }
            
            this.#id = updated._id;
            this.#version = updated.__v;
            return updated;
        } else {
            const doc = new ReportModel(this.toObject());
            const saved = await doc.save();
            this.#id = saved._id;
            this.#version = saved.__v;
            return saved;
        }
    }

    // Exponer el modelo de Mongoose
    static get Model() {
        return ReportModel;
    }

    // Métodos estáticos de consulta
    static async find(query = {}) {
        const docs = await ReportModel.find(query);
        return docs.map(doc => Report.fromMongoose(doc));
    }

    static async findOne(query) {
        const doc = await ReportModel.findOne(query);
        return Report.fromMongoose(doc);
    }

    static async findById(id) {
        const doc = await ReportModel.findById(id);
        return Report.fromMongoose(doc);
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const doc = await ReportModel.findByIdAndUpdate(id, update, { new: true, ...options });
        return Report.fromMongoose(doc);
    }

    static async findByIdAndDelete(id) {
        const doc = await ReportModel.findByIdAndDelete(id);
        return Report.fromMongoose(doc);
    }

    static async create(data) {
        const doc = new ReportModel(data);
        const saved = await doc.save();
        return Report.fromMongoose(saved);
    }

    // Método para convertir a objeto plano
    toObject() {
        const obj = {};
        if (this.#id !== undefined) obj._id = this.#id;
        if (this.#escaneo_id !== undefined) obj.escaneo_id = this.#escaneo_id;
        if (this.#fecha_generado !== undefined) obj.fecha_generado = this.#fecha_generado;
        if (this.#resumen !== undefined) obj.resumen = this.#resumen.toObject();
        if (this.#version !== undefined) obj.__v = this.#version;
        return obj;
    }

    toString() {
        return `Reporte #${this.#id} - ${this.#resumen.toString()} - ${this.getAgeInDays()} días`;
    }
}

// Exportar tanto la clase principal como el Value Object
module.exports = Report;
module.exports.ReportSummary = ReportSummary;
