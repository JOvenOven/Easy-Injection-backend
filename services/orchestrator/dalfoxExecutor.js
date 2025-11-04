/**
 * Dalfox executor module - handles all Dalfox XSS scanning operations
 */

const { spawn } = require('child_process');

class DalfoxExecutor {
    constructor(config, logger, emitter, activeProcesses) {
        this.config = config;
        this.logger = logger;
        this.emitter = emitter;
        this.activeProcesses = activeProcesses;
        
        this.toolConfig = {
            path: config.dalfoxPath || 'dalfox',
            commonArgs: ['--format', 'json', '--silence', '--no-color', '--skip-bav'],
            workers: config.dalfoxWorkers || 10,
            delay: config.dalfoxDelay || 0,
            timeout: config.timeout || 30
        };
    }

    /**
     * Check if dalfox is available
     */
    async checkAvailability() {
        try {
            await this.runCommand(['version'], 5000);
            this.logger.addLog(`✓ dalfox disponible`, 'success');
            console.log('[dalfox] checkAvailability: dalfox disponible en:', this.toolConfig.path);
            return true;
        } catch (error) {
            this.logger.addLog(`⚠ dalfox no encontrado. Instala con: go install github.com/hahwul/dalfox/v2@latest`, 'warning');
            console.log('[dalfox] checkAvailability: dalfox no encontrado:', error && error.message ? error.message : error);
            return false;
        }
    }

