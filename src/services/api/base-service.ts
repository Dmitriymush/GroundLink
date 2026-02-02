import { HttpClient } from './http-client';
import type { ApiConfig, QueryConfig, MutationConfig } from './types';

export abstract class BaseApiService {
  protected http: HttpClient;
  protected config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
    this.http = new HttpClient(config);
  }

  // Helper method to create query keys
  protected createQueryKey(baseKey: string, params?: Record<string, any>): string[] {
    if (!params) return [baseKey];
    return [baseKey, params];
  }

  // Helper method to create query function
  protected createQueryFunction<T>(
    fn: () => Promise<T>
  ): () => Promise<T> {
    return async () => {
      try {
        const response = await fn();
        return response;
      } catch (error) {
        // Ensure errors are properly thrown for TanStack Query
        throw error;
      }
    };
  }

  // Helper method to create mutation function
  protected createMutationFunction<TData, TVariables>(
    fn: (variables: TVariables) => Promise<TData>
  ): (variables: TVariables) => Promise<TData> {
    return async (variables: TVariables) => {
      try {
        const response = await fn(variables);
        return response;
      } catch (error) {
        throw error;
      }
    };
  }

  // Default query configuration
  protected getDefaultQueryConfig(): QueryConfig {
    return {
      enabled: true,
      retry: 3,
      retryDelay: 1000,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    };
  }

  // Default mutation configuration
  protected getDefaultMutationConfig(): MutationConfig {
    return {
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    };
  }

  // Update base URL dynamically
  updateBaseURL(baseURL: string): void {
    this.config.baseURL = baseURL;
    this.http = new HttpClient(this.config);
  }

  // Get current base URL
  getBaseURL(): string {
    return this.config.baseURL;
  }

  // Enable/disable debug mode
  setDebugMode(enabled: boolean): void {
    this.config.debug = enabled;
    this.http = new HttpClient(this.config);
  }
}
