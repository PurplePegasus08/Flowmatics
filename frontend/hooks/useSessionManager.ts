import { useState, useCallback } from 'react';
import { apiClient } from '../services/apiClient';
import { useNotification } from '../contexts/NotificationContext';
import { ChatMessage } from '../types';

export function useSessionManager(setChatMessages: (msgs: any) => void) {
    const { notify } = useNotification();
    const [sessions, setSessions] = useState<any[]>([]);

    const fetchSessions = useCallback(async () => {
        try {
            const data = await apiClient.listSessions();
            setSessions(data);
        } catch (e) {
            console.error(e);
        }
    }, []);

    const deleteSession = useCallback(async (id: string, currentSessionId: string, handleClear: () => void) => {
        if (!confirm("Delete session?")) return;
        try {
            await apiClient.deleteSession(id);
            notify("Session deleted", "success");
            if (id === currentSessionId) {
                handleClear();
                setChatMessages([{ id: '0', role: 'model', content: "Session deleted. Ready for new analysis." }]);
            }
            fetchSessions();
        } catch (e) {
            notify("Failed to delete", "error");
        }
    }, [notify, fetchSessions]);

    const renameSession = useCallback(async (id: string, title: string) => {
        try {
            await apiClient.renameSession(id, title);
            notify("Renamed", "success");
            fetchSessions();
        } catch (e) {
            notify("Failed to rename", "error");
        }
    }, [notify, fetchSessions]);

    return { sessions, fetchSessions, deleteSession, renameSession };
}
