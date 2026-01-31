/**
 * Centralized configuration for InsightFlow AI frontend.
 * Environment-aware configuration for different deployment environments.
 */

interface Config {
  apiBaseUrl: string;
  apiTimeout: number;
  maxFileSize: number;
  maxFileSizeMB: number;
  allowedFileTypes: string[];
  defaultModel: string;
  environment: 'development' | 'production';
}

const config: Config = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'),

  // File Upload
  maxFileSizeMB: parseInt(import.meta.env.VITE_MAX_FILE_SIZE_MB || '1000'),
  maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE_MB || '1000') * 1024 * 1024,
  allowedFileTypes: (import.meta.env.VITE_ALLOWED_FILE_TYPES || '.csv,.json').split(','),

  // AI Model
  defaultModel: import.meta.env.VITE_DEFAULT_MODEL || 'gemini-2.0-flash-exp',

  // Environment
  environment: (import.meta.env.MODE as 'development' | 'production') || 'development',
};

// Validation
if (!config.apiBaseUrl) {
  console.error('VITE_API_BASE_URL is not configured');
}

// Helper functions
export const getApiUrl = (path: string): string => {
  return `${config.apiBaseUrl}${path}`;
};

export const isProduction = (): boolean => {
  return config.environment === 'production';
};

export const isDevelopment = (): boolean => {
  return config.environment === 'development';
};

export default config;
