import React, { useEffect, useState } from 'react';
import { type LogEntry, getLogs, clearLogs, LOGS_UPDATED_EVENT } from './logger';
import './LogsViewer.css';
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
                return <Activity className="w-5 h-5 log-icon-action" />;
            case 'llm_prompt':
                return <MessageSquare className="w-5 h-5 log-icon-prompt" />;
            case 'llm_response':
                return <Server className="w-5 h-5 log-icon-response" />;
            case 'error':
                return <AlertCircle className="w-5 h-5 log-icon-error" />;
        }
    };

    return (
        <div
            className="logs-viewer-overlay"
            onClick={onClose}
        >
            <div
                className="logs-viewer-modal"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className="logs-viewer-header">
                    <div className="logs-viewer-header-title">
                        <Activity className="w-5 h-5 log-icon-action" />
                        <h2>System Logs</h2>
                        <span className="logs-viewer-count">
                            {logs.length} entries
                        </span>
                    </div>
                    <div className="logs-viewer-header-actions">
                        <button
                            onClick={handleClear}
                            className="btn-danger"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear
                        </button>
                        <button
                            onClick={onClose}
                            className="btn-icon"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Logs List */}
                <div className="logs-viewer-content">
                    <div className="logs-list">
                        {logs.length === 0 ? (
                            <div className="logs-empty">
                                <Activity />
                                <p>No logs recorded yet.</p>
                            </div>
                        ) : (
                            logs.map((log) => (
                                <div
                                    key={log.id}
                                    className="log-entry"
                                >
                                    <div
                                        className="log-entry-summary"
                                        onClick={() => toggleExpand(log.id!)}
                                    >
                                        <div className="log-entry-info">
                                            <div className="log-entry-icon">
                                                {getIcon(log.type)}
                                            </div>
                                            <div className="log-entry-text">
                                                <p className="log-entry-message">
                                                    {log.message}
                                                </p>
                                                <p className="log-entry-meta">
                                                    <span className="log-entry-type">{log.type.replace('_', ' ')}</span>
                                                    <span>&bull;</span>
                                                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                                                </p>
                                            </div>
                                        </div>
                                        {log.details !== undefined && (
                                            <div className="log-entry-toggle">
                                                {expanded[log.id!] ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                            </div>
                                        )}
                                    </div>

                                    {expanded[log.id!] && log.details !== undefined && (
                                        <div className="log-entry-details">
                                            <pre>
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
