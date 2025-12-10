/**
 * Simple logger that writes to both console and chrome.storage.local
 */

export interface LogEntry {
    timestamp: string;
    level: 'INFO' | 'ERROR' | 'WARN';
    message: string;
    details?: any;
}

const STORAGE_KEY = 'debug_logs';
const MAX_LOGS = 100;

export class Logger {
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    private async saveLog(entry: LogEntry): Promise<void> {
        try {
            // Suppress known extension lifecycle errors
            if (!chrome?.runtime?.id) {
                return; // Extension context invalidated, skip logging
            }

            const result = await chrome.storage.local.get(STORAGE_KEY);
            const logs: LogEntry[] = result[STORAGE_KEY] || [];

            logs.unshift(entry); // Add new log to the beginning

            if (logs.length > MAX_LOGS) {
                logs.length = MAX_LOGS; // Keep only the latest MAX_LOGS
            }

            await chrome.storage.local.set({ [STORAGE_KEY]: logs });
        } catch (e) {
            // Suppress common Chrome extension errors
            const error = e as Error;
            if (error.message?.includes('Extension context invalidated')) {
                return; // Extension was reloaded, ignore
            }
            // Only log unexpected errors
            console.error('Failed to save log to storage:', e);
        }
    }

    log(message: string, details?: any): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: `[${this.context}] ${message}`,
            details
        };

        console.log(entry.message, details || '');
        this.saveLog(entry);
    }

    error(message: string, details?: any): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            message: `[${this.context}] ${message}`,
            details
        };

        console.error(entry.message, details || '');
        this.saveLog(entry);
    }

    static async getLogs(): Promise<LogEntry[]> {
        try {
            if (!chrome?.runtime?.id) {
                return []; // Extension context invalidated
            }
            const result = await chrome.storage.local.get(STORAGE_KEY);
            return result[STORAGE_KEY] || [];
        } catch (e) {
            const error = e as Error;
            if (error.message?.includes('Extension context invalidated')) {
                return []; // Extension was reloaded
            }
            console.error('Failed to retrieve logs:', e);
            return [];
        }
    }

    static async clearLogs(): Promise<void> {
        await chrome.storage.local.remove(STORAGE_KEY);
    }
}