    /**
     * Run Dalfox scan on a URL
     */
    async scanUrl(url, onVulnerabilityFound) {
        const args = [
            'url',
            url,
            ...this.toolConfig.commonArgs,
            '--worker', this.toolConfig.workers.toString()
        ];

        if (this.toolConfig.delay > 0) {
            args.push('--delay', this.toolConfig.delay.toString());
        }

        // Add custom headers (object format - legacy)
        if (this.config.headers) {
            for (const [key, value] of Object.entries(this.config.headers)) {
                args.push('--header', `${key}: ${value}`);
            }
        }

        // Add custom headers (string format - new)
        if (this.config.customHeaders) {
            const headers = this.config.customHeaders.split('\n').filter(h => h.trim());
            headers.forEach(header => {
                args.push('--header', header.trim());
            });
        }

        this.logger.addLog(`Ejecutando: dalfox ${args.join(' ')}`, 'debug', null, true);
        // Debugging: log the exact command and args
        console.log('[dalfox] scanUrl: ejecutando dalfox con args:', args.join(' '));

        return new Promise((resolve) => {
            const proc = spawn(this.toolConfig.path, args);
            const processKey = `dalfox-${url}`;
            this.activeProcesses.set(processKey, proc);

            let jsonBuffer = '';
            let processedVulnerabilities = new Set(); // Track processed to avoid duplicates

            let streamBuffer = ''; // buffer que mantiene lo que falta por procesar

            proc.stdout.on('data', (data) => {
                const chunk = data.toString();
                // Show raw dalfox output in console
                process.stdout.write(`[dalfox stdout] ${chunk}`);
                console.log('[dalfox] stdout raw chunk:', chunk.replace(/\n/g,'\\n'));
                streamBuffer += chunk;

                // Extraer todos los objetos JSON completos del buffer usando conteo de llaves
                const objects = [];
                let depth = 0;
                let startIdx = -1;
                for (let i = 0; i < streamBuffer.length; i++) {
                    const ch = streamBuffer[i];
                    if (ch === '{') {
                        if (depth === 0) startIdx = i;
                        depth++;
                    } else if (ch === '}') {
                        depth--;
                        if (depth === 0 && startIdx !== -1) {
                            // extraer objeto desde startIdx hasta i (inclusive)
                            const objStr = streamBuffer.slice(startIdx, i + 1);
                            objects.push(objStr);
                            startIdx = -1;
                        }
                    }
                }

                // Remover del buffer la porción procesada (todo hasta el último '}' procesado)
                if (objects.length > 0) {
                    // Encontrar la última posición de '}' procesada
                    const lastObj = objects[objects.length - 1];
                    const lastPos = streamBuffer.indexOf(lastObj) + lastObj.length;
                    streamBuffer = streamBuffer.slice(lastPos);
                }

                console.log('[dalfox] extracted JSON objects count =', objects.length, 'remaining buffer length=', streamBuffer.length);

                // Procesar cada objeto JSON extraído
                for (const [i, objText] of objects.entries()) {
                    const trimmed = objText.trim();
                    console.log(`[dalfox] processing extracted object ${i}:`, trimmed.substring(0,200));
                    try {
                        const result = JSON.parse(trimmed);
                        console.log('[dalfox] parsed JSON result:', result.type, Object.keys(result || {}));
                        // mantén tu lógica existente: filtrar por tipos y llamar a _parseOutput
                        if (result.type === 'V' || result.type === 'POC' || result.type === 'VULN') {
                            const vulnKey = `${result.param || 'unknown'}-${result.payload || 'unknown'}`;
                            if (!processedVulnerabilities.has(vulnKey)) {
                                processedVulnerabilities.add(vulnKey);
                                console.log('[dalfox] new vulnerability detected, calling _parseOutput');
                                this._parseOutput(result, onVulnerabilityFound);
                            } else {
                                console.log('[dalfox] duplicate vulnerability ignored:', vulnKey);
                            }
                        } else {
                            console.log('[dalfox] parsed JSON but type not considered vulnerability:', result.type);
                        }
                    } catch (parseErr) {
                        console.log('[dalfox] ERROR parsing extracted JSON object (should be unlikely):', parseErr.message);
                        // opcional: log completo para depuración
                        console.log('[dalfox] bad object text:', objText.substring(0,1000));
                    }
                }
            });

            proc.stderr.on('data', (data) => {
                const error = data.toString();
                
                // Show raw dalfox stderr in console
                process.stderr.write(`[dalfox stderr] ${error}`);
                
                const errorTrimmed = error.trim();
                // Debug raw stderr
                console.log('[dalfox] stderr raw chunk:', errorTrimmed.replace(/\n/g, '\\n'));
                
                // Filter out known benign errors
                if (!errorTrimmed) {
                    console.log('[dalfox] stderr: empty/whitespace, ignoring');
                    return;
                }
                
                // Skip Loopback IPAddressSpace errors and unmarshal errors
                if (errorTrimmed.includes('Loopback') || 
                    errorTrimmed.includes('could not unmarshal event') ||
                    errorTrimmed.includes('IPAddressSpace') ||
                    errorTrimmed.includes('unknown IPAddressSpace value')) {
                    // These are internal Dalfox errors, not user-facing issues
                    console.log('[dalfox] stderr: filtered known benign error (Loopback/IPAddressSpace)', errorTrimmed);
                    return;
                }
                
                // Only log genuine errors (not debug/info messages) to frontend
                if (errorTrimmed.includes('ERROR:') || errorTrimmed.includes('FATAL:')) {
                    // But still filter out the known benign ones
                    if (!errorTrimmed.match(/Loopback|IPAddressSpace|unmarshal/i)) {
                        this.logger.addLog(`dalfox stderr: ${errorTrimmed}`, 'warning');
                        console.log('[dalfox] stderr: logged as warning', errorTrimmed);
                    } else {
                        console.log('[dalfox] stderr: matched benign pattern despite ERROR/FATAL, ignoring', errorTrimmed);
                    }
                } else {
                    // Not a fatal pattern - log for debugging (console only)
                    this.logger.addLog(`dalfox stderr: ${errorTrimmed}`, 'debug', null, true);
                    console.log('[dalfox] stderr: non-fatal message (debug):', errorTrimmed);
                }
            });

            proc.on('close', (code) => {
                this.activeProcesses.delete(processKey);
                console.log('[dalfox] process closed, code=', code);

                // Process any remaining buffer
                if (jsonBuffer.trim()) {
                    console.log('[dalfox] processing remaining buffer at close, length=', jsonBuffer.trim().length);
                    try {
                        const trimmed = jsonBuffer.trim();
                        if (trimmed.startsWith('{') && this._isVulnerabilityJson(trimmed)) {
                            const result = JSON.parse(trimmed);
                            console.log('[dalfox] parsed final-buffer JSON:', result);
                            if (result.type === 'V' || result.type === 'POC' || result.type === 'VULN') {
                                const vulnKey = `${result.param || 'unknown'}-${result.payload || 'unknown'}`;
                                if (!processedVulnerabilities.has(vulnKey)) {
                                    processedVulnerabilities.add(vulnKey);
                                    console.log('[dalfox] final-buffer vulnerability new -> calling _parseOutput');
                                    this._parseOutput(result, onVulnerabilityFound);
                                } else {
                                    console.log('[dalfox] final-buffer vulnerability duplicate -> ignored', vulnKey);
                                }
                            } else {
                                console.log('[dalfox] final-buffer JSON not vulnerability type:', result.type);
                            }
                        } else {
                            console.log('[dalfox] final-buffer not JSON-vulnerability-looking or empty, ignoring');
                        }
                    } catch (finalParseErr) {
                        console.log('[dalfox] final buffer JSON.parse error:', finalParseErr.message);
                        // Ignore parse errors on final buffer
                    }
                } else {
                    console.log('[dalfox] no remaining buffer at close');
                }
                
                resolve();
            });

            proc.on('error', (error) => {
                this.activeProcesses.delete(processKey);
                this.logger.addLog(`Error ejecutando dalfox: ${error.message}`, 'error');
                console.log('[dalfox] proc error event:', error && error.message ? error.message : error);
                resolve();
            });

            setTimeout(() => {
                if (this.activeProcesses.has(processKey)) {
                    proc.kill('SIGTERM');
                    this.logger.addLog(`Timeout en fuzzing XSS para ${url}`, 'warning');
                    console.log('[dalfox] timeout triggered, killed process for url:', url);
                    resolve();
                }
            }, this.toolConfig.timeout * 1000);
        });
    }

