export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers?: Record<string, string>;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

export interface ApiConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
  debug?: boolean;
}

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface QueryConfig {
  enabled?: boolean;
  refetchInterval?: number;
  retry?: number | boolean;
  retryDelay?: number;
  staleTime?: number;
  cacheTime?: number;
}

export interface MutationConfig {
  onSuccess?: (data: any) => void;
  onError?: (error: ApiError) => void;
  onSettled?: (data: any, error: ApiError) => void;
}
