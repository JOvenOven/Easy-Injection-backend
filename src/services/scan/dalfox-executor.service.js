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

    async checkAvailability() {
        try {
            await this.runCommand(['version'], 5000);
            this.logger.addLog(`✓ dalfox disponible`, 'success');
            return true;
        } catch (error) {
            this.logger.addLog(`⚠ dalfox no encontrado. Instala con: go install github.com/hahwul/dalfox/v2@latest`, 'warning');
            return false;
        }
    }

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

        if (this.config.headers) {
            for (const [key, value] of Object.entries(this.config.headers)) {
                args.push('--header', `${key}: ${value}`);
            }
        }

        if (this.config.customHeaders) {
            const headers = this.config.customHeaders.split('\n').filter(h => h.trim());
            headers.forEach(header => {
                args.push('--header', header.trim());
            });
        }

        this.logger.addLog(`Ejecutando: dalfox ${args.join(' ')}`, 'debug', null, true);

        return new Promise((resolve) => {
            const proc = spawn(this.toolConfig.path, args);
            const processKey = `dalfox-${url}`;
            this.activeProcesses.set(processKey, proc);

            let jsonBuffer = '';
            let processedVulnerabilities = new Set();

            let streamBuffer = '';

            proc.stdout.on('data', (data) => {
                const chunk = data.toString();
                process.stdout.write(`[dalfox stdout] ${chunk}`);
                streamBuffer += chunk;

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
                            const objStr = streamBuffer.slice(startIdx, i + 1);
                            objects.push(objStr);
                            startIdx = -1;
                        }
                    }
                }

                if (objects.length > 0) {
                    const lastObj = objects[objects.length - 1];
                    const lastPos = streamBuffer.indexOf(lastObj) + lastObj.length;
                    streamBuffer = streamBuffer.slice(lastPos);
                }


                for (const [i, objText] of objects.entries()) {
                    const trimmed = objText.trim();
                    try {
                        const result = JSON.parse(trimmed);
                        if (result.type === 'V' || result.type === 'POC' || result.type === 'VULN') {
                            const vulnKey = `${result.param || 'unknown'}-${result.payload || 'unknown'}`;
                            if (!processedVulnerabilities.has(vulnKey)) {
                                processedVulnerabilities.add(vulnKey);
                                this._parseOutput(result, onVulnerabilityFound);
                            } else {
                            }
                        } else {
                        }
                    } catch (parseErr) {
                    }
                }
            });

            proc.stderr.on('data', (data) => {
                const error = data.toString();
                
                process.stderr.write(`[dalfox stderr] ${error}`);
                
                const errorTrimmed = error.trim();
                
                if (!errorTrimmed) {
                    return;
                }
                
                if (errorTrimmed.includes('Loopback') || 
                    errorTrimmed.includes('could not unmarshal event') ||
                    errorTrimmed.includes('IPAddressSpace') ||
                    errorTrimmed.includes('unknown IPAddressSpace value')) {
                    return;
                }
                
                if (errorTrimmed.includes('ERROR:') || errorTrimmed.includes('FATAL:')) {
                    if (!errorTrimmed.match(/Loopback|IPAddressSpace|unmarshal/i)) {
                        this.logger.addLog(`dalfox stderr: ${errorTrimmed}`, 'warning');
                    } else {
                    }
                } else {
                    this.logger.addLog(`dalfox stderr: ${errorTrimmed}`, 'debug', null, true);
                }
            });

            proc.on('close', (code) => {
                this.activeProcesses.delete(processKey);

                if (jsonBuffer.trim()) {
                    try {
                        const trimmed = jsonBuffer.trim();
                        if (trimmed.startsWith('{') && this._isVulnerabilityJson(trimmed)) {
                            const result = JSON.parse(trimmed);
                            if (result.type === 'V' || result.type === 'POC' || result.type === 'VULN') {
                                const vulnKey = `${result.param || 'unknown'}-${result.payload || 'unknown'}`;
                                if (!processedVulnerabilities.has(vulnKey)) {
                                    processedVulnerabilities.add(vulnKey);
                                    this._parseOutput(result, onVulnerabilityFound);
                                } else {
                                }
                            } else {
                            }
                        } else {
                        }
                    } catch (finalParseErr) {
                    }
                } else {
                }
                
                resolve();
            });

            proc.on('error', (error) => {
                this.activeProcesses.delete(processKey);
                this.logger.addLog(`Error ejecutando dalfox: ${error.message}`, 'error');
                resolve();
            });

            setTimeout(() => {
                if (this.activeProcesses.has(processKey)) {
                    proc.kill('SIGTERM');
                    this.logger.addLog(`Timeout en fuzzing XSS para ${url}`, 'warning');
                    resolve();
                }
            }, this.toolConfig.timeout * 1000);
        });
    }

    _isVulnerabilityJson(line) {
        if (!line.startsWith('{')) return false;
        const match = /"type"\s*:\s*"(V|POC|VULN)"/.test(line);
        return match;
    }

    _parseOutput(result, onVulnerabilityFound) {
        const vulnType = result.type;

        if (vulnType === 'V' || vulnType === 'POC' || vulnType === 'VULN') {
            let endpoint = 'unknown';
            
            if (result.data) {
                if (typeof result.data === 'string') {
                    endpoint = result.data;
                } else if (typeof result.data === 'object' && result.data.url) {
                    endpoint = result.data.url;
                } else if (typeof result.data === 'object' && result.data.target) {
                    endpoint = result.data.target;
                }
            }
            
            if (endpoint === 'unknown' && result.url) {
                endpoint = result.url;
            }
            
            if (endpoint === 'unknown') {
                const jsonStr = JSON.stringify(result);
                const urlMatch = jsonStr.match(/https?:\/\/[^\s"]+/);
                if (urlMatch) {
                    endpoint = urlMatch[0];
                }
            }
            
            const param = result.param || result.data?.param || 'unknown';
            
            const payload = result.payload || result.data?.payload || 'detected';
            
            const injectType = result.inject_type || result.data?.inject_type || '';
            const method = result.method || result.data?.method || 'GET';
            
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

            this.logger.addLog(`✓ XSS detectado: ${endpoint} - Parámetro: ${param}`, 'success');
            this.logger.addLog(`  Tipo: ${vulnType} | Severidad: ${vuln.severity} | Payload: ${payload.substring(0, 50)}${payload.length > 50 ? '...' : ''}`, 'info');


            if (onVulnerabilityFound) {
                try {
                    onVulnerabilityFound(vuln);
                } catch (cbErr) {
                }
            } else {
            }
        } else if (result.type === 'GREP' || result.type === 'INFO') {
            if (result.message && !result.message.match(/Loopback|IPAddressSpace/i)) {
                this.logger.addLog(result.message, 'debug', null, true);
            }
        } else {
        }
    }

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

    async runCommand(args, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const proc = spawn(this.toolConfig.path, args);
            const timer = setTimeout(() => {
                try { proc.kill(); } catch (e) {}
                reject(new Error('Command timeout'));
            }, timeout);

            proc.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0) resolve();
                else reject(new Error(`Command failed with code ${code}`));
            });

            proc.on('error', (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
}

module.exports = DalfoxExecutor;
