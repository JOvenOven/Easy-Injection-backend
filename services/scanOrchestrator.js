/**
 * ScanOrchestrator - Orchestrates security scans using sqlmap and Dalfox
 * 
 * This is a modular orchestrator that coordinates different scanning phases.
 * See individual modules in orchestrator/ directory for implementation details.
 * 
 * CONFIGURATION:
 * 
 * scanConfig object structure:
 * {
 *   url: "http://target.com",              // Target URL (REQUIRED)
 *   flags: { sqli: true, xss: true },      // Enable/disable scan types (OPTIONAL, defaults to both true)
 *   
 *   // Tool paths (OPTIONAL - uses PATH if not specified)
 *   sqlmapPath: "sqlmap",                  // Path to sqlmap executable
 *   dalfoxPath: "dalfox",                  // Path to dalfox executable
 *   
 *   // SQLMap configuration (OPTIONAL)
 *   crawlDepth: 2,                         // Crawling depth (default: 2)
 *   level: 1,                              // Test level 1-5 (default: 1)
 *   risk: 1,                               // Risk level 1-3 (default: 1)
 *   threads: 1,                            // Number of threads (default: 1)
 *   timeout: 30,                           // Timeout per test in seconds (default: 30)
 *   
 *   // Dalfox configuration (OPTIONAL)
 *   dalfoxWorkers: 10,                     // Number of workers (default: 10)
 *   dalfoxDelay: 0,                        // Delay between requests in ms (default: 0)
 *   
 *   // Exploitation settings (OPTIONAL)
 *   enableExploitation: false,             // Enable POC exploitation (default: false)
 *   
 *   // DBMS (OPTIONAL)
 *   dbms: "MySQL",                         // Target DBMS or null/auto
 *   
 *   // Custom headers (OPTIONAL)
 *   headers: {                             // Object format (legacy)
 *     "Authorization": "Bearer token"
 *   },
 *   customHeaders: "Header: Value\nHeader2: Value2"  // String format (new)
 * }
 * 
 * EVENTS EMITTED:
 * - scan:started: Scan initiated
 * - phase:started: Phase started
 * - phase:completed: Phase completed
 * - subphase:started: Sub-phase started
 * - subphase:completed: Sub-phase completed
 * - log:added: New log entry
 * - endpoint:discovered: New endpoint found
 * - parameter:discovered: New parameter identified
 * - vulnerability:found: Vulnerability detected
 * - question:asked: Question displayed (pauses scan)
 * - question:result: Question answered
 * - scan:completed: Scan finished successfully
 * - scan:error: Error occurred
 */

const EventEmitter = require('events');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Import modules
const { validateAndNormalizeConfig } = require('./orchestrator/configValidator');
const Logger = require('./orchestrator/logger');
const QuestionHandler = require('./orchestrator/questionHandler');
const SqlmapExecutor = require('./orchestrator/sqlmapExecutor');
const DalfoxExecutor = require('./orchestrator/dalfoxExecutor');
const DiscoveryPhase = require('./orchestrator/phases/discoveryPhase');
const SQLiPhase = require('./orchestrator/phases/sqliPhase');
const XSSPhase = require('./orchestrator/phases/xssPhase');

