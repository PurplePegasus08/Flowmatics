import config, { getApiUrl } from '../config';

class APIClient {
    private baseUrl: string;

    constructor() {
        this.baseUrl = config.apiBaseUrl;
    }

    async fetchJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = getApiUrl(endpoint);
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        return response.json();
    }

    // Session Endpoints
    async listSessions() {
        return this.fetchJson<any[]>('/api/sessions');
    }

    async loadSession(id: string) {
        return this.fetchJson<any>(`/api/session/${id}`);
    }

    async deleteSession(id: string) {
        return this.fetchJson<any>(`/api/session/${id}`, { method: 'DELETE' });
    }

    async renameSession(id: string, title: string) {
        return this.fetchJson<any>(`/api/session/${id}/rename`, {
            method: 'PUT',
            body: JSON.stringify({ title }),
        });
    }

    // Data endpoints
    async uploadFile(file: File) {
        const url = getApiUrl('/api/upload');
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error(await response.text());
        return response.json();
    }

    async getPreview(sessionId: string, limit: number = 1000) {
        return this.fetchJson<any>(`/api/preview/${sessionId}?limit=${limit}`);
    }

    async processData(sessionId: string, action: string, payload: any) {
        return this.fetchJson<any>(`/api/process/${action}/${sessionId}`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    async undo(sessionId: string) {
        return this.fetchJson<any>(`/api/undo/${sessionId}`, {
            method: 'POST'
        });
    }

    // AI & Analysis
    async chat(sessionId: string, history: any[], persona: string) {
        return this.fetchJson<any>('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ sessionId, history, persona }),
        });
    }

    async replExecute(sessionId: string, script: string) {
        return this.fetchJson<any>(`/api/repl/${sessionId}`, {
            method: 'POST',
            body: JSON.stringify({ script }),
        });
    }

    async generateDashboard(sessionId: string) {
        return this.fetchJson<any>(`/api/dashboard/generate/${sessionId}`);
    }

    async getInsights(sessionId: string) {
        return this.fetchJson<any>(`/api/insights/summary/${sessionId}`);
    }

    async getProactiveInsights(sessionId: string) {
        return this.fetchJson<any>(`/api/insights/proactive/${sessionId}`);
    }

    async chatStream(sessionId: string, message: string, provider?: string, onChunk?: (text: string) => void) {
        const url = getApiUrl('/api/chat/stream');
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, message, provider }),
        });

        if (!response.ok) throw new Error(await response.text());
        const reader = response.body?.getReader();
        if (!reader) return null;

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'chunk' && onChunk) {
                        onChunk(data.text);
                    } else if (data.type === 'final') {
                        return data.res;
                    } else if (data.type === 'error') {
                        throw new Error(data.text);
                    }
                }
            }
        }
    }

    async getLLMStatus() {
        return this.fetchJson<any>('/api/settings/llm');
    }

    async switchLLMProvider(provider: string) {
        return this.fetchJson<any>('/api/settings/llm/provider', {
            method: 'PUT',
            body: JSON.stringify({ provider }),
        });
    }

    getReproducibilityScriptUrl(sessionId: string) {
        return getApiUrl(`/api/reproducibility/export/${sessionId}`);
    }
}

export const apiClient = new APIClient();
