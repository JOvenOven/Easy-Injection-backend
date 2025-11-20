// Tests críticos para integración con Dalfox (XSS Scanner)
const { spawn } = require('child_process');
const EventEmitter = require('events');

// Mock del ejecutor de Dalfox
class DalfoxExecutor extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.process = null;
        this.isRunning = false;
        this.results = [];
    }

    buildCommand(target, options = {}) {
        const args = ['url', target];
        
        if (options.cookie) args.push('--cookie', options.cookie);
        if (options.headers) {
            options.headers.forEach(h => {
                args.push('--header', h);
            });
        }
        if (options.outputFormat === 'json') args.push('--format', 'json');
        if (options.blindMode) args.push('--blind');
        if (options.timeout) args.push('--timeout', options.timeout.toString());

        return { cmd: 'dalfox', args };
    }

    async execute(target, options = {}) {
        if (this.isRunning) {
            throw new Error('Dalfox already running');
        }

        this.isRunning = true;
        this.emit('execution:start', { target, options });

        const { cmd, args } = this.buildCommand(target, options);

        return new Promise((resolve, reject) => {
            // Simular proceso de Dalfox
            setTimeout(() => {
                this.isRunning = false;
                
                const mockResults = [
                    {
                        type: 'XSS',
                        severity: 'high',
                        poc: '<script>alert(1)</script>',
                        parameter: 'q',
                        url: target,
                        evidence: 'Script execution detected',
                        cwe: 'CWE-79'
                    }
                ];

                this.results = mockResults;
                this.emit('execution:complete', { results: mockResults });
                resolve(mockResults);
            }, 100);
        });
    }

    parseOutput(jsonOutput) {
        try {
            const data = JSON.parse(jsonOutput);
            return data.map(item => ({
                type: 'XSS',
                severity: this.getSeverity(item),
                parameter: item.param || 'unknown',
                poc: item.poc || item.payload,
                url: item.url,
                evidence: item.evidence || '',
                cwe: item.cwe || 'CWE-79'
            }));
        } catch (error) {
            throw new Error('Invalid JSON output from Dalfox');
        }
    }

    getSeverity(vulnData) {
        if (vulnData.severity) return vulnData.severity;
        if (vulnData.poc && vulnData.poc.includes('alert')) return 'high';
        return 'medium';
    }

    stop() {
        if (this.process) {
            this.process.kill('SIGTERM');
            this.isRunning = false;
            this.emit('execution:stopped');
        }
    }
}

describe('Dalfox Executor - Tests Críticos', () => {
    let executor;

    beforeEach(() => {
        executor = new DalfoxExecutor({
            timeout: 30,
            outputFormat: 'json'
        });
    });

    describe('Construcción de comandos', () => {
        it('debe construir comando básico con opciones', () => {
            const { cmd, args } = executor.buildCommand('http://testphp.vulnweb.com', {
                cookie: 'session=abc123',
                outputFormat: 'json',
                timeout: 60
            });

            expect(cmd).toBe('dalfox');
            expect(args).toContain('url');
            expect(args).toContain('http://testphp.vulnweb.com');
            expect(args).toContain('--cookie');
            expect(args).toContain('--format');
            expect(args).toContain('--timeout');
        });
    });

    describe('Ejecución de escaneos', () => {
        it('debe ejecutar escaneo y emitir eventos', async () => {
            const startSpy = jest.fn();
            const completeSpy = jest.fn();
            executor.on('execution:start', startSpy);
            executor.on('execution:complete', completeSpy);

            const results = await executor.execute('http://testphp.vulnweb.com?search=test');

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(startSpy).toHaveBeenCalled();
            expect(completeSpy).toHaveBeenCalled();
            expect(executor.results[0]).toHaveProperty('type', 'XSS');
        });

        it('debe fallar si ya está ejecutándose', async () => {
            const promise1 = executor.execute('http://testphp.vulnweb.com');
            
            await expect(
                executor.execute('http://testhtml5.vulnweb.com')
            ).rejects.toThrow('Dalfox already running');

            await promise1;
        });
    });

    describe('Parsing de resultados JSON', () => {
        it('debe parsear output JSON válido', () => {
            const jsonOutput = JSON.stringify([
                {
                    param: 'search',
                    poc: '<script>alert("XSS")</script>',
                    url: 'http://testphp.vulnweb.com?search=test',
                    evidence: 'Script execution confirmed',
                    severity: 'high'
                }
            ]);

            const results = executor.parseOutput(jsonOutput);

            expect(results).toHaveLength(1);
            expect(results[0].type).toBe('XSS');
            expect(results[0].parameter).toBe('search');
            expect(results[0].cwe).toBe('CWE-79');
        });

        it('debe lanzar error con JSON inválido', () => {
            expect(() => {
                executor.parseOutput('invalid json {]');
            }).toThrow('Invalid JSON output from Dalfox');
        });
    });

    describe('Clasificación de severidad', () => {
        it('debe clasificar severidad correctamente', () => {
            expect(executor.getSeverity({ severity: 'critical' })).toBe('critical');
            expect(executor.getSeverity({ poc: '<script>alert(1)</script>' })).toBe('high');
            expect(executor.getSeverity({ poc: '<img src=x>' })).toBe('medium');
        });
    });

    describe('Detección de vulnerabilidades XSS', () => {
        it('debe detectar XSS con POC y parámetro', async () => {
            const results = await executor.execute('http://testphp.vulnweb.com?search=<script>alert(1)</script>');

            expect(results[0].type).toBe('XSS');
            expect(results[0]).toHaveProperty('poc');
            expect(results[0]).toHaveProperty('parameter');
            expect(results[0].cwe).toBe('CWE-79');
        });
    });
});
