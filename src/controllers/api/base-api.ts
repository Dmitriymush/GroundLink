// DEPRECATED: This file has been replaced by the new BaseApiService and HttpClient
// All components should now use the new services from @/services/api

// TODO: Remove needle import when all components are migrated
import needle from "needle";

type BaseApiConstructor = {
  endpoint: string;
  debug?: boolean;
};

export class BaseApi {
  private endpoint: string;
  private debug: boolean;

  constructor({ endpoint, debug }: BaseApiConstructor) {
    this.endpoint = endpoint;
    this.debug = debug || false;
  }

  setEndpoint(endpoint: string) {
    this.endpoint = endpoint;
  }

  getEndpoint() {
    return this.endpoint;
  }

  getPath(path?: string) {
    if (!path) {
      return this.endpoint;
    }

    return `${this.endpoint}/${path}`;
  }

  private log(...args: any[]) {
    if (this.debug) {
      console.log(...args);
    }
  }

  private time(label: string) {
    if (this.debug) {
      console.time(label);
    }
  }

  private timeEnd(label: string) {
    if (this.debug) {
      console.timeEnd(label);
    }
  }

  async get(url: string, data?: any, options?: any) {
    if (!options?.noDebug) {
      this.log(`GET ${this.getPath(url)}`, data, options);
      this.time(`GET ${this.getPath(url)}`);
    }

    const { body } = await needle("get", this.getPath(url), data, options);

    if (!options?.noDebug) {
      this.timeEnd(`GET ${this.getPath(url)}`);
    }

    return body;
  }

  async post(url: string, data?: any, options?: any) {
    this.log(`POST ${this.getPath(url)}`, data, options);
    this.time(`POST ${this.getPath(url)}`);

    const response = await needle("post", this.getPath(url), data, options);

    this.timeEnd(`POST ${this.getPath(url)}`);
    this.log(`Response POST ${this.getPath(url)}`, response);
    return response.body;
  }
}
