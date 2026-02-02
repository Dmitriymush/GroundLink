import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiConfig, ApiResponse, ApiError, RequestConfig } from './types';

export class HttpClient {
  private client: AxiosInstance;
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        if (this.config.debug) {
          console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`, {
            data: config.data,
            params: config.params,
          });
        }
        return config;
      },
      (error) => {
        if (this.config.debug) {
          console.error('❌ Request Error:', error);
        }
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        if (this.config.debug) {
          console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            data: response.data,
          });
        }
        return response;
      },
      (error) => {
        if (this.config.debug) {
          console.error('❌ Response Error:', {
            status: error.response?.status,
            message: error.message,
            data: error.response?.data,
          });
        }
        return Promise.reject(this.formatError(error));
      }
    );
  }

  private formatError(error: any): ApiError {
    if (error.response) {
      return {
        message: error.response.data?.message || error.response.statusText,
        status: error.response.status,
        code: error.response.data?.code,
      };
    }
    
    if (error.request) {
      return {
        message: 'Network error - no response received',
        code: 'NETWORK_ERROR',
      };
    }

    return {
      message: error.message || 'Unknown error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }

  async request<T = any>(config: RequestConfig): Promise<ApiResponse<T>> {
    const axiosConfig: AxiosRequestConfig = {
      method: config.method,
      url: config.url,
      data: config.data,
      params: config.params,
      headers: config.headers,
      timeout: config.timeout,
    };

    const response = await this.client.request(axiosConfig);
    
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
    };
  }

  async get<T = any>(url: string, params?: Record<string, any>, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
      ...config,
    });
  }

  async post<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
      ...config,
    });
  }

  async put<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
      ...config,
    });
  }

  async delete<T = any>(url: string, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
      ...config,
    });
  }

  async patch<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PATCH',
      url,
      data,
      ...config,
    });
  }

  // Utility method for simple ping/health checks
  async ping(): Promise<boolean> {
    try {
      await this.get('', {}, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}
