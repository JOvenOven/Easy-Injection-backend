/**
 * Value Object: ReportSummary
 * Representa un resumen inmutable de vulnerabilidades en un reporte
 */
class ReportSummary {
    #total_vulnerabilidades;
    #criticas;
    #altas;
    #medias;
    #bajas;

    constructor(data = {}) {
        this.#total_vulnerabilidades = data.total_vulnerabilidades || 0;
        this.#criticas = data.criticas || 0;
        this.#altas = data.altas || 0;
        this.#medias = data.medias || 0;
        this.#bajas = data.bajas || 0;
    }

    // Getters read-only (inmutabilidad)
    get total_vulnerabilidades() { return this.#total_vulnerabilidades; }
    get criticas() { return this.#criticas; }
    get altas() { return this.#altas; }
    get medias() { return this.#medias; }
    get bajas() { return this.#bajas; }

    /**
     * Calcula el porcentaje de vulnerabilidades críticas
     * @returns {number} Porcentaje (0-100)
     */
    getCriticalPercentage() {
        if (this.#total_vulnerabilidades === 0) return 0;
        return Math.round((this.#criticas / this.#total_vulnerabilidades) * 100);
    }

    /**
     * Obtiene el nivel de riesgo general
     * @returns {string} 'Critical' | 'High' | 'Medium' | 'Low' | 'None'
     */
    getRiskLevel() {
        if (this.#criticas > 0) return 'Critical';
        if (this.#altas > 3) return 'High';
        if (this.#altas > 0 || this.#medias > 5) return 'Medium';
        if (this.#medias > 0 || this.#bajas > 0) return 'Low';
        return 'None';
    }

    /**
     * Obtiene vulnerabilidades por nivel
     * @param {string} level - 'criticas'|'altas'|'medias'|'bajas'
     * @returns {number}
     */
    getVulnerabilitiesByLevel(level) {
        const levels = {
            'criticas': this.#criticas,
            'altas': this.#altas,
            'medias': this.#medias,
            'bajas': this.#bajas
        };
        return levels[level] || 0;
    }

    /**
     * Calcula score de salud de seguridad (0-100)
     * @returns {number}
     */
    getSecurityHealthScore() {
        const maxPenalty = 100;
        const penalty = (this.#criticas * 25) + (this.#altas * 10) + (this.#medias * 5) + (this.#bajas * 1);
        return Math.max(0, maxPenalty - penalty);
    }

    /**
     * Verifica si hay vulnerabilidades de alta prioridad
     * @returns {boolean}
     */
    hasHighPriorityVulnerabilities() {
        return this.#criticas > 0 || this.#altas > 0;
    }

    /**
     * Factory: Crea resumen desde array de vulnerabilidades
     * @param {Array} vulnerabilidades - Array con campo nivel_severidad
     * @returns {ReportSummary}
     */
    static fromVulnerabilities(vulnerabilidades = []) {
        const summary = {
            total_vulnerabilidades: vulnerabilidades.length,
            criticas: 0,
            altas: 0,
            medias: 0,
            bajas: 0
        };

        vulnerabilidades.forEach(v => {
            const nivel = v.nivel_severidad || v.nivel_severidad_id?.nombre || 'Baja';
            if (nivel === 'Crítica') summary.criticas++;
            else if (nivel === 'Alta') summary.altas++;
            else if (nivel === 'Media') summary.medias++;
            else if (nivel === 'Baja') summary.bajas++;
        });

        return new ReportSummary(summary);
    }

    /**
     * Factory: Crea resumen vacío
     * @returns {ReportSummary}
     */
    static createEmpty() {
        return new ReportSummary();
    }

    /**
     * Convierte a objeto plano
     * @returns {Object}
     */
    toObject() {
        return {
            total_vulnerabilidades: this.#total_vulnerabilidades,
            criticas: this.#criticas,
            altas: this.#altas,
            medias: this.#medias,
            bajas: this.#bajas
        };
    }

    toString() {
        return `Vulnerabilidades: ${this.#total_vulnerabilidades} (C:${this.#criticas}, A:${this.#altas}, M:${this.#medias}, B:${this.#bajas}) - Riesgo: ${this.getRiskLevel()}`;
    }
}

module.exports = ReportSummary;
