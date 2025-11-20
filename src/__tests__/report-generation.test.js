// Tests críticos para generación de reportes
const EventEmitter = require('events');

// Mock del generador de reportes
class ReportGenerator extends EventEmitter {
    constructor() {
        super();
        this.vulnerabilities = [];
    }

    addVulnerability(vuln) {
        this.vulnerabilities.push(vuln);
    }

    generateReport(scanId, scanData) {
        const report = {
            scanId,
            timestamp: new Date(),
            summary: this.generateSummary(),
            vulnerabilities: this.categorizeVulnerabilities(),
            statistics: this.calculateStatistics(),
            recommendations: this.generateRecommendations(),
            metadata: {
                scanUrl: scanData.url,
                duration: scanData.duration,
                scanType: scanData.scanType || 'full'
            }
        };

        this.emit('report:generated', report);
        return report;
    }

    generateSummary() {
        const total = this.vulnerabilities.length;
        const critical = this.vulnerabilities.filter(v => v.severity === 'critical').length;
        const high = this.vulnerabilities.filter(v => v.severity === 'high').length;
        const medium = this.vulnerabilities.filter(v => v.severity === 'medium').length;
        const low = this.vulnerabilities.filter(v => v.severity === 'low').length;

        return {
            totalVulnerabilities: total,
            bySeverity: { critical, high, medium, low },
            riskScore: this.calculateRiskScore(critical, high, medium, low)
        };
    }

    categorizeVulnerabilities() {
        const categories = {
            sqli: [],
            xss: [],
            other: []
        };

        this.vulnerabilities.forEach(vuln => {
            if (vuln.type === 'SQLi') {
                categories.sqli.push(vuln);
            } else if (vuln.type === 'XSS') {
                categories.xss.push(vuln);
            } else {
                categories.other.push(vuln);
            }
        });

        return categories;
    }

    calculateStatistics() {
        const totalVulns = this.vulnerabilities.length;
        if (totalVulns === 0) {
            return {
                mostCommonType: null,
                mostAffectedParameter: null,
                averageSeverity: 0
            };
        }

        // Tipo más común
        const typeCounts = {};
        this.vulnerabilities.forEach(v => {
            typeCounts[v.type] = (typeCounts[v.type] || 0) + 1;
        });
        const mostCommonType = Object.keys(typeCounts).reduce((a, b) => 
            typeCounts[a] > typeCounts[b] ? a : b
        );

        // Parámetro más afectado
        const paramCounts = {};
        this.vulnerabilities.forEach(v => {
            if (v.parameter) {
                paramCounts[v.parameter] = (paramCounts[v.parameter] || 0) + 1;
            }
        });
        const mostAffectedParameter = Object.keys(paramCounts).length > 0
            ? Object.keys(paramCounts).reduce((a, b) => 
                paramCounts[a] > paramCounts[b] ? a : b
            )
            : null;

        // Severidad promedio
        const severityValues = { critical: 4, high: 3, medium: 2, low: 1 };
        const avgSeverity = this.vulnerabilities.reduce((sum, v) => 
            sum + (severityValues[v.severity] || 0), 0
        ) / totalVulns;

        return {
            mostCommonType,
            mostAffectedParameter,
            averageSeverity: Math.round(avgSeverity * 10) / 10
        };
    }

    calculateRiskScore(critical, high, medium, low) {
        return (critical * 10) + (high * 6) + (medium * 3) + (low * 1);
    }

    generateRecommendations() {
        const recommendations = [];

        const hasSQLi = this.vulnerabilities.some(v => v.type === 'SQLi');
        const hasXSS = this.vulnerabilities.some(v => v.type === 'XSS');
        const criticalCount = this.vulnerabilities.filter(v => v.severity === 'critical').length;

        if (hasSQLi) {
            recommendations.push({
                type: 'SQLi',
                priority: 'high',
                message: 'Implementar prepared statements y validación de entrada',
                references: ['OWASP A03:2021 - Injection']
            });
        }

        if (hasXSS) {
            recommendations.push({
                type: 'XSS',
                priority: 'high',
                message: 'Implementar sanitización de output y Content Security Policy',
                references: ['OWASP A03:2021 - Injection']
            });
        }

        if (criticalCount > 0) {
            recommendations.push({
                type: 'general',
                priority: 'critical',
                message: `Se encontraron ${criticalCount} vulnerabilidades críticas que requieren atención inmediata`
            });
        }

        return recommendations;
    }

    exportToJSON(report) {
        try {
            return JSON.stringify(report, null, 2);
        } catch (error) {
            throw new Error('Failed to export report to JSON');
        }
    }

