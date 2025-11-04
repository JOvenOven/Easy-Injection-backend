/**
 * SQLMap executor module - handles all SQLMap-related operations
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class SqlmapExecutor {
    constructor(config, logger, emitter, activeProcesses) {
        this.config = config;
        this.logger = logger;
        this.emitter = emitter;
        this.activeProcesses = activeProcesses;
        
        this.toolConfig = {
            path: config.sqlmapPath || 'sqlmap',
            commonArgs: [
                '--batch',
                '--random-agent'
            ],
            crawlDepth: config.crawlDepth || 2,
            level: config.level || 1,
            risk: config.risk || 1,
            threads: config.threads || 1,
            timeout: config.timeout || 30
        };

        // Setup directories for crawl CSV processing
        this.tmpDir = config.tmpDir || path.join(os.tmpdir(), 'easyinjection_sqlmap_tmp');
        this.outputDir = config.outputDir || null; // Should be passed as scan_<id> directory
    }

    /**
     * Check if sqlmap is available
     */
    async checkAvailability() {
        try {
            const result = await this.runCommand(['--version'], 5000);
            this.logger.addLog(`✓ sqlmap disponible: ${result.stdout?.slice(0,14)}`, 'success');
            return true;
        } catch (error) {
            this.logger.addLog(`⚠ sqlmap no encontrado. Asegúrate de que está instalado y en PATH`, 'warning');
            this.logger.addLog(`Ruta esperada: ${this.toolConfig.path}`, 'info');
            this.logger.addLog(`Detalles: ${error.message}`, 'error');
            if (error.stdout) this.logger.addLog(`stdout: ${error.stdout}`, 'debug');
            if (error.stderr) this.logger.addLog(`stderr: ${error.stderr}`, 'debug');
            return false;
        }
    }

    /**
     * Build --answers argument with all responses in CSV format
     * @returns {string} Formatted --answers argument
     */
    _buildAnswersArg() {
        const answers = [
            'do you want to check for the existence of site\'s sitemap(.xml)=N',
            'do you want to normalize crawling results=Y',
            'do you want to store crawling results to a temporary file for eventual further processing with other tools=Y',
            'Do you want to skip further tests involving it?=n'
        ];
        // Format: --answers="answer1,answer2,answer3"
        // Note: The quotes are included in the string so spawn treats it as a single argument
        return `--answers="${answers.join(',')}"`;
    }

    /**
     * Run sqlmap crawl to discover endpoints
     * Detects when crawling is complete via stdout pattern matching,
     * stops the process, and processes the generated CSV to create targets.txt
     */
    async runCrawl() {
        // Ensure tmp directory exists
        if (!fs.existsSync(this.tmpDir)) {
            fs.mkdirSync(this.tmpDir, { recursive: true });
        }

        const args = [
            '-u', this.config.url,
            '--crawl', this.toolConfig.crawlDepth.toString(),
            this._buildAnswersArg(),
            '--forms',
            ...this.toolConfig.commonArgs,
            '--threads', this.toolConfig.threads.toString(),
            '--tmp-dir', this.tmpDir,
            '-v', '1'
        ];

        this._addDbmsAndHeaders(args);

        this.logger.addLog(`Ejecutando: sqlmap ${args.join(' ')}`, 'debug', null, true);

        return new Promise(async (resolve, reject) => {
            const { executable, args: spawnArgs, spawnOpts } = this.getSpawnCommandForTool(this.toolConfig.path, args);
            this.logger.addLog(`DEBUG spawn: ${executable} ${spawnArgs.join(' ')}`, 'debug', null, true);
            const proc = spawn(executable, spawnArgs, spawnOpts);
            this.activeProcesses.set('sqlmap-crawl', proc);

            let buffer = '';
            let crawlFinished = false;
            let timeoutTimer = null;
            const finishPattern = /\[?\d{2}:\d{2}:\d{2}\]?.*\[INFO\]\s+found a total of \d+ targets/i;
            // const finishPattern = /\[\d{2}:\d{2}:\d{2}\]\s+\[INFO\]\s+using\s+['"].+?results-[^'"]+\.csv['"]\s+as the CSV results file in multiple targets mode/i;

            // Graceful kill function
            const gracefulKill = async (proc, gracePeriod = 300) => {
                try {
                    proc.kill('SIGTERM');
                    await new Promise(resolve => setTimeout(resolve, gracePeriod));
                    
                    if (!proc.killed && proc.exitCode === null) {
                        proc.kill('SIGKILL');
                        this.logger.addLog('Forzando terminación del proceso sqlmap', 'debug');
                    }
                } catch (error) {
                    this.logger.addLog(`Error al terminar proceso: ${error.message}`, 'warning');
                }
            };

            const processCrawlResults = async () => {
                if (crawlFinished) return;
                crawlFinished = true;

                // Clear timeout
                if (timeoutTimer) {
                    clearTimeout(timeoutTimer);
                    timeoutTimer = null;
                }

                try {
                    // Wait longer for CSV to be written after process is killed
                    // sqlmap needs time to flush and close the CSV file
                    await new Promise(resolve => setTimeout(resolve, 5000));

                    // Find CSV file in tmp-dir
                    // Try multiple times with increasing delays
                    let csvPath = null;
                    for (let attempt = 0; attempt < 3; attempt++) {
                        csvPath = await this.findCrawlCsv(this.tmpDir);
                        if (csvPath) {
                            break;
                        }
                        // Wait a bit more before next attempt
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    
                    if (!csvPath) {
                        this.logger.addLog(`⚠ No se encontró CSV de crawling en tmp-dir: ${this.tmpDir}`, 'warning');
                        // Log directory contents for debugging
                        try {
                            const listAllFiles = (dir, fileList = []) => {
                                const files = fs.readdirSync(dir);
                                files.forEach(file => {
                                    const filePath = path.join(dir, file);
                                    if (fs.statSync(filePath).isDirectory()) {
                                        listAllFiles(filePath, fileList);
                                    } else if (file.endsWith('.csv')) {
                                        fileList.push(filePath);
                                    }
                                });
                                return fileList;
                            };
                            const csvFiles = listAllFiles(this.tmpDir);
                            if (csvFiles.length > 0) {
                                console.log(`Archivos CSV encontrados: ${csvFiles.map(f => path.basename(f)).join(', ')}`)
                            } else {
                                this.logger.addLog(`No se encontraron archivos CSV en tmp-dir`, 'debug');
                            }
                        } catch (err) {
                            this.logger.addLog(`Error listando tmp-dir: ${err.message}`, 'debug');
                        }
                        this.emitter.emit('crawler:failed', { reason: 'CSV not found' });
                        resolve();
                        return;
                    }

                    console.log(`CSV encontrado: ${csvPath}`)

                    // Emit crawler finished event with CSV path
                    // The discovery phase will process the CSV to extract endpoints and parameters
                    this.emitter.emit('crawler:finished', {
                        csvPath
                    });

                    resolve();
                } catch (error) {
                    this.logger.addLog(`Error procesando resultados del crawl: ${error.message}`, 'error');
                    this.emitter.emit('crawler:failed', { reason: error.message });
                    reject(error);
                }
            };

            proc.stdout.on('data', (data) => {
                const output = data.toString();
                // Show raw sqlmap output in console
                process.stdout.write(`[sqlmap crawl stdout] ${output}`);
                
                buffer += output;

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    // Ignore all sqlmap logs during crawling - not relevant to discovery phase
                    // Only detect completion pattern
                    if (finishPattern.test(line) && !crawlFinished) {
                        this.logger.addLog('✓ Crawling completado, procesando resultados...', 'success');
                        // Wait a bit before killing to ensure sqlmap finishes writing
                        setTimeout(() => {
                            gracefulKill(proc).then(() => {
                                processCrawlResults();
                            });
                        }, 1000);
                    }
                }
            });

            proc.stderr.on('data', (data) => {
                const error = data.toString();
                // Show raw sqlmap stderr in console
                process.stderr.write(`[sqlmap crawl stderr] ${error}`);
                
                if (error.trim()) {
                    // Don't send to frontend, only console
                    this.logger.addLog(`sqlmap stderr: ${error.trim()}`, 'debug', null, true);
                }
            });

            proc.on('close', async (code) => {
                this.activeProcesses.delete('sqlmap-crawl');
                
                if (crawlFinished) {
                    // Already processed
                    return;
                }

                // If process closed naturally, try to process results
                if (code === 0 || code === null) {
                    await processCrawlResults();
                } else if (!crawlFinished) {
                    reject(new Error(`sqlmap crawl exited with code ${code}`));
                }
            });

            proc.on('error', (error) => {
                this.activeProcesses.delete('sqlmap-crawl');
                if (timeoutTimer) clearTimeout(timeoutTimer);
                reject(new Error(`Failed to start sqlmap: ${error.message}`));
            });

            // Timeout fallback
            timeoutTimer = setTimeout(async () => {
                if (this.activeProcesses.has('sqlmap-crawl') && !crawlFinished) {
                    await gracefulKill(proc);
                    this.logger.addLog('Timeout de crawling alcanzado, intentando procesar resultados...', 'warning');
                    await processCrawlResults();
                }
            }, this.toolConfig.timeout * 1000);
        });
    }
    
    /**
     * Find crawl CSV file in tmp-dir
     * Searches for CSV files with various patterns that sqlmap might use
     */
    async findCrawlCsv(tmpDir) {
        try {
            if (!fs.existsSync(tmpDir)) {
                this.logger.addLog(`tmp-dir no existe: ${tmpDir}`, 'debug');
                return null;
            }

            const files = [];
            
            // Search recursively for CSV files with multiple patterns
            // sqlmap can save CSV files with different naming patterns:
            // - sqlmapcrawler-*.csv
            // - crawler-*.csv  
            // - *.csv (any CSV in tmp-dir)
            const searchDir = (dir, depth = 0) => {
                try {
                    // Limit recursion depth to avoid infinite loops
                    if (depth > 5) return;
                    
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        
                        try {
                            if (entry.isDirectory()) {
                                searchDir(fullPath, depth + 1);
                            } else if (entry.isFile() && entry.name.endsWith('.csv')) {
                                // Accept any CSV file that was recently modified (within last hour)
                                // sqlmap can save CSV files with different naming patterns
                                const stats = fs.statSync(fullPath);
                                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                                if (stats.mtime.getTime() > oneHourAgo) {
                                    files.push({ path: fullPath, mtime: stats.mtime });
                                }
                            }
                        } catch (entryError) {
                            // Skip entries we can't access
                            continue;
                        }
                    }
                } catch (error) {
                    this.logger.addLog(`Error buscando CSV en ${dir}: ${error.message}`, 'debug');
                }
            };

            searchDir(tmpDir);

            if (files.length === 0) {
                this.logger.addLog(`No se encontraron archivos CSV en ${tmpDir}`, 'debug');
                return null;
            }

            // Return the most recent file
            files.sort((a, b) => b.mtime - a.mtime);
            const selectedFile = files[0].path;
            console.log(`CSV encontrado: ${selectedFile} (${files.length} archivo(s) CSV encontrado(s))`)
            return selectedFile;
        } catch (error) {
            this.logger.addLog(`Error buscando CSV: ${error.message}`, 'error');
            return null;
        }
    }

    /**
     * Process crawl CSV to extract endpoints and parameters directly
     * Returns endpoints with their parameters and a flat list of all parameters
     */
    async processCrawlCsvToEndpointsAndParams(csvPath) {
        try {
            if (!fs.existsSync(csvPath)) {
                throw new Error(`CSV file not found: ${csvPath}`);
            }

            const csvContent = fs.readFileSync(csvPath, 'utf-8');
            const lines = csvContent.split('\n').map(l => l.trim()).filter(l => l);

            if (lines.length < 2) {
                throw new Error('CSV file has no data rows');
            }

            // Skip header (first line should be "URL,POST")
            const dataLines = lines.slice(1);
            const endpoints = [];
            const parameters = [];
            const endpointMap = new Map(); // Track unique endpoints by URL+method

            for (const line of dataLines) {
                // Split by FIRST comma only
                const firstCommaIndex = line.indexOf(',');
                
                let url, method, postData;
                
                if (firstCommaIndex === -1) {
                    // No comma found, treat entire line as URL (GET)
                    url = line.trim();
                    method = 'GET';
                    postData = null;
                } else {
                    // Split at first comma
                    url = line.substring(0, firstCommaIndex).trim();
                    postData = line.substring(firstCommaIndex + 1).trim();
                    method = postData ? 'POST' : 'GET';
                }

                if (!url) {
                    continue; // Skip lines without URL
                }

                // Extract parameters from URL
                const urlParams = this._extractUrlParams(url);
                
                // Extract parameters from POST data if exists
                const postParams = postData ? this._extractPostParams(postData) : [];

                // Combine all parameters for this endpoint
                const allParams = [...urlParams, ...postParams];
                
                // Create endpoint key for deduplication
                const endpointKey = `${method}:${url}`;
                
                if (!endpointMap.has(endpointKey)) {
                    const endpoint = {
                        url,
                        method,
                        parameters: allParams,
                        postData: postData || null // Store original POST data for targets.txt generation
                    };
                    
                    endpoints.push(endpoint);
                    endpointMap.set(endpointKey, endpoint);
                    
                    // Add all parameters to flat list
                    for (const paramName of allParams) {
                        parameters.push({
                            endpoint: url,
                            name: paramName,
                            type: method === 'GET' ? 'query' : 'body',
                            testable: true
                        });
                    }
                } else {
                    // Endpoint already exists, merge parameters
                    const existingEndpoint = endpointMap.get(endpointKey);
                    for (const paramName of allParams) {
                        if (!existingEndpoint.parameters.includes(paramName)) {
                            existingEndpoint.parameters.push(paramName);
                            parameters.push({
                                endpoint: url,
                                name: paramName,
                                type: method === 'GET' ? 'query' : 'body',
                                testable: true
                            });
                        }
                    }
                    // Update POST data if this endpoint has POST data and the existing one doesn't
                    if (postData && !existingEndpoint.postData) {
                        existingEndpoint.postData = postData;
                    }
                }
            }

            return {
                endpoints,
                parameters
            };
        } catch (error) {
            this.logger.addLog(`Error procesando CSV: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Process crawl CSV to get_targets.txt and post_targets.txt (legacy method - kept for compatibility)
     * @deprecated Use processCrawlCsvToEndpointsAndParams instead
     */
    async _processCrawlCsvToTargets(csvPath) {
        const result = await this.processCrawlCsvToEndpointsAndParams(csvPath);
        
        // Ensure output directory exists
        const outputDir = this.outputDir || path.join(os.tmpdir(), 'easyinjection_scans');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const getTargets = [];
        const postTargets = [];

        for (const endpoint of result.endpoints) {
            if (endpoint.method === 'GET') {
                getTargets.push(endpoint.url);
            } else {
                // Use original POST data from CSV if available, otherwise reconstruct from parameters
                const postData = endpoint.postData || endpoint.parameters.map(p => `${p}=`).join('&');
                postTargets.push(`${endpoint.url}|||${postData}`);
            }
        }

        // Write get_targets.txt (create even if empty)
        const getTargetsPath = path.join(outputDir, 'get_targets.txt');
        fs.writeFileSync(getTargetsPath, getTargets.join('\n') + (getTargets.length > 0 ? '\n' : ''), 'utf-8');
        this.logger.addLog(`✓ get_targets.txt generado: ${getTargets.length} targets`, 'debug');

        // Write post_targets.txt (create even if empty)
        const postTargetsPath = path.join(outputDir, 'post_targets.txt');
        fs.writeFileSync(postTargetsPath, postTargets.join('\n') + (postTargets.length > 0 ? '\n' : ''), 'utf-8');
        this.logger.addLog(`✓ post_targets.txt generado: ${postTargets.length} targets`, 'debug');

        return {
            getTargetsPath,
            postTargetsPath,
            getCount: getTargets.length,
            postCount: postTargets.length
        };
    }

    /**
     * Process GET targets from get_targets.txt
     * Executes sqlmap and dalfox for each URL
     * @param {string} getTargetsPath - Path to get_targets.txt
     * @param {Function} onEndpointDiscovered - Callback when endpoint is discovered
     * @param {Function} onVulnerabilityFound - Callback when vulnerability is found
     * @param {Object} options - Optional: { questionHandler, dalfoxExecutor }
     */
    async processGetTargets(getTargetsPath, onEndpointDiscovered, onVulnerabilityFound, options = {}) {
        if (!fs.existsSync(getTargetsPath)) {
            this.logger.addLog(`get_targets.txt no encontrado: ${getTargetsPath}`, 'warning');
            return;
        }

        const content = fs.readFileSync(getTargetsPath, 'utf-8');
        const urls = content.split('\n').map(l => l.trim()).filter(l => l);

        if (urls.length === 0) {
            this.logger.addLog('No hay targets GET para procesar', 'info');
            return;
        }

        this.logger.addLog(`Procesando ${urls.length} targets GET...`, 'info');

        for (const url of urls) {
            if (!url) continue;

            if (options.questionHandler) {
                await options.questionHandler.waitIfPaused();
            }

            try {
                // Emit endpoint discovered event
                if (onEndpointDiscovered) {
                    onEndpointDiscovered({
                        url,
                        method: 'GET',
                        parameters: this._extractUrlParams(url)
                    });
                }

                // Test with sqlmap if SQLi is enabled
                if (this.config.flags?.sqli !== false) {
                    await this._testUrlWithSqlmap(url, null, onVulnerabilityFound, options);
                }

                // Test with dalfox if XSS is enabled
                if (this.config.flags?.xss !== false && options.dalfoxExecutor) {
                    await options.dalfoxExecutor.scanUrl(url, onVulnerabilityFound);
                }
            } catch (error) {
                this.logger.addLog(`Error procesando GET target ${url}: ${error.message}`, 'warning');
            }
        }
    }

    /**
     * Process POST targets from post_targets.txt
     * Executes sqlmap with --data for each target
     * @param {string} postTargetsPath - Path to post_targets.txt
     * @param {Function} onEndpointDiscovered - Callback when endpoint is discovered
     * @param {Function} onVulnerabilityFound - Callback when vulnerability is found
     * @param {Object} options - Optional: { questionHandler, dalfoxExecutor }
     */
    async processPostTargets(postTargetsPath, onEndpointDiscovered, onVulnerabilityFound, options = {}) {
        if (!fs.existsSync(postTargetsPath)) {
            this.logger.addLog(`post_targets.txt no encontrado: ${postTargetsPath}`, 'warning');
            return;
        }

        const content = fs.readFileSync(postTargetsPath, 'utf-8');
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);

        if (lines.length === 0) {
            this.logger.addLog('No hay targets POST para procesar', 'info');
            return;
        }

        this.logger.addLog(`Procesando ${lines.length} targets POST...`, 'info');

        for (const line of lines) {
            if (!line) continue;

            // Parse format: <URL>|||<postdata>
            const parts = line.split('|||');
            if (parts.length < 2) {
                this.logger.addLog(`Formato inválido en línea POST: ${line}`, 'warning');
                continue;
            }

            const url = parts[0].trim();
            const postData = parts.slice(1).join('|||').trim(); // Rejoin in case postdata contains |||

            if (!url || !postData) {
                continue;
            }

            if (options.questionHandler) {
                await options.questionHandler.waitIfPaused();
            }

            try {
                // Emit endpoint discovered event
                if (onEndpointDiscovered) {
                    onEndpointDiscovered({
                        url,
                        method: 'POST',
                        parameters: this._extractPostParams(postData)
                    });
                }

                // Test with sqlmap if SQLi is enabled
                if (this.config.flags?.sqli !== false) {
                    await this._testUrlWithSqlmap(url, postData, onVulnerabilityFound, options);
                }

                // Dalfox POST testing is optional (requires explicit support)
                // Skipping for now as dalfox primarily focuses on GET requests
            } catch (error) {
                this.logger.addLog(`Error procesando POST target ${url}: ${error.message}`, 'warning');
            }
        }
    }

    /**
     * Test URL with sqlmap (GET or POST)
     */
    async _testUrlWithSqlmap(url, postData, onVulnerabilityFound, options = {}) {
        const args = [
            '-u', url,
            ...this.toolConfig.commonArgs,
            '--level', this.toolConfig.level.toString(),
            '--risk', this.toolConfig.risk.toString(),
            '--threads', this.toolConfig.threads.toString()
        ];

        if (postData) {
            args.push('--data', postData);
        }

        this._addDbmsAndHeaders(args);

        this.logger.addLog(`Ejecutando sqlmap sobre: ${url}${postData ? ' (POST)' : ''}`, 'debug', null, true);

        // Extract parameters from URL or POST data
        const params = postData ? this._extractPostParams(postData) : this._extractUrlParams(url);

        if (params.length === 0) {
            // If no params found, still test the URL (sqlmap will detect all parameters)
            try {
                const param = {
                    endpoint: url,
                    name: '*',
                    type: postData ? 'body' : 'query',
                    testable: true
                };

                await this.testParameter(param, 'detection', onVulnerabilityFound);
            } catch (error) {
                this.logger.addLog(`Error testeando URL ${url}: ${error.message}`, 'warning');
            }
        } else {
            for (const paramName of params) {
                try {
                    if (options.questionHandler) {
                        await options.questionHandler.waitIfPaused();
                    }

                    const param = {
                        endpoint: url,
                        name: paramName,
                        type: postData ? 'body' : 'query',
                        testable: true
                    };

                    await this.testParameter(param, 'detection', onVulnerabilityFound);
                } catch (error) {
                    this.logger.addLog(`Error testeando parámetro ${paramName}: ${error.message}`, 'warning');
                }
            }
        }
    }

    /**
     * Extract parameters from URL query string
     */
    _extractUrlParams(url) {
        try {
            const urlObj = new URL(url);
            return Array.from(urlObj.searchParams.keys());
        } catch {
            // Fallback: simple regex extraction
            const match = url.match(/[?&]([^=&]+)=/g);
            return match ? match.map(p => p.slice(1, -1)) : [];
        }
    }

    /**
     * Extract parameter names from POST data
     */
    _extractPostParams(postData) {
        const params = new Set();
        const pairs = postData.split('&');

        for (const pair of pairs) {
            const equalIndex = pair.indexOf('=');
            if (equalIndex > 0) {
                const key = pair.substring(0, equalIndex).trim();
                if (key) {
                    params.add(key);
                }
            }
        }

        return Array.from(params);
    }

    /**
     * Test multiple parameters for an endpoint in a single sqlmap execution
     * This is more efficient than testing each parameter separately
     */
    async testEndpoint(endpoint, params, phase = 'detection', onVulnerabilityFound) {
        if (!params || params.length === 0) {
            return;
        }

        // Build parameter list for sqlmap (-p param1,param2,param3)
        const paramNames = params.map(p => p.name).join(',');
        
        const args = [
            '-u', endpoint,
            '-p', paramNames,
            '--level', this.toolConfig.level.toString(),
            '--risk', this.toolConfig.risk.toString(),
            ...this.toolConfig.commonArgs,
            '--threads', this.toolConfig.threads.toString()
        ];

        this._addDbmsAndHeaders(args);

        if (phase === 'detection') {
            // args.push('--technique', 'B');
        }

        if (phase === 'fingerprint') {
            args.push('--fingerprint');
        }

        if (phase === 'exploit') {
            args.push('--current-db');
            args.push('--banner');
        }

        this.logger.addLog(`Ejecutando sqlmap para endpoint ${endpoint} con parámetros: ${paramNames}`, 'info');
        this.logger.addLog(`Ejecutando: sqlmap ${args.join(' ')}`, 'debug', null, true);

        return new Promise((resolve) => {
            const { executable, args: spawnArgs, spawnOpts } = this.getSpawnCommandForTool(this.toolConfig.path, args);
            this.logger.addLog(`DEBUG spawn: ${executable} ${spawnArgs.join(' ')}`, 'debug', null, true);
            const proc = spawn(executable, spawnArgs, spawnOpts);
            const processKey = `sqlmap-test-endpoint-${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}-${phase}`;
            this.activeProcesses.set(processKey, proc);

            let buffer = '';
            const foundVulnerabilities = new Map(); // Track by parameter name

            proc.stdout.on('data', (data) => {
                const output = data.toString();
                // Show raw sqlmap output in console
                process.stdout.write(`[sqlmap stdout] ${output}`);
                
                buffer += output;

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    // Parse output for each parameter
                    for (const param of params) {
                        this._parseTestOutput(line, param, phase);

                        // Check if this line indicates vulnerability for this parameter
                        if (line.match(/vulnerable|injectable|injection point/i)) {
                            // Check if this line mentions the parameter name
                            const paramMentioned = line.includes(param.name) || 
                                                   line.match(new RegExp(`Parameter:.*${param.name}`, 'i')) ||
                                                   line.match(new RegExp(`\\[CRITICAL\\].*${param.name}`, 'i'));
                            
                            if (paramMentioned && !foundVulnerabilities.has(param.name)) {
                                foundVulnerabilities.set(param.name, true);

                                let severity = 'critical';

                                if (onVulnerabilityFound) {
                                    onVulnerabilityFound({
                                        type: 'SQLi',
                                        severity: severity,
                                        endpoint: endpoint,
                                        parameter: param.name,
                                        description: `SQL Injection detectada en el parámetro '${param.name}': ${line.trim()}`
                                    });
                                }
                            }
                        }
                    }
                }
            });

            proc.stderr.on('data', (data) => {
                const error = data.toString();
                // Show raw sqlmap stderr in console
                process.stderr.write(`[sqlmap stderr] ${error}`);
                
                if (error.trim()) {
                    // Don't send to frontend, only console
                    this.logger.addLog(`sqlmap: ${error.trim()}`, 'debug', null, true);
                }
            });

            proc.on('close', () => {
                this.activeProcesses.delete(processKey);
                this.logger.addLog(`Completado escaneo SQLi para ${endpoint} (${foundVulnerabilities.size} vulnerabilidades encontradas)`, 'info');
                resolve();
            });

            proc.on('error', (error) => {
                this.activeProcesses.delete(processKey);
                this.logger.addLog(`Error ejecutando sqlmap: ${error.message}`, 'error');
                resolve();
            });

            setTimeout(() => {
                if (this.activeProcesses.has(processKey)) {
                    proc.kill('SIGTERM');
                    this.logger.addLog(`Timeout testeando endpoint ${endpoint}`, 'warning');
                    resolve();
                }
            }, this.toolConfig.timeout * 1000);
        });
    }

    /**
     * Test a parameter for SQL injection
     */
    async testParameter(param, phase = 'detection', onVulnerabilityFound) {
        const args = [
            '-u', param.endpoint,
            '-p', param.name,
            '--level', this.toolConfig.level.toString(),
            '--risk', this.toolConfig.risk.toString(),
            ...this.toolConfig.commonArgs,
            '--threads', this.toolConfig.threads.toString()
        ];

        this._addDbmsAndHeaders(args);

        if (phase === 'detection') {
            // args.push('--technique', 'B');
        }

        if (phase === 'fingerprint') {
            args.push('--fingerprint');
        }

        if (phase === 'exploit') {
            args.push('--current-db');
            args.push('--banner');
        }

        this.logger.addLog(`Ejecutando: sqlmap ${args.join(' ')}`, 'debug', null, true);

        return new Promise((resolve) => {
            const { executable, args: spawnArgs, spawnOpts } = this.getSpawnCommandForTool(this.toolConfig.path, args);
            this.logger.addLog(`DEBUG spawn: ${executable} ${spawnArgs.join(' ')}`, 'debug', null, true);
            const proc = spawn(executable, spawnArgs, spawnOpts);
            const processKey = `sqlmap-test-${param.name}-${phase}`;
            this.activeProcesses.set(processKey, proc);

            let buffer = '';
            let vulnerabilityFound = false;

            proc.stdout.on('data', (data) => {
                const output = data.toString();
                // Show raw sqlmap output in console
                process.stdout.write(`[sqlmap stdout] ${output}`);
                
                buffer += output;

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    this._parseTestOutput(line, param, phase);

                    if (line.match(/vulnerable|injectable|injection point/i) && !vulnerabilityFound) {
                        vulnerabilityFound = true;

                        // All SQLi vulnerabilities are critical by default
                        let severity = 'critical';
                        if (line.match(/time-based|stacked queries/i)) {
                            severity = 'critical';
                        } else if (line.match(/union|error-based/i)) {
                            severity = 'critical';
                        }

                        if (onVulnerabilityFound) {
                            onVulnerabilityFound({
                                type: 'SQLi',
                                severity: severity,
                                endpoint: param.endpoint,
                                parameter: param.name,
                                description: `SQL Injection detectada en el parámetro '${param.name}': ${line.trim()}`
                            });
                        }
                    }
                }
            });

            proc.stderr.on('data', (data) => {
                const error = data.toString();
                // Show raw sqlmap stderr in console
                process.stderr.write(`[sqlmap stderr] ${error}`);
                
                if (error.trim()) {
                    // Don't send to frontend, only console
                    this.logger.addLog(`sqlmap: ${error.trim()}`, 'debug', null, true);
                }
            });

            proc.on('close', () => {
                this.activeProcesses.delete(processKey);
                resolve();
            });

            proc.on('error', (error) => {
                this.activeProcesses.delete(processKey);
                this.logger.addLog(`Error ejecutando sqlmap: ${error.message}`, 'error');
                resolve();
            });

            setTimeout(() => {
                if (this.activeProcesses.has(processKey)) {
                    proc.kill('SIGTERM');
                    this.logger.addLog(`Timeout testeando ${param.name}`, 'warning');
                    resolve();
                }
            }, this.toolConfig.timeout * 1000);
        });
    }

    /**
     * Parse test output
     */
    _parseTestOutput(line, param, phase) {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Filter out sqlmap banner and ASCII art
        if (trimmed.match(/^[_\-\|\[\]H\s]+$/) || 
            trimmed.match(/^[_\-\|\[\]H]+$/) ||
            trimmed.match(/^\{1\.\d+\.\d+\.\d+/) ||
            trimmed.match(/^https:\/\/sqlmap\.org/) ||
            trimmed.match(/^legal disclaimer/i) ||
            trimmed.match(/^Usage of sqlmap/i) ||
            trimmed.match(/^\[!\] legal disclaimer/i) ||
            trimmed.match(/^\[.*\] legal disclaimer/i) ||
            trimmed.match(/^Press Enter to continue/i) ||
            trimmed.match(/^please enter/i) ||
            trimmed.match(/^\[.*\] starting @/i) ||
            trimmed.match(/^\[.*\] ending @/i) ||
            trimmed.match(/^\[.*\] using '.+' as the temporary directory/i) ||
            trimmed.match(/^\[.*\] fetched random HTTP User-Agent/i) ||
            trimmed.match(/^\[.*\] using '.+' as the CSV results file/i) ||
            trimmed.match(/^\[.*\] testing connection to the target URL/i) ||
            trimmed.match(/^\[.*\] WARNING\] running in a single-thread/i) ||
            // trimmed.match(/^\[.*\] searching for links/i) ||
            trimmed.match(/^\[.*\] starting crawler/i) ||
            trimmed.match(/^\[.*\] found a total of \d+ targets/i) ||
            trimmed.match(/^> Y$/i) ||
            trimmed.match(/^> \d+$/i) ||
            trimmed.match(/^> q$/i) ||
            trimmed.match(/^> [a-z]$/i) ||
            trimmed.match(/^Edit POST data/i) ||
            trimmed.match(/^there were multiple injection points/i) ||
            trimmed.match(/^\[0\] place:/i) ||
            trimmed.match(/^\[1\] place:/i) ||
            trimmed.match(/^\[q\] Quit/i) ||
            trimmed.match(/^\[.*\] INFO\] resuming back-end DBMS/i)) {
            // Skip banner and interactive prompts
            return;
        }

        if (line.match(/Parameter:.*vulnerable/i)) {
            this.logger.addLog(`✓ ${line.trim()}`, 'success');
        }

        if (line.match(/back-end DBMS/i)) {
            this.logger.addLog(`DBMS identificado: ${line.trim()}`, 'success');
        }

        if (line.match(/injection type:/i)) {
            this.logger.addLog(`Tipo de inyección: ${line.trim()}`, 'info');
        }
    }

    /**
     * Add DBMS and headers to args array
     */
    _addDbmsAndHeaders(args) {
        if (this.config.dbms) {
            args.push('--dbms', this.config.dbms);
        }

        if (this.config.customHeaders) {
            const headers = this.config.customHeaders.split('\n').filter(h => h.trim());
            headers.forEach(header => {
                args.push('--header', header.trim());
            });
        }
    }

    getSpawnCommandForTool(toolPath, args = []) {
        const spawnOpts = { shell: false };
        const isBare = !/[\\/]/.test(String(toolPath));
      
        // If toolPath is a bare command (no slashes) and we're on Windows, allow shell to resolve PATHEXT
        if (process.platform === 'win32' && isBare) {
          spawnOpts.shell = true;
          return { executable: toolPath, args, spawnOpts };
        }
      
        // If the path exists on disk, detect extension
        if (fs.existsSync(toolPath)) {
          const ext = path.extname(String(toolPath)).toLowerCase();
          if (ext === '.py') {
            // Prefer Python launcher on Windows (py), otherwise python
            const pythonCmd = process.platform === 'win32' ? 'py' : 'python';
            return { executable: pythonCmd, args: [toolPath, ...args], spawnOpts };
          } else {
            // Binary or script with executable bit
            return { executable: toolPath, args, spawnOpts };
          }
        }
      
        // Fallback: toolPath doesn't exist as file — assume it's a command in PATH
        if (process.platform === 'win32' && isBare) spawnOpts.shell = true;
        return { executable: toolPath, args, spawnOpts };
    }

    /**
     * Run a command with timeout (for version checks).
     * Returns { stdout, stderr } on success,
     * rejects with object { message, stdout, stderr } on error.
     *
     * Signature: runCommand(args, timeout = 30000, opts = {})
     * opts: { autoRespond?: boolean, autoRespondRegex?: RegExp, useShellFallback?: boolean }
     */
    async runCommand(args, timeout = 30000, opts = {}) {
        return new Promise((resolve, reject) => {
        const autoRespond = (typeof opts.autoRespond === 'boolean') ? opts.autoRespond : true;
        const autoRespondRegex = opts.autoRespondRegex || /press\s+(enter|any key|return)\b/i;
        const useShellFallback = (typeof opts.useShellFallback === 'boolean') ? opts.useShellFallback : true;
    
        // normalize executable/args using helper
        const { executable, args: finalArgs, spawnOpts } = this.getSpawnCommandForTool(this.toolConfig.path, Array.isArray(args) ? args.slice() : []);
    
        this.logger.addLog(`Ejecutando comando: ${executable} ${finalArgs.join(' ')}`, 'debug', null, true);
    
        let stdout = '';
        let stderr = '';
        let responded = false;
        let finished = false;
    
        const proc = spawn(executable, finalArgs, spawnOpts);
    
        const timer = setTimeout(() => {
            if (finished) return;
            finished = true;
            try { proc.kill(); } catch (e) {}
            reject({ message: 'Command timeout', stdout, stderr });
        }, timeout);
    
        const tryAutoRespond = (text, targetProc) => {
            if (!autoRespond || responded) return;
            try {
            if (autoRespondRegex.test(text) && targetProc.stdin && !targetProc.stdin.destroyed) {
                targetProc.stdin.write('\n');
                try { targetProc.stdin.end(); } catch (_) {}
                responded = true;
            }
            } catch (e) {
            this.logger.addLog(`Auto-respond failed: ${e.message}`, 'debug');
            }
        };
    
        proc.stdout.on('data', (d) => {
            const t = d.toString();
            stdout += t;
            tryAutoRespond(t, proc);
        });
    
        proc.stderr.on('data', (d) => {
            const t = d.toString();
            stderr += t;
            tryAutoRespond(t, proc);
        });
    
        proc.on('close', (code) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
    
            if (code === 0) {
            return resolve({ stdout, stderr });
            }
    
            // Attempt shell fallback if configured and not already using shell
            if (useShellFallback && !spawnOpts.shell) {
            // build safe shell command string
            const safeArgs = finalArgs.map(a => typeof a === 'string' && a.includes(' ') ? `"${a}"` : a).join(' ');
            const shellCmd = `${executable} ${safeArgs}`;
            this.logger.addLog(`Fallback ejecutando en shell: ${shellCmd}`, 'debug');
    
            const fallback = spawn(shellCmd, { shell: true });
    
            let fStdout = '';
            let fStderr = '';
            let fResponded = false;
            let fFinished = false;
    
            const fTimer = setTimeout(() => {
                if (fFinished) return;
                fFinished = true;
                try { fallback.kill(); } catch (e) {}
                reject({ message: 'Fallback timeout', stdout: fStdout, stderr: fStderr });
            }, timeout);
    
            const tryAutoRespondFallback = (text) => {
                if (!autoRespond || fResponded) return;
                try {
                if (autoRespondRegex.test(text) && fallback.stdin && !fallback.stdin.destroyed) {
                    fallback.stdin.write('\n');
                    try { fallback.stdin.end(); } catch (_) {}
                    fResponded = true;
                }
                } catch (e) {
                this.logger.addLog(`Fallback auto respondido falló: ${e.message}`, 'debug');
                }
            };
    
            fallback.stdout.on('data', d => {
                const t = d.toString();
                fStdout += t;
                tryAutoRespondFallback(t);
            });
            fallback.stderr.on('data', d => {
                const t = d.toString();
                fStderr += t;
                tryAutoRespondFallback(t);
            });
    
            fallback.on('close', (fcode) => {
                if (fFinished) return;
                fFinished = true;
                clearTimeout(fTimer);
                if (fcode === 0) resolve({ stdout: fStdout, stderr: fStderr });
                else reject({ message: `Fallback failed with code ${fcode}`, stdout: fStdout, stderr: fStderr });
            });
    
            fallback.on('error', (err) => {
                if (fFinished) return;
                fFinished = true;
                clearTimeout(fTimer);
                reject({ message: `Fallback error: ${err.message}`, stdout, stderr: stderr + err.message });
            });
    
            return;
            }
    
            reject({ message: `Command failed with code ${code}`, stdout, stderr });
        });
    
        proc.on('error', (err) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            reject({ message: err.message, stdout, stderr });
        });
        });
    }  
}

module.exports = SqlmapExecutor;

