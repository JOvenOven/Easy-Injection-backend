class XSSPhase {
    constructor(config, dalfoxExecutor, logger, questionHandler, discoveredParameters, vulnerabilities, stats, emitter) {
        this.config = config;
        this.dalfoxExecutor = dalfoxExecutor;
        this.logger = logger;
        this.questionHandler = questionHandler;
        this.discoveredParameters = discoveredParameters;
        this.vulnerabilities = vulnerabilities;
        this.stats = stats;
        this.emitter = emitter;
    }

    async run() {
        await this.runSubphase('context');
        await this.runSubphase('payload');
        await this.runSubphase('fuzzing');
    }

    async runSubphase(subphaseId) {
        const subphases = {
            context: { name: 'Análisis de contexto', handler: () => this.analyzeXSSContext() },
            payload: { name: 'Generación de payloads', handler: () => this.generateXSSPayloads() },
            fuzzing: { name: 'Motor de fuzzing', handler: () => this.runXSSFuzzing() }
        };

        const subphase = subphases[subphaseId];
        if (!subphase) return;

        const subphaseFullId = `xss-${subphaseId}`;
        this.logger.setCurrentPhase(subphaseFullId);
        this.logger.addLog(`XSS - ${subphase.name}`, 'info', subphaseFullId);
        this.emitter.emit('subphase:started', { 
            phase: 'xss', 
            subphase: subphaseId, 
            name: subphase.name 
        });

        await subphase.handler();

        this.emitter.emit('subphase:completed', { 
            phase: 'xss', 
            subphase: subphaseId, 
            name: subphase.name 
        });
        
        this.logger.setCurrentPhase('xss');
    }

    async analyzeXSSContext() {
        await this.questionHandler.waitIfPaused();
        
        await this.questionHandler.askQuestion(null, 'xss-context');
        
        await this.questionHandler.waitIfPaused();

        this.logger.addLog('Analizando contextos de inyección con Dalfox...', 'info');
        this.logger.addLog('Preparando análisis de contextos HTML, JS y atributos...', 'info');
    }

    async generateXSSPayloads() {
        await this.questionHandler.waitIfPaused();
        
        this.logger.addLog('Generando payloads XSS con Dalfox...', 'info');
        this.logger.addLog('Payloads adaptados para múltiples contextos', 'info');
    }

    async runXSSFuzzing() {
        await this.questionHandler.waitIfPaused();
        
        await this.questionHandler.askQuestion(null, 'xss-fuzzing');
        
        await this.questionHandler.waitIfPaused();

        const testableParams = this.discoveredParameters.filter(p => p.testable);
        
        if (testableParams.length === 0) {
            this.logger.addLog('No hay parámetros para testear XSS', 'warning');
            return;
        }
        
        const testedUrls = new Set();
        
        for (const param of testableParams) {
            await this.questionHandler.waitIfPaused();
            
            if (!testedUrls.has(param.endpoint)) {
                testedUrls.add(param.endpoint);
                
                this.logger.addLog(`Fuzzing XSS en ${param.endpoint}`, 'info');
                
                try {
                    await this.dalfoxExecutor.scanUrl(param.endpoint, (vuln) => {
                        this.logger.addLog(`[XSS] Vulnerabilidad detectada:`, 'info');
                        this.logger.addLog(`  - Endpoint: ${vuln.endpoint}`, 'info');
                        this.logger.addLog(`  - Parámetro: ${vuln.parameter}`, 'info');
                        this.logger.addLog(`  - Severidad: ${vuln.severity}`, 'info');
                        this.logger.addLog(`  - Descripción: ${vuln.description}`, 'info');
                        
                        this.addVulnerability(vuln);
                    });
                } catch (error) {
                    this.logger.addLog(`Error en fuzzing XSS: ${error.message}`, 'warning');
                }
            }
        }
    }

    addVulnerability(vuln) {
        if (!this.vulnerabilities.some(v => 
            v.endpoint === vuln.endpoint && 
            v.parameter === vuln.parameter &&
            v.type === 'XSS'
        )) {
            this.vulnerabilities.push(vuln);
            this.stats.vulnerabilitiesFound++;
            this.logger.addLog(`¡Vulnerabilidad XSS encontrada en ${vuln.parameter}!`, 'warning');
            this.emitter.emit('vulnerability:found', vuln);
        }
    }
}

module.exports = XSSPhase;

