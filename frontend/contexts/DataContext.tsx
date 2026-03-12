import React, { createContext, useContext, useState, useCallback } from 'react';
import { DataRow, DashboardItem } from '../types';
import { apiClient } from '../services/apiClient';
import { useNotification } from './NotificationContext';

interface DataContextType {
    data: DataRow[];
    headers: string[];
    sessionId: string;
    dashboardItems: DashboardItem[];
    activeProvider: string;
    datasetDescription: string;
    setData: (data: DataRow[]) => void;
    setHeaders: (headers: string[]) => void;
    setSessionId: (id: string) => void;
    setDashboardItems: React.Dispatch<React.SetStateAction<DashboardItem[]>>;
    setActiveProvider: (provider: string) => void;
    uploadFile: (file: File, description?: string) => Promise<void>;
    updateDescription: (description: string) => Promise<void>;
    processData: (action: string, payload: any) => Promise<void>;
    loadSession: (sid: string) => Promise<any>;
    resetData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [data, setData] = useState<DataRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [sessionId, setSessionId] = useState<string>("default");
    const [dashboardItems, setDashboardItems] = useState<DashboardItem[]>([]);
    const [activeProvider, setActiveProvider] = useState<string>("gemini");
    const [datasetDescription, setDatasetDescription] = useState<string>("");
    const { notify } = useNotification();

    // Sync provider status on mount
    React.useEffect(() => {
        const fetchStatus = async () => {
            try {
                const data = await apiClient.getLLMStatus();
                setActiveProvider(data.active_provider);
            } catch (error) {
                console.error('Failed to sync LLM provider:', error);
            }
        };
        fetchStatus();
    }, []);

    const resetData = useCallback(() => {
        setData([]);
        setHeaders([]);
        setDashboardItems([]);
        setSessionId("default");
        setDatasetDescription("");
    }, []);

    const loadSession = useCallback(async (sid: string) => {
        try {
            notify("Restoring session...", "info");
            const sessionData = await apiClient.loadSession(sid);
            const dataContent = await apiClient.getPreview(sid);

            setSessionId(sid);
            if (dataContent.rows && dataContent.rows.length > 0) {
                setData(dataContent.rows);
                setHeaders(Object.keys(dataContent.rows[0]));
            }
            if (sessionData.description) {
                setDatasetDescription(sessionData.description);
            }
            notify("Session restored successfully", "success");
            return sessionData;
        } catch (e: any) {
            notify(`Failed to load session: ${e.message}`, "error");
            throw e;
        }
    }, [notify]);

    const uploadFile = useCallback(async (file: File, description: string = "") => {
        try {
            notify("Uploading dataset...", "info");
            const res = await apiClient.uploadFile(file, description);

            if (res.sessionId) {
                setSessionId(res.sessionId);
                if (res.preview && res.preview.length > 0) {
                    setData(res.preview);
                    setHeaders(Object.keys(res.preview[0]));
                    if (res.description) setDatasetDescription(res.description);
                    notify(`Dataset Uploaded: ${res.totalRows?.toLocaleString() || 'Many'} records.`, 'success');
                }
            }
        } catch (e: any) {
            notify(`Upload failed: ${e.message}`, 'error');
            throw e;
        }
    }, [notify]);

    const updateDescription = useCallback(async (description: string) => {
        try {
            await apiClient.updateDescription(sessionId, description);
            setDatasetDescription(description);
            notify("Context updated successfully", "success");
        } catch (e: any) {
            notify(`Update context failed: ${e.message}`, "error");
        }
    }, [sessionId, notify]);

    const processData = useCallback(async (action: string, payload: any) => {
        try {
            notify(`Processing: ${action}...`, 'info');
            const result = await apiClient.processData(sessionId, action, payload);

            if (result.status === 'success') {
                notify("Processing complete. Updating view...", "success");
                const dataContent = await apiClient.getPreview(sessionId);
                if (dataContent.rows) {
                    setData(dataContent.rows);
                    setHeaders(Object.keys(dataContent.rows[0]));
                }
            }
        } catch (e: any) {
            notify(`Processing failed: ${e.message}`, 'error');
            throw e;
        }
    }, [sessionId, notify]);

    return (
        <DataContext.Provider value={{
            data, headers, sessionId, dashboardItems, activeProvider, datasetDescription,
            setData, setHeaders, setSessionId, setDashboardItems, setActiveProvider,
            uploadFile, updateDescription, processData, loadSession, resetData
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