    exportToHTML(report) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Scan Report - ${report.scanId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; margin: 10px 0; }
        .critical { color: #d32f2f; }
        .high { color: #f57c00; }
        .medium { color: #fbc02d; }
        .low { color: #388e3c; }
    </style>
</head>
<body>
    <h1>Security Scan Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Total Vulnerabilities: ${report.summary.totalVulnerabilities}</p>
        <p>Risk Score: ${report.summary.riskScore}</p>
    </div>
    <div class="vulnerabilities">
        <h2>Vulnerabilities</h2>
        ${report.vulnerabilities.sqli.length > 0 ? '<h3>SQL Injection</h3>' : ''}
        ${report.vulnerabilities.xss.length > 0 ? '<h3>Cross-Site Scripting</h3>' : ''}
    </div>
</body>
</html>
        `.trim();

        return html;
    }
}

describe('Generación de Reportes - Tests Críticos', () => {
    let generator;

    beforeEach(() => {
        generator = new ReportGenerator();
    });

    describe('Agregación de vulnerabilidades', () => {
        it('debe agregar vulnerabilidades', () => {
            generator.addVulnerability({
                type: 'SQLi',
                severity: 'high',
                parameter: 'id'
            });

            expect(generator.vulnerabilities).toHaveLength(1);
        });

        it('debe acumular múltiples vulnerabilidades', () => {
            generator.addVulnerability({ type: 'SQLi' });
            generator.addVulnerability({ type: 'XSS' });
            generator.addVulnerability({ type: 'SQLi' });

            expect(generator.vulnerabilities).toHaveLength(3);
        });
    });

    describe('Generación de resumen', () => {
        it('debe generar resumen con conteo y risk score', () => {
            generator.addVulnerability({ type: 'SQLi', severity: 'critical' });
            generator.addVulnerability({ type: 'XSS', severity: 'high' });

            const summary = generator.generateSummary();

            expect(summary.totalVulnerabilities).toBe(2);
            expect(summary.bySeverity.critical).toBe(1);
            expect(summary.bySeverity.high).toBe(1);
            expect(summary.riskScore).toBe(16); // (1*10) + (1*6)
        });
    });

    describe('Categorización de vulnerabilidades', () => {
        it('debe categorizar por tipo', () => {
            generator.addVulnerability({ type: 'SQLi' });
            generator.addVulnerability({ type: 'XSS' });
            generator.addVulnerability({ type: 'SQLi' });

            const categories = generator.categorizeVulnerabilities();

            expect(categories.sqli).toHaveLength(2);
            expect(categories.xss).toHaveLength(1);
            expect(categories.other).toHaveLength(0);
        });

        it('debe categorizar tipos desconocidos como other', () => {
            generator.addVulnerability({ type: 'CSRF' });

            const categories = generator.categorizeVulnerabilities();

            expect(categories.other).toHaveLength(1);
        });
    });

    describe('Cálculo de estadísticas', () => {
        it('debe calcular estadísticas completas', () => {
            generator.addVulnerability({ type: 'SQLi', parameter: 'id', severity: 'critical' });
            generator.addVulnerability({ type: 'SQLi', parameter: 'id', severity: 'high' });
            generator.addVulnerability({ type: 'XSS', parameter: 'name', severity: 'medium' });

            const stats = generator.calculateStatistics();

            expect(stats.mostCommonType).toBe('SQLi');
            expect(stats.mostAffectedParameter).toBe('id');
            expect(stats.averageSeverity).toBeGreaterThan(0);
        });
    });

    describe('Generación de reporte completo', () => {
        it('debe generar reporte con estructura completa', () => {
            generator.addVulnerability({ type: 'SQLi', severity: 'high', parameter: 'id' });

            const report = generator.generateReport('scan123', {
                url: 'http://testphp.vulnweb.com',
                duration: 300
            });

            expect(report).toHaveProperty('scanId', 'scan123');
            expect(report).toHaveProperty('summary');
            expect(report).toHaveProperty('vulnerabilities');
            expect(report).toHaveProperty('statistics');
            expect(report).toHaveProperty('recommendations');
            expect(report.metadata.scanUrl).toBe('http://testphp.vulnweb.com');
        });
    });

    describe('Generación de recomendaciones', () => {
        it('debe generar recomendaciones según vulnerabilidades', () => {
            generator.addVulnerability({ type: 'SQLi', severity: 'critical' });
            generator.addVulnerability({ type: 'XSS', severity: 'high' });

            const recommendations = generator.generateRecommendations();

            expect(recommendations.find(r => r.type === 'SQLi')).toBeDefined();
            expect(recommendations.find(r => r.type === 'XSS')).toBeDefined();
            expect(recommendations.find(r => r.priority === 'critical')).toBeDefined();
        });
    });

    describe('Exportación a JSON', () => {
        it('debe exportar reporte a JSON formateado', () => {
            const report = generator.generateReport('scan123', { url: 'http://testphp.vulnweb.com' });
            const json = generator.exportToJSON(report);

            const parsed = JSON.parse(json);
            expect(parsed.scanId).toBe('scan123');
            expect(json).toContain('\n');
        });
    });

    describe('Exportación a HTML', () => {
        it('debe exportar reporte a HTML con estructura completa', () => {
            generator.addVulnerability({ type: 'SQLi', severity: 'high' });
            const report = generator.generateReport('scan123', { url: 'http://testphp.vulnweb.com' });

            const html = generator.exportToHTML(report);

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<title>Scan Report - scan123</title>');
            expect(html).toContain('<style>');
            expect(html).toContain('Total Vulnerabilities: 1');
        });
    });

    describe('Cálculo de Risk Score', () => {
        it('debe calcular score con pesos correctos', () => {
            expect(generator.calculateRiskScore(1, 2, 3, 4)).toBe(35); // (1*10) + (2*6) + (3*3) + (4*1)
            expect(generator.calculateRiskScore(1, 0, 0, 0)).toBeGreaterThan(generator.calculateRiskScore(0, 1, 0, 0));
        });
    });
});
