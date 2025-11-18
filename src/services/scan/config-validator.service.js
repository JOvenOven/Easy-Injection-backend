const config = require('config');

function validateAndNormalizeConfig(scanConfig) {
    if (!scanConfig) {
        throw new Error('Configuración de escaneo requerida');
    }

    const url = (scanConfig.url || '').trim();
    if (!url) {
        throw new Error('URL objetivo es requerida');
    }

    try {
        new URL(url);
    } catch (error) {
        throw new Error(`URL inválida: ${url}`);
    }

    const flags = scanConfig.flags || {};
    const normalizedFlags = {
        sqli: flags.sqli !== undefined ? Boolean(flags.sqli) : true,
        xss: flags.xss !== undefined ? Boolean(flags.xss) : true
    };

    if (!normalizedFlags.sqli && !normalizedFlags.xss) {
        throw new Error('Al menos un tipo de escaneo debe estar habilitado (SQLi o XSS)');
    }

    const normalized = {
        url: url,
        flags: normalizedFlags,
        sqlmapPath: scanConfig.sqlmapPath || config.get('sqlmap.path') || 'sqlmap',
        dalfoxPath: scanConfig.dalfoxPath || config.get('dalfox.path') || 'dalfox',
        
        crawlDepth: scanConfig.crawlDepth || 2,
        level: Math.max(1, Math.min(5, scanConfig.level || 1)),
        risk: Math.max(1, Math.min(3, scanConfig.risk || 1)),
        threads: Math.max(1, scanConfig.threads || 1),
        timeout: Math.max(1, config.get('sqlmap.timeout') || scanConfig.timeout || 30),
        
        dalfoxWorkers: Math.max(1, scanConfig.dalfoxWorkers || 10),
        dalfoxDelay: Math.max(0, scanConfig.dalfoxDelay || 0),
        
        enableExploitation: Boolean(scanConfig.enableExploitation || false),
        
        dbms: scanConfig.dbms && scanConfig.dbms !== 'auto' ? scanConfig.dbms : null,
        
        headers: scanConfig.headers || {},
        customHeaders: scanConfig.customHeaders || ''
    };

    return normalized;
}

module.exports = {
    validateAndNormalizeConfig
};

