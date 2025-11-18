
class Logger {
    constructor(emitter) {
        this.emitter = emitter;
        this.logs = [];
        this.currentPhase = null;
    }

    setCurrentPhase(phase) {
        this.currentPhase = phase;
    }

    shouldFilterLog(message, level = 'info') {
        if (!message || typeof message !== 'string') return true;
        
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('sqlmap') && (
            lowerMessage.includes('banner') ||
            lowerMessage.includes('version') ||
            lowerMessage.includes('http://sqlmap.org')
        )) {
            return true;
        }
        
        if (lowerMessage.match(/do you want to test.*\?.*\[y\/n\/q\]/i) ||
            lowerMessage.match(/do you want to.*\?.*\[y\/n\]/i) ||
            lowerMessage.match(/\? \[y\/n\/q\]/i) ||
            lowerMessage.match(/\[y\/n\]/i) ||
            (lowerMessage.includes('[*]') && lowerMessage.includes('(y/n)'))
        ) {
            return true;
        }
        
        if (lowerMessage.includes('respuesta correcta') && lowerMessage.includes('continuando escaneo')) {
            return true;
        }
        if (lowerMessage.includes('respuesta incorrecta') && lowerMessage.includes('continuando escaneo')) {
            return true;
        }
        
        if (level === 'debug' && (
            lowerMessage.includes('spawn:') ||
            lowerMessage.startsWith('sqlmap:')
        )) {
            return true;
        }
        
        return false;
    }

    addLog(message, level = 'info', phase = null, consoleOnly = false) {
        if (consoleOnly) {
            return;
        }
        
        if (this.shouldFilterLog(message, level)) {
            const lowerMessage = message.toLowerCase();
            if (lowerMessage.includes('sqlmap') || lowerMessage.includes('dalfox')) {
            }
            return;
        }
        
        const logPhase = phase || this.currentPhase;
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            phase: logPhase
        };
        
        this.logs.push(logEntry);
        
        if (this.emitter) {
            this.emitter.emit('log:added', logEntry);
        }
        
    }

    getRecentLogs(count = 50) {
        return this.logs.slice(-count);
    }

    getAllLogs() {
        return [...this.logs];
    }
}

module.exports = Logger;

