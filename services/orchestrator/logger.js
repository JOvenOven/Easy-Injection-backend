/**
 * Logger utility for ScanOrchestrator
 */

class Logger {
    constructor(emitter) {
        this.emitter = emitter;
        this.logs = [];
        this.currentPhase = null;
    }

    /**
     * Set current phase for logging context
     * @param {string} phase - Current phase identifier
     */
    setCurrentPhase(phase) {
        this.currentPhase = phase;
    }

    /**
     * Check if a log should be filtered out
     * @param {string} message - Log message
     * @param {string} level - Log level
     * @returns {boolean} True if log should be filtered
     */
    shouldFilterLog(message, level = 'info') {
        if (!message || typeof message !== 'string') return true;
        
        const lowerMessage = message.toLowerCase();
        
        // Filter SQLmap banner and version info
        if (lowerMessage.includes('sqlmap') && (
            lowerMessage.includes('banner') ||
            lowerMessage.includes('version') ||
            lowerMessage.includes('http://sqlmap.org')
        )) {
            return true;
        }
        
        // Filter SQLmap interactive questions
        if (lowerMessage.match(/do you want to test.*\?.*\[y\/n\/q\]/i) ||
            lowerMessage.match(/do you want to.*\?.*\[y\/n\]/i) ||
            lowerMessage.match(/\? \[y\/n\/q\]/i) ||
            lowerMessage.match(/\[y\/n\]/i) ||
            (lowerMessage.includes('[*]') && lowerMessage.includes('(y/n)'))
        ) {
            return true;
        }
        
        // Filter question answer logs (they're handled separately)
        if (lowerMessage.includes('respuesta correcta') && lowerMessage.includes('continuando escaneo')) {
            return true;
        }
        if (lowerMessage.includes('respuesta incorrecta') && lowerMessage.includes('continuando escaneo')) {
            return true;
        }
        
        // Filter debug logs that are too verbose
        if (level === 'debug' && (
            lowerMessage.includes('spawn:') ||
            lowerMessage.startsWith('sqlmap:')
        )) {
            return true;
        }
        
        return false;
    }

    /**
     * Add a log entry
     * @param {string} message - Log message
     * @param {string} level - Log level (info, success, warning, error, debug)
     * @param {string} phase - Current phase (optional)
     * @param {boolean} consoleOnly - If true, only log to console, don't send to frontend
     */
    addLog(message, level = 'info', phase = null, consoleOnly = false) {
        // Always log to console for sqlmap/dalfox detailed output
        if (consoleOnly) {
            console.log(`[${level.toUpperCase()}] ${message}`);
            return;
        }
        
        // Filter unwanted logs (for frontend)
        if (this.shouldFilterLog(message, level)) {
            // But still show filtered logs in console if they're from sqlmap/dalfox
            const lowerMessage = message.toLowerCase();
            if (lowerMessage.includes('sqlmap') || lowerMessage.includes('dalfox')) {
                console.log(`[${level.toUpperCase()}] ${message}`);
            }
            return;
        }
        
        // Use provided phase or current phase context
        const logPhase = phase || this.currentPhase;
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            phase: logPhase
        };
        
        this.logs.push(logEntry);
        
        // Emit log event (frontend will receive this)
        if (this.emitter) {
            this.emitter.emit('log:added', logEntry);
        }
        
        // Also log to console
        console.log(`[${level.toUpperCase()}] ${message}`);
    }

    /**
     * Get recent logs
     * @param {number} count - Number of recent logs to return
     * @returns {Array} Array of log entries
     */
    getRecentLogs(count = 50) {
        return this.logs.slice(-count);
    }

    /**
     * Get all logs
     * @returns {Array} All log entries
     */
    getAllLogs() {
        return [...this.logs];
    }
}

module.exports = Logger;

