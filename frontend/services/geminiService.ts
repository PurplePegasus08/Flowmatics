
// Updated to use config and improved error handling
import config, { getApiUrl } from '../config';

export const getGeminiResponse = async (
  history: { role: string; parts: { text: string }[] }[],
  dataContext: string,
  modelName: string = config.defaultModel,
  sessionId: string = "default"
) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.apiTimeout);

    const response = await fetch(getApiUrl('/api/chat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        history,
        dataContext,
        modelName,
        sessionId
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();

    // Backend returns { text: string, functionCalls: []  }
    return {
      text: data.text,
      functionCalls: data.functionCalls || []
    };

  } catch (error) {
    console.error("Error calling backend:", error);

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        text: `Request timed out after ${config.apiTimeout / 1000}s. Please try again.`,
        functionCalls: []
      };
    }

    return {
      text: `Error connecting to backend: ${error instanceof Error ? error.message : String(error)}. Please ensure the backend is running on ${config.apiBaseUrl}.`,
      functionCalls: []
    };
  }
};
