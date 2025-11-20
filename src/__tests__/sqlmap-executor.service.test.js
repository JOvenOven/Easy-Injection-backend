// Tests críticos para integración con SQLMap (SQL Injection Scanner)
const { spawn } = require('child_process');
const EventEmitter = require('events');

// Mock del ejecutor de SQLMap
class SQLMapExecutor extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.process = null;
        this.isRunning = false;
        this.results = [];
        this.sessionFile = config.sessionFile || '/tmp/sqlmap.session';
    }

    buildCommand(target, options = {}) {
        const args = ['-u', target];
        
        // Opciones de autenticación
        if (options.cookie) args.push('--cookie', options.cookie);
        if (options.headers) {
            args.push('--headers', options.headers);
        }
        
        // Opciones de técnicas
        if (options.technique) args.push('--technique', options.technique);
        if (options.level) args.push('--level', options.level.toString());
        if (options.risk) args.push('--risk', options.risk.toString());
        
        // Opciones de base de datos
        if (options.dbms) args.push('--dbms', options.dbms);
        if (options.dbs) args.push('--dbs');
        if (options.tables) args.push('--tables');
        if (options.columns) args.push('--columns');
        if (options.dump) args.push('--dump');
        
        // Opciones de output
        if (options.batch) args.push('--batch');
        if (options.outputDir) args.push('--output-dir', options.outputDir);
        
        // Opciones de performance
        if (options.threads) args.push('--threads', options.threads.toString());
        if (options.timeout) args.push('--timeout', options.timeout.toString());
        
        // Session file
        args.push('--session-file', this.sessionFile);
        args.push('--flush-session');

        return { cmd: 'sqlmap', args };
    }

    async execute(target, options = {}) {
        if (this.isRunning) {
            throw new Error('SQLMap already running');
        }

        this.isRunning = true;
        this.emit('execution:start', { target, options });

        const { cmd, args } = this.buildCommand(target, options);

        return new Promise((resolve, reject) => {
            // Simular proceso de SQLMap
            setTimeout(() => {
                this.isRunning = false;
                
                const mockResults = [
                    {
                        type: 'SQLi',
                        severity: 'high',
                        parameter: 'id',
                        url: target,
                        technique: 'boolean-based blind',
                        dbms: 'MySQL',
                        payload: "1 AND 1=1",
                        evidence: 'Database: testdb',
                        injectable: true,
                        cwe: 'CWE-89'
                    }
                ];

                this.results = mockResults;
                this.emit('execution:complete', { results: mockResults });
                resolve(mockResults);
            }, 150);
        });
    }

    parseOutput(output) {
        const vulnerabilities = [];
        const lines = output.split('\n');
        
        let currentVuln = null;

        lines.forEach(line => {
            // Detectar parámetro vulnerable
            if (line.includes('Parameter:')) {
                if (currentVuln) vulnerabilities.push(currentVuln);
                currentVuln = {
                    type: 'SQLi',
                    parameter: line.split(':')[1].trim(),
                    injectable: true,
                    cwe: 'CWE-89'
                };
            }

            // Detectar técnica
            if (line.includes('Type:') && currentVuln) {
                currentVuln.technique = line.split(':')[1].trim();
            }

            // Detectar DBMS
            if (line.includes('back-end DBMS:') && currentVuln) {
                currentVuln.dbms = line.split(':')[1].trim();
            }

            // Detectar payload
            if (line.includes('Payload:') && currentVuln) {
                currentVuln.payload = line.split(':')[1].trim();
            }
        });

        if (currentVuln) vulnerabilities.push(currentVuln);

        return vulnerabilities.map(v => ({
            ...v,
            severity: this.getSeverity(v)
        }));
    }

    getSeverity(vulnData) {
        if (vulnData.technique && vulnData.technique.includes('UNION')) return 'critical';
        if (vulnData.technique && vulnData.technique.includes('error-based')) return 'high';
        if (vulnData.injectable) return 'high';
        return 'medium';
    }

    async testParameter(url, parameter, options = {}) {
        const testOptions = {
            ...options,
            testParameter: parameter,
            batch: true
        };

        return await this.execute(url, testOptions);
    }

    stop() {
        if (this.process) {
            this.process.kill('SIGTERM');
            this.isRunning = false;
            this.emit('execution:stopped');
        }
    }
}

