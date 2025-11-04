/**
 * Configuration validator and normalizer for ScanOrchestrator
 */

/**
 * Validates and normalizes scan configuration with defaults
 * @param {Object} scanConfig - Raw configuration object
 * @returns {Object} Normalized and validated configuration
 * @throws {Error} If required fields are missing
 */
const config = require('config');

function validateAndNormalizeConfig(scanConfig) {
    if (!scanConfig) {
        throw new Error('Configuración de escaneo requerida');
    }

    // Normalize URL - handle empty strings, undefined, null
    const url = (scanConfig.url || '').trim();
    if (!url) {
        throw new Error('URL objetivo es requerida');
    }

    // Validate URL format
    try {
        new URL(url);
    } catch (error) {
        throw new Error(`URL inválida: ${url}`);
    }

    // Normalize flags with defaults
    const flags = scanConfig.flags || {};
    const normalizedFlags = {
        sqli: flags.sqli !== undefined ? Boolean(flags.sqli) : true,  // Default to true if not specified
        xss: flags.xss !== undefined ? Boolean(flags.xss) : true       // Default to true if not specified
    };

    // Ensure at least one scan type is enabled
    if (!normalizedFlags.sqli && !normalizedFlags.xss) {
        throw new Error('Al menos un tipo de escaneo debe estar habilitado (SQLi o XSS)');
    }

    // Build normalized config
    const normalized = {
        url: url,
        flags: normalizedFlags,
        
        // Tool paths (optional - defaults to PATH)
        sqlmapPath: scanConfig.sqlmapPath || config.get('sqlmap.path') || 'sqlmap',
        dalfoxPath: scanConfig.dalfoxPath || config.get('dalfox.path') || 'dalfox',
        
        // SQLMap configuration
        crawlDepth: scanConfig.crawlDepth || 2,
        level: Math.max(1, Math.min(5, scanConfig.level || 1)),
        risk: Math.max(1, Math.min(3, scanConfig.risk || 1)),
        threads: Math.max(1, scanConfig.threads || 1),
        timeout: Math.max(1, config.get('sqlmap.timeout') || scanConfig.timeout || 30),
        
        // Dalfox configuration
        dalfoxWorkers: Math.max(1, scanConfig.dalfoxWorkers || 10),
        dalfoxDelay: Math.max(0, scanConfig.dalfoxDelay || 0),
        
        // Exploitation settings
        enableExploitation: Boolean(scanConfig.enableExploitation || false),
        
        // DBMS (optional)
        dbms: scanConfig.dbms && scanConfig.dbms !== 'auto' ? scanConfig.dbms : null,
        
        // Custom headers (support both object and string format)
        headers: scanConfig.headers || {},
        customHeaders: scanConfig.customHeaders || ''
    };

    return normalized;
}

module.exports = {
    validateAndNormalizeConfig
};

