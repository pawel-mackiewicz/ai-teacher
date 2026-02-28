import React, { useEffect, useState } from 'react';
import { type LogEntry, getLogs, clearLogs, LOGS_UPDATED_EVENT } from './logger';
import { X, Trash2, ChevronDown, ChevronRight, Activity, MessageSquare, Server, AlertCircle } from 'lucide-react';

interface LogsViewerProps {
    onClose: () => void;
}

export const LogsViewer: React.FC<LogsViewerProps> = ({ onClose }) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            const fetchedLogs = await getLogs(200);
            if (mounted) setLogs(fetchedLogs);
        };
        void load();

        const handleUpdate = () => {
            void load();
        };

        window.addEventListener(LOGS_UPDATED_EVENT, handleUpdate);
        return () => {
            mounted = false;
            window.removeEventListener(LOGS_UPDATED_EVENT, handleUpdate);
        };
    }, []);

    const handleClear = async () => {
        if (confirm('Are you sure you want to clear all logs?')) {
            await clearLogs();
            const fetchedLogs = await getLogs(200);
            setLogs(fetchedLogs);
        }
    };

    const toggleExpand = (id: number) => {
        setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const getIcon = (type: LogEntry['type']) => {
        switch (type) {
            case 'action':
                return <Activity className="w-5 h-5 text-blue-500" />;
            case 'llm_prompt':
                return <MessageSquare className="w-5 h-5 text-purple-500" />;
            case 'llm_response':
                return <Server className="w-5 h-5 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 text-red-500" />;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">System Logs</h2>
                        <span className="text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                            {logs.length} entries
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleClear}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:text-slate-300 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Logs List */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950">
                    <div className="space-y-3">
                        {logs.length === 0 ? (
                            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                                <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No logs recorded yet.</p>
                            </div>
                        ) : (
                            logs.map((log) => (
                                <div
                                    key={log.id}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm"
                                >
                                    <div
                                        className="flex flex-col sm:flex-row sm:items-center p-3 gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        onClick={() => toggleExpand(log.id!)}
                                    >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="shrink-0 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                                                {getIcon(log.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 break-words">
                                                    {log.message}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                                                    <span className="uppercase tracking-wider font-semibold text-[10px]">{log.type.replace('_', ' ')}</span>
                                                    <span>&bull;</span>
                                                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                                                </p>
                                            </div>
                                        </div>
                                        {log.details !== undefined && (
                                            <div className="shrink-0 text-slate-400">
                                                {expanded[log.id!] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                            </div>
                                        )}
                                    </div>

                                    {expanded[log.id!] && log.details !== undefined && (
                                        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-4">
                                            <pre
                                                className="text-xs font-mono text-slate-700 dark:text-slate-300 w-full"
                                                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}
                                            >
                                                {typeof log.details === 'object'
                                                    ? JSON.stringify(log.details, null, 2)
                                                    : String(log.details)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const SystemLogsButton: React.FC = () => {
    const [showLogs, setShowLogs] = useState(false);

    return (
        <>
            <button
                className={`sidebar-menu-btn ${showLogs ? 'active' : ''}`}
                onClick={() => setShowLogs(prev => !prev)}
                style={{ marginTop: '8px' }}
            >
                View System Logs
            </button>
            {showLogs && <LogsViewer onClose={() => setShowLogs(false)} />}
        </>
    );
};