    /**
     * Check if a string looks like a vulnerability JSON line
     * Filters for lines containing "type":"V" or similar vulnerability indicators
     */
    _isVulnerabilityJson(line) {
        // Must be a JSON object (starts with {)
        if (!line.startsWith('{')) return false;
        
        // Check for vulnerability type indicators
        // Look for "type":"V" or "type":"POC" or "type":"VULN"
        const match = /"type"\s*:\s*"(V|POC|VULN)"/.test(line);
        console.log('[dalfox] _isVulnerabilityJson check ->', match, 'for line start:', line.substring(0,80));
        return match;
    }

    /**
     * Parse Dalfox JSON output
     */
    _parseOutput(result, onVulnerabilityFound) {
        // Handle different Dalfox output formats
        const vulnType = result.type;
        console.log('[dalfox] _parseOutput called with type=', vulnType, 'result keys=', Object.keys(result));

        if (vulnType === 'V' || vulnType === 'POC' || vulnType === 'VULN') {
            // Extract URL from various possible locations
            // Dalfox can output: { "data": "http://...", ... } or { "data": { "url": "http://..." }, ... }
            let endpoint = 'unknown';
            
            if (result.data) {
                if (typeof result.data === 'string') {
                    // data is directly the URL string
                    endpoint = result.data;
                } else if (typeof result.data === 'object' && result.data.url) {
                    // data is an object with url property
                    endpoint = result.data.url;
                } else if (typeof result.data === 'object' && result.data.target) {
                    // sometimes dalfox uses "target" inside data
                    endpoint = result.data.target;
                }
            }
            
            // Fallback to other possible fields
            if (endpoint === 'unknown' && result.url) {
                endpoint = result.url;
            }
            
            // If still unknown, try extracting from any URL-like string in the object
            if (endpoint === 'unknown') {
                const jsonStr = JSON.stringify(result);
                const urlMatch = jsonStr.match(/https?:\/\/[^\s"]+/);
                if (urlMatch) {
                    endpoint = urlMatch[0];
                }
            }
            
            // Extract parameter
            const param = result.param || result.data?.param || 'unknown';
            
            // Extract payload
            const payload = result.payload || result.data?.payload || 'detected';
            
            // Extract inject type and method for better description
            const injectType = result.inject_type || result.data?.inject_type || '';
            const method = result.method || result.data?.method || 'GET';
            
            // Build description
            let description = `XSS ${vulnType === 'V' ? 'vulnerability' : vulnType.toLowerCase()} encontrado`;
            if (method !== 'GET') {
                description += ` (${method})`;
            }
            if (param !== 'unknown') {
                description += ` en parámetro '${param}'`;
            }
            if (injectType) {
                description += ` [${injectType}]`;
            }
            if (payload && payload !== 'detected') {
                description += ` - Payload: ${payload}`;
            }

            const vuln = {
                type: 'XSS',
                severity: this._mapSeverity(result.severity || 'medium'),
                endpoint: endpoint,
                parameter: param,
                description: description
            };

            // Log detailed vulnerability information
            this.logger.addLog(`✓ XSS detectado: ${endpoint} - Parámetro: ${param}`, 'success');
            this.logger.addLog(`  Tipo: ${vulnType} | Severidad: ${vuln.severity} | Payload: ${payload.substring(0, 50)}${payload.length > 50 ? '...' : ''}`, 'info');

            // Debug logs showing the object we will send to onVulnerabilityFound
            console.log('[dalfox] prepared vuln object:', vuln);

            if (onVulnerabilityFound) {
                try {
                    console.log('[dalfox] calling onVulnerabilityFound callback with vuln');
                    onVulnerabilityFound(vuln);
                    console.log('[dalfox] onVulnerabilityFound callback returned');
                } catch (cbErr) {
                    console.log('[dalfox] onVulnerabilityFound callback threw error:', cbErr && cbErr.message ? cbErr.message : cbErr);
                }
            } else {
                console.log('[dalfox] onVulnerabilityFound callback not provided');
            }
        } else if (result.type === 'GREP' || result.type === 'INFO') {
            // Only log INFO messages in console, not frontend
            if (result.message && !result.message.match(/Loopback|IPAddressSpace/i)) {
                this.logger.addLog(result.message, 'debug', null, true);
            }
            console.log('[dalfox] _parseOutput: INFO/GREP message:', result.message);
        } else {
            console.log('[dalfox] _parseOutput: unhandled type:', result.type);
        }
    }

    /**
     * Map Dalfox severity to our scale
     */
    _mapSeverity(dalfoxSeverity) {
        const severity = dalfoxSeverity.toLowerCase();
        if (severity.includes('critical') || severity.includes('high')) {
            return 'high';
        } else if (severity.includes('medium')) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Run a command with timeout (for version checks)
     */
    async runCommand(args, timeout = 30000) {
        console.log('[dalfox] runCommand: executing', this.toolConfig.path, args.join(' '));
        return new Promise((resolve, reject) => {
            const proc = spawn(this.toolConfig.path, args);
            const timer = setTimeout(() => {
                try { proc.kill(); } catch (e) {}
                console.log('[dalfox] runCommand: timeout, killed process');
                reject(new Error('Command timeout'));
            }, timeout);

            proc.on('close', (code) => {
                clearTimeout(timer);
                console.log('[dalfox] runCommand: close code=', code);
                if (code === 0) resolve();
                else reject(new Error(`Command failed with code ${code}`));
            });

            proc.on('error', (error) => {
                clearTimeout(timer);
                console.log('[dalfox] runCommand: error event:', error && error.message ? error.message : error);
                reject(error);
            });
        });
    }
}

module.exports = DalfoxExecutor;
