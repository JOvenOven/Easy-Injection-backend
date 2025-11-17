const Joi = require('joi');
const mongoose = require('mongoose');
const debug = require('debug')('easyinjection:models:report');
const BaseModel = require('./base/BaseModel');
const { buildObject } = require('./base/ModelHelpers');
const ReportSummary = require('./value-objects/report-summary');

const reportSchema = new mongoose.Schema({
    escaneo_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Scan', required: true },
    fecha_generado: { type: Date, default: Date.now },
    resumen: { total_vulnerabilidades: { type: Number, default: 0 }, criticas: { type: Number, default: 0 },
        altas: { type: Number, default: 0 }, medias: { type: Number, default: 0 }, bajas: { type: Number, default: 0 } }
});

const ReportModel = mongoose.models.Report || mongoose.model('Report', reportSchema);

class Report extends BaseModel {
    #escaneo_id; #fecha_generado; #resumen;

    constructor(data = {}) {
        super(data);
        const plainData = data && typeof data.toObject === 'function' ? data.toObject() : data;
        this.#escaneo_id = plainData.escaneo_id;
        this.#fecha_generado = plainData.fecha_generado;
        this.#resumen = new ReportSummary(plainData.resumen || {});
    }

    get escaneo_id() { return this.#escaneo_id; }
    set escaneo_id(value) { if (!value) throw new Error('El ID del escaneo es obligatorio'); this.#escaneo_id = value; }

    get fecha_generado() { return this.#fecha_generado; }
    get resumen() { return this.#resumen; }

    updateSummary(vulnerabilidades) { this.#resumen = ReportSummary.fromVulnerabilities(vulnerabilidades); }

    getExecutiveSummary() {
        return { fecha: this.#fecha_generado, total_vulnerabilidades: this.#resumen.total_vulnerabilidades,
            nivel_riesgo: this.#resumen.getRiskLevel(), score_seguridad: this.#resumen.getSecurityHealthScore(),
            criticas: this.#resumen.criticas, requiere_accion_inmediata: this.#resumen.hasHighPriorityVulnerabilities() };
    }

    generatePDFData() {
        return { titulo: `Reporte de Seguridad - ${new Date(this.#fecha_generado).toLocaleDateString()}`,
            fecha: this.#fecha_generado, escaneo_id: this.#escaneo_id, resumen_ejecutivo: this.getExecutiveSummary(),
            desglose: this.#resumen.toObject(), recomendaciones: this.#getRecommendations() };
    }

    generateHTMLData() {
        return { ...this.generatePDFData(), riskLevelClass: this.#resumen.getRiskLevel().toLowerCase(),
            criticalPercentage: this.#resumen.getCriticalPercentage() };
    }

    isRecent() {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return new Date(this.#fecha_generado) > sevenDaysAgo;
    }

    getAgeInDays() {
        const now = new Date();
        const diffTime = Math.abs(now - new Date(this.#fecha_generado));
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

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
        if (this.#resumen.medias > 10) recommendations.push('Revisar y corregir vulnerabilidades de severidad media acumuladas');
        return recommendations;
    }

    static createEmpty(escaneoId) {
        return new Report({ escaneo_id: escaneoId, fecha_generado: new Date(), resumen: ReportSummary.createEmpty().toObject() });
    }

    static fromVulnerabilities(escaneoId, vulnerabilidades) {
        return new Report({ escaneo_id: escaneoId, fecha_generado: new Date(), resumen: ReportSummary.fromVulnerabilities(vulnerabilidades).toObject() });
    }

    static validate(report) {
        return Joi.object({
            escaneo_id: Joi.string().required(),
            fecha_generado: Joi.date(),
            resumen: Joi.object({
                total_vulnerabilidades: Joi.number().min(0),
                criticas: Joi.number().min(0),
                altas: Joi.number().min(0),
                medias: Joi.number().min(0),
                bajas: Joi.number().min(0)
            })
        }).validate(report);
    }

    static get Model() { return ReportModel; }
    static get debug() { return debug; }

    toObject() { return buildObject(this, ['escaneo_id', 'fecha_generado', 'resumen']); }
    toString() { return `[REPORT] Escaneo ${this.#escaneo_id}: ${this.#resumen.total_vulnerabilidades} vulns (${this.#resumen.criticas} críticas)`; }
}

module.exports = Report;
module.exports.ReportSummary = ReportSummary;