class ScanOrchestrator extends EventEmitter {
    constructor(scanId, scanConfig) {
        super();
        
        console.log('[ORCHESTRATOR] Constructor called');
        console.log('[ORCHESTRATOR] scanId:', scanId);
        console.log('[ORCHESTRATOR] scanConfig:', JSON.stringify(scanConfig, null, 2));
        
        // Validate and normalize configuration
        try {
            console.log('[ORCHESTRATOR] Validating configuration...');
            this.config = validateAndNormalizeConfig(scanConfig);
            console.log('[ORCHESTRATOR] Configuration validated successfully');
            console.log('[ORCHESTRATOR] Normalized config:', JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('[ORCHESTRATOR] Configuration validation error:', error);
            throw new Error(`Configuración inválida: ${error.message}`);
        }
        
        this.scanId = scanId;
        this.currentPhase = null;
        this.discoveredEndpoints = [];
        this.discoveredParameters = [];
        this.vulnerabilities = [];
        this.questionResults = []; // Track all question results
        this.activeProcesses = new Map();
        this.isPaused = false;
        this.isStopped = false;
        
        this.stats = {
            totalRequests: 0,
            vulnerabilitiesFound: 0,
            endpointsDiscovered: 0,
            parametersFound: 0
        };
        
        // Create output directory for this scan
        const outputDir = path.join(os.tmpdir(), 'easyinjection_scans', `scan_${scanId}`);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // Add outputDir to config for executors
        this.config.outputDir = outputDir;
        this.config.tmpDir = path.join(os.tmpdir(), 'easyinjection_sqlmap_tmp');
        
        // Initialize modules
        this.logger = new Logger(this);
        this.questionHandler = new QuestionHandler(this, this.logger);
        
        this.sqlmapExecutor = new SqlmapExecutor(
            this.config,
            this.logger,
            this,
            this.activeProcesses
        );
        
        this.dalfoxExecutor = new DalfoxExecutor(
            this.config,
            this.logger,
            this,
            this.activeProcesses
        );
        
        // Set up endpoint discovery listener for sqlmap crawl
        this.on('endpoint:crawl-discovered', (data) => {
            if (this.discoveryPhase) {
                this.discoveryPhase.addEndpoint({
                    url: data.url,
                    method: data.method,
                    parameters: []
                });
            }
        });
        
        // Track question results
        this.on('question:result', (result) => {
            this.questionResults.push(result);
        });
        
        // Define phases structure
        this.phases = [
            { id: 'init', name: 'Inicialización', status: 'pending' },
            { id: 'discovery', name: 'Descubrimiento de endpoints y parámetros', status: 'pending' },
            { id: 'sqli', name: 'Pruebas SQL Injection', status: 'pending', subphases: [
                { id: 'detection', name: 'Detección de vulnerabilidad', status: 'pending' },
                { id: 'fingerprint', name: 'Fingerprinting', status: 'pending' },
                { id: 'technique', name: 'Selección de técnica', status: 'pending' },
                { id: 'exploit', name: 'Explotación (POC)', status: 'pending' }
            ]},
            { id: 'xss', name: 'Pruebas XSS', status: 'pending', subphases: [
                { id: 'context', name: 'Análisis de contexto', status: 'pending' },
                { id: 'payload', name: 'Generación de payloads', status: 'pending' },
                { id: 'fuzzing', name: 'Motor de fuzzing', status: 'pending' }
            ]},
            { id: 'report', name: 'Generación de reporte', status: 'pending' }
        ];
    }
    
    /**
     * Start the scan process
     */
    async start() {
        console.log('[ORCHESTRATOR] start() method called');
        try {
            console.log('[ORCHESTRATOR] Resetting flags...');
            this.isStopped = false;
            this.isPaused = false;
            console.log('[ORCHESTRATOR] Emitting scan:started event...');
            this.emit('scan:started', { scanId: this.scanId });
            console.log('[ORCHESTRATOR] scan:started event emitted');
            
            console.log('[ORCHESTRATOR] Running init phase...');
            if (this.isStopped) return;
            await this.runPhase('init');
            console.log('[ORCHESTRATOR] Init phase completed');
            
            console.log('[ORCHESTRATOR] Running discovery phase...');
            if (this.isStopped) return;
            await this.runPhase('discovery');
            console.log('[ORCHESTRATOR] Discovery phase completed');
            
            if (this.config.flags.sqli && !this.isStopped) {
                console.log('[ORCHESTRATOR] Running SQLi phase...');
                await this.runPhase('sqli');
                console.log('[ORCHESTRATOR] SQLi phase completed');
            } else {
                console.log('[ORCHESTRATOR] Skipping SQLi phase (disabled or stopped)');
            }
            
            if (this.config.flags.xss && !this.isStopped) {
                console.log('[ORCHESTRATOR] Running XSS phase...');
                await this.runPhase('xss');
                console.log('[ORCHESTRATOR] XSS phase completed');
            } else {
                console.log('[ORCHESTRATOR] Skipping XSS phase (disabled or stopped)');
            }
            
            // Wait for all active processes to complete before generating report
            if (!this.isStopped) {
                console.log('[ORCHESTRATOR] Waiting for all processes...');
                await this.waitForAllProcesses();
                console.log('[ORCHESTRATOR] Running report phase...');
                await this.runPhase('report');
                console.log('[ORCHESTRATOR] Report phase completed');
            }
            
            if (!this.isStopped) {
                console.log('[ORCHESTRATOR] Emitting scan:completed event...');
                this.emit('scan:completed', { 
                    scanId: this.scanId,
                    vulnerabilities: this.vulnerabilities,
                    questionResults: this.questionResults,
                    stats: this.stats
                });
                console.log('[ORCHESTRATOR] Scan completed successfully');
            }
        } catch (error) {
            console.error('[ORCHESTRATOR] CRITICAL ERROR in start():', error);
            console.error('[ORCHESTRATOR] Error message:', error.message);
            console.error('[ORCHESTRATOR] Error stack:', error.stack);
            if (!this.isStopped) {
                this.logger.addLog(`Error crítico: ${error.message}`, 'error');
                this.emit('scan:error', { scanId: this.scanId, error: error.message });
            }
            this.killAllProcesses();
            throw error;
        }
    }

    /**
     * Wait for all active processes to complete
     */
    async waitForAllProcesses() {
        this.logger.addLog('Esperando a que finalicen todos los procesos...', 'info');
        
        const maxWaitTime = 60000; // 60 seconds max wait
        const checkInterval = 1000; // Check every second
        let elapsed = 0;
        
        while (this.activeProcesses.size > 0 && elapsed < maxWaitTime) {
            await this.sleep(checkInterval);
            elapsed += checkInterval;
        }
        
        if (this.activeProcesses.size > 0) {
            this.logger.addLog(`Advertencia: ${this.activeProcesses.size} proceso(s) aún activo(s) después de espera máxima`, 'warning');
        } else {
            this.logger.addLog('Todos los procesos han finalizado', 'success');
        }
    }
    
    /**
     * Kill all active subprocesses
     */
    killAllProcesses() {
        for (const [name, proc] of this.activeProcesses.entries()) {
            if (proc && !proc.killed) {
                this.logger.addLog(`Terminando proceso: ${name}`, 'warning');
                proc.kill('SIGTERM');
            }
        }
        this.activeProcesses.clear();
    }

    /**
     * Run a phase
     */
    async runPhase(phaseId) {
        if (this.isStopped) return;
        
        const phase = this.phases.find(p => p.id === phaseId);
        if (!phase) return;

        this.currentPhase = phaseId;
        this.logger.setCurrentPhase(phaseId); // Set phase context for logger
        phase.status = 'running';
        this.emit('phase:started', { phase: phaseId, name: phase.name });
        this.logger.addLog(`Iniciando fase: ${phase.name}`, 'info', phaseId);

        try {
            switch (phaseId) {
                case 'init':
                    await this.initializeScan();
                    break;
                case 'discovery':
                    const discoveryResult = await this.runDiscoveryPhase();
                    this.discoveredEndpoints = discoveryResult.endpoints;
                    this.discoveredParameters = discoveryResult.parameters;
                    this.stats.endpointsDiscovered = this.discoveredEndpoints.length;
                    this.stats.parametersFound = this.discoveredParameters.length;
                    break;
                case 'sqli':
                    await this.runSQLiPhase();
                    break;
                case 'xss':
                    await this.runXSSPhase();
                    break;
                case 'report':
                    await this.generateReport();
                    break;
            }
        } catch (error) {
            if (!this.isStopped) {
                phase.status = 'error';
                throw error;
            }
        }

        if (!this.isStopped) {
            phase.status = 'completed';
            this.emit('phase:completed', { phase: phaseId, name: phase.name });
            this.logger.addLog(`Fase completada: ${phase.name}`, 'success', phaseId);
        }
    }

    /**
     * Initialize scan
     */
    async initializeScan() {
        await this.questionHandler.waitIfPaused();
        
        this.logger.addLog('Validando configuración del escaneo...', 'info');
        this.logger.addLog(`URL objetivo: ${this.config.url}`, 'info');
        this.logger.addLog(`Flags activos: SQLi=${this.config.flags.sqli}, XSS=${this.config.flags.xss}`, 'info');
        
        // Check tool availability
        await this.sqlmapExecutor.checkAvailability();
        if (this.config.flags.xss) {
            await this.dalfoxExecutor.checkAvailability();
        }
        
        await this.questionHandler.waitIfPaused();
        
        // Ask initialization question
        await this.questionHandler.askQuestion(null, 'init');
        
        this.logger.addLog('Inicialización completada', 'success');
    }

    /**
     * Run discovery phase (fused with parameters phase)
     */
    async runDiscoveryPhase() {
        const phase = new DiscoveryPhase(
            this.config,
            this.sqlmapExecutor,
            this.logger,
            this.questionHandler,
            this
        );
        return await phase.run();
    }

    /**
     * Add vulnerability to discovered vulnerabilities list
     */
    addVulnerability(vuln) {
        if (!this.vulnerabilities.some(v => 
            v.type === vuln.type && 
            v.endpoint === vuln.endpoint && 
            v.parameter === vuln.parameter
        )) {
            this.vulnerabilities.push(vuln);
            this.stats.vulnerabilitiesFound++;
            this.emit('vulnerability:found', vuln);
            this.logger.addLog(`Vulnerabilidad encontrada: ${vuln.type} en ${vuln.endpoint}`, 'success');
        }
    }

    /**
     * Run SQLi phase
     */
    async runSQLiPhase() {
        const phase = new SQLiPhase(
            this.config,
            this.sqlmapExecutor,
            this.logger,
            this.questionHandler,
            this.discoveredParameters,
            this.vulnerabilities,
            this.stats,
            this
        );
        await phase.run();
    }

    /**
     * Run XSS phase
     */
    async runXSSPhase() {
        const phase = new XSSPhase(
            this.config,
            this.dalfoxExecutor,
            this.logger,
            this.questionHandler,
            this.discoveredParameters,
            this.vulnerabilities,
            this.stats,
            this
        );
        await phase.run();
    }

    /**
     * Generate report
     */
    async generateReport() {
        await this.sleep(1500);
        this.logger.addLog('Generando reporte final...', 'info');
        this.logger.addLog(`Vulnerabilidades encontradas: ${this.stats.vulnerabilitiesFound}`, 'info');
        this.logger.addLog(`Endpoints analizados: ${this.stats.endpointsDiscovered}`, 'info');
        this.logger.addLog(`Parámetros testeados: ${this.stats.parametersFound}`, 'info');
        await this.sleep(1000);
        this.logger.addLog('Reporte generado exitosamente', 'success');
    }

    /**
     * Answer a question (called externally)
     */
    answerQuestion(answer) {
        this.questionHandler.answerQuestion(answer);
    }

    /**
     * Pause the scan
     */
    pause() {
        if (this.isStopped) return;
        
        this.isPaused = true;
        this.questionHandler.isPaused = true;
        this.logger.addLog('Escaneo pausado por el usuario', 'warning');
        this.emit('scan:paused', { scanId: this.scanId });
    }

    /**
     * Resume the scan
     */
    resume() {
        if (this.isStopped) return;
        
        this.isPaused = false;
        this.questionHandler.isPaused = false;
        if (this.questionHandler.pauseResolver) {
            this.questionHandler.pauseResolver();
            this.questionHandler.pauseResolver = null;
        }
        this.logger.addLog('Escaneo reanudado', 'info');
        this.emit('scan:resumed', { scanId: this.scanId });
    }

    /**
     * Stop the scan
     */
    stop() {
        if (this.isStopped) return;
        
        this.isStopped = true;
        this.isPaused = false;
        this.questionHandler.isPaused = false;
        if (this.questionHandler.pauseResolver) {
            this.questionHandler.pauseResolver();
            this.questionHandler.pauseResolver = null;
        }
        
        this.logger.addLog('Escaneo detenido por el usuario', 'warning');
        this.killAllProcesses();
        this.emit('scan:stopped', { scanId: this.scanId });
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            scanId: this.scanId,
            currentPhase: this.currentPhase,
            isPaused: this.questionHandler.isCurrentlyPaused(),
            phases: this.phases,
            discoveredEndpoints: this.discoveredEndpoints,
            vulnerabilities: this.vulnerabilities,
            questionResults: this.questionResults,
            stats: this.stats,
            logs: this.logger.getRecentLogs(50)
        };
    }
}

module.exports = ScanOrchestrator;