describe('SQLMap Executor - Tests Críticos', () => {
    let executor;

    beforeEach(() => {
        executor = new SQLMapExecutor({
            timeout: 60,
            sessionFile: '/tmp/test-sqlmap.session'
        });
    });

    describe('Construcción de comandos', () => {
        it('debe construir comando con opciones completas', () => {
            const { cmd, args } = executor.buildCommand('http://testphp.vulnweb.com/artists.php?artist=1', {
                cookie: 'PHPSESSID=abc123',
                level: 3,
                risk: 2,
                technique: 'BEUST',
                batch: true,
                threads: 5
            });

            expect(cmd).toBe('sqlmap');
            expect(args).toContain('-u');
            expect(args).toContain('http://testphp.vulnweb.com/artists.php?artist=1');
            expect(args).toContain('--cookie');
            expect(args).toContain('--level');
            expect(args).toContain('--batch');
            expect(args).toContain('--session-file');
        });
    });

    describe('Ejecución de escaneos', () => {
        it('debe ejecutar escaneo y emitir eventos', async () => {
            const startSpy = jest.fn();
            const completeSpy = jest.fn();
            executor.on('execution:start', startSpy);
            executor.on('execution:complete', completeSpy);

            const results = await executor.execute('http://testphp.vulnweb.com/artists.php?artist=1');

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(startSpy).toHaveBeenCalled();
            expect(completeSpy).toHaveBeenCalled();
            expect(executor.results[0]).toHaveProperty('type', 'SQLi');
        });

        it('debe fallar si ya está ejecutándose', async () => {
            const promise1 = executor.execute('http://testphp.vulnweb.com/artists.php?artist=1');
            
            await expect(
                executor.execute('http://testphp.vulnweb.com/listproducts.php?cat=1')
            ).rejects.toThrow('SQLMap already running');

            await promise1;
        });
    });

    describe('Parsing de output', () => {
        it('debe parsear output con vulnerabilidad', () => {
            const output = `
Parameter: id (GET)
    Type: boolean-based blind
    Title: AND boolean-based blind - WHERE or HAVING clause
    Payload: id=1 AND 1=1
    
back-end DBMS: MySQL >= 5.0
            `;

            const results = executor.parseOutput(output);

            expect(results).toHaveLength(1);
            expect(results[0].parameter).toContain('id');
            expect(results[0].technique).toContain('boolean-based blind');
            expect(results[0].dbms).toContain('MySQL');
        });

        it('debe parsear múltiples vulnerabilidades', () => {
            const output = `
Parameter: id (GET)
    Type: boolean-based blind
    
Parameter: name (POST)
    Type: error-based
    `;

            const results = executor.parseOutput(output);

            expect(results).toHaveLength(2);
            expect(results[0].parameter).toContain('id');
            expect(results[1].parameter).toContain('name');
        });

        it('debe extraer payload', () => {
            const output = `
Parameter: id (GET)
    Type: UNION query
    Payload: id=1 UNION ALL SELECT NULL,NULL,NULL-- -
            `;

            const results = executor.parseOutput(output);

            expect(results[0].payload).toBeTruthy();
            expect(results[0].payload).toContain('UNION');
        });
    });

    describe('Clasificación de severidad', () => {
        it('debe clasificar severidad según técnica', () => {
            expect(executor.getSeverity({ technique: 'UNION query' })).toBe('critical');
            expect(executor.getSeverity({ technique: 'error-based' })).toBe('high');
            expect(executor.getSeverity({ injectable: true })).toBe('high');
            expect(executor.getSeverity({})).toBe('medium');
        });
    });

    describe('Detección de vulnerabilidades SQLi', () => {
        it('debe detectar SQLi con información completa', async () => {
            const results = await executor.execute('http://testphp.vulnweb.com/artists.php?artist=1');

            expect(results[0].type).toBe('SQLi');
            expect(results[0]).toHaveProperty('parameter');
            expect(results[0]).toHaveProperty('dbms');
            expect(results[0]).toHaveProperty('technique');
            expect(results[0].injectable).toBe(true);
            expect(results[0].cwe).toBe('CWE-89');
        });
    });
});
