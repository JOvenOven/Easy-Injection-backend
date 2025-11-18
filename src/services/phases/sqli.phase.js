class SQLiPhase {
    constructor(config, sqlmapExecutor, logger, questionHandler, discoveredParameters, vulnerabilities, stats, emitter) {
        this.config = config;
        this.sqlmapExecutor = sqlmapExecutor;
        this.logger = logger;
        this.questionHandler = questionHandler;
        this.discoveredParameters = discoveredParameters;
        this.vulnerabilities = vulnerabilities;
        this.stats = stats;
        this.emitter = emitter;
    }

    async run() {
        await this.runSubphase('detection');
        await this.runSubphase('fingerprint');
        await this.runSubphase('technique');
        await this.runSubphase('exploit');
    }

    async runSubphase(subphaseId) {
        const subphases = {
            detection: { name: 'Detección de vulnerabilidad', handler: () => this.detectSQLi() },
            fingerprint: { name: 'Fingerprinting', handler: () => this.fingerprintDatabase() },
            technique: { name: 'Selección de técnica', handler: () => this.selectTechnique() },
            exploit: { name: 'Explotación (POC)', handler: () => this.exploitSQLi() }
        };

        const subphase = subphases[subphaseId];
        if (!subphase) return;

        const subphaseFullId = `sqli-${subphaseId}`;
        this.logger.setCurrentPhase(subphaseFullId);
        this.logger.addLog(`SQLi - ${subphase.name}`, 'info', subphaseFullId);
        this.emitter.emit('subphase:started', { 
            phase: 'sqli', 
            subphase: subphaseId, 
            name: subphase.name 
        });

        await subphase.handler();

        this.emitter.emit('subphase:completed', { 
            phase: 'sqli', 
            subphase: subphaseId, 
            name: subphase.name 
        });
        
        this.logger.setCurrentPhase('sqli');
    }

    async detectSQLi() {
        await this.questionHandler.waitIfPaused();
        
        await this.questionHandler.askQuestion(null, 'sqli-detection');
        
        await this.questionHandler.waitIfPaused();

        const testableParams = this.discoveredParameters.filter(p => p.testable);
        
        if (testableParams.length === 0) {
            this.logger.addLog('No hay parámetros para testear', 'warning');
            return;
        }

        const paramsByEndpoint = new Map();
        for (const param of testableParams) {
            if (!paramsByEndpoint.has(param.endpoint)) {
                paramsByEndpoint.set(param.endpoint, []);
            }
            paramsByEndpoint.get(param.endpoint).push(param);
        }

        this.logger.addLog(`Testeando SQLi en ${paramsByEndpoint.size} endpoint(s) con ${testableParams.length} parámetro(s) total`, 'info');

        for (const [endpoint, params] of paramsByEndpoint.entries()) {
            await this.questionHandler.waitIfPaused();
            
            this.logger.addLog(`Testeando SQLi en ${endpoint} con parámetros: ${params.map(p => p.name).join(', ')}`, 'info');
            
            try {
                await this.sqlmapExecutor.testEndpoint(endpoint, params, 'detection', (vuln) => {
                    this.addVulnerability(vuln);
                });
            } catch (error) {
                this.logger.addLog(`Error testeando endpoint ${endpoint}: ${error.message}`, 'warning');
            }
        }
    }

    async fingerprintDatabase() {
        await this.questionHandler.waitIfPaused();
        
        await this.questionHandler.askQuestion(null, 'sqli-fingerprint');
        
        await this.questionHandler.waitIfPaused();

        this.logger.addLog('Ejecutando fingerprinting de la base de datos...', 'info');
        
        const vulnerableParams = this.discoveredParameters.filter(p => 
            this.vulnerabilities.some(v => v.parameter === p.name && v.type === 'SQLi')
        );
        
        if (vulnerableParams.length === 0) {
            this.logger.addLog('No hay parámetros vulnerables para fingerprinting', 'info');
            return;
        }
        
        const param = vulnerableParams[0];
        
        try {
            await this.sqlmapExecutor.testParameter(param, 'fingerprint');
        } catch (error) {
            this.logger.addLog(`Error en fingerprinting: ${error.message}`, 'warning');
        }
    }

    async selectTechnique() {
        await this.questionHandler.waitIfPaused();
        
        this.logger.addLog('Analizando técnicas de inyección detectadas...', 'info');
        
        const techniques = [];
        for (const vuln of this.vulnerabilities.filter(v => v.type === 'SQLi')) {
            if (vuln.description.match(/boolean/i)) techniques.push('Boolean-based blind');
            if (vuln.description.match(/union/i)) techniques.push('UNION query');
            if (vuln.description.match(/time/i)) techniques.push('Time-based blind');
            if (vuln.description.match(/error/i)) techniques.push('Error-based');
        }
        
        const uniqueTechniques = [...new Set(techniques)];
        
        if (uniqueTechniques.length > 0) {
            this.logger.addLog(`Técnicas disponibles: ${uniqueTechniques.join(', ')}`, 'info');
            this.logger.addLog(`Técnica óptima: ${uniqueTechniques[0]}`, 'success');
        } else {
            this.logger.addLog('No se detectaron técnicas específicas', 'info');
        }
    }

    async exploitSQLi() {
        await this.questionHandler.waitIfPaused();
        
        await this.questionHandler.askQuestion(null, 'sqli-exploit');
        
        await this.questionHandler.waitIfPaused();

        if (!this.config.enableExploitation) {
            this.logger.addLog('⚠ Explotación deshabilitada por configuración (modo seguro)', 'warning');
            this.logger.addLog('Solo se genera Proof of Concept teórico', 'info');
            return;
        }

        this.logger.addLog('Generando POC (Proof of Concept) - Solo lectura', 'info');
        
        const vulnerableParams = this.discoveredParameters.filter(p => 
            this.vulnerabilities.some(v => v.parameter === p.name && v.type === 'SQLi')
        );
        
        if (vulnerableParams.length === 0) {
            this.logger.addLog('No hay parámetros vulnerables para explotar', 'info');
            return;
        }
        
        const param = vulnerableParams[0];
        
        try {
            await this.sqlmapExecutor.testParameter(param, 'exploit');
            this.logger.addLog('POC completado - Información básica extraída', 'success');
        } catch (error) {
            this.logger.addLog(`Error en explotación: ${error.message}`, 'warning');
        }
    }

    addVulnerability(vuln) {
        this.vulnerabilities.push(vuln);
        this.stats.vulnerabilitiesFound++;
        this.logger.addLog(`¡Vulnerabilidad SQLi encontrada en ${vuln.parameter}!`, 'warning');
        this.emitter.emit('vulnerability:found', vuln);
    }
}

module.exports = SQLiPhase;

