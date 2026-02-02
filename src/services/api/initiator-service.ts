import { BaseApiService } from './base-service';

export interface InitiatorConfig {
  baseURL: string;
  accessToken?: string;
  debug?: boolean;
}

export interface Device {
  id: string;
  command: string;
}

export interface GetDeviceResponse extends Device {}

export interface GetDevicesListResponse {
  devices: Device[];
}

export interface SetCommandRequest {
  command: string;
}

export interface SetCommandResponse {
  success: string;
}

export interface ConnectionSettings {
  endpoint: string;
  accessToken: string | null | undefined;
}

export class InitiatorService extends BaseApiService {
  private accessToken: string = "";

  constructor(config: InitiatorConfig) {
    super({
      baseURL: config.baseURL,
      debug: config.debug || false,
    });
    this.accessToken = config.accessToken || "";
  }

  setConnectionSettings(connection: ConnectionSettings): void {
    this.updateBaseURL(`${connection.endpoint}:3000`);
    this.accessToken = connection.accessToken + "";
  }

  private getAuthHeaders(): Record<string, string> {
    if (this.accessToken) {
      return {
        Authorization: `Bearer ${this.accessToken}`,
      };
    }
    return {};
  }

  async getDeviceCommand(id: string): Promise<GetDeviceResponse> {
    const response = await this.http.get<GetDeviceResponse>(`api/${id}`, {}, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getDevicesList(): Promise<GetDevicesListResponse> {
    const response = await this.http.get<any>('api/list', {}, {
      headers: this.getAuthHeaders(),
    });

    if (response.data.error) {
      throw new Error(response.data.error);
    }

    return { devices: response.data };
  }

  async setDeviceCommand(id: string, command: string): Promise<SetCommandResponse> {
    const request: SetCommandRequest = { command };
    
    const response = await this.http.post<SetCommandResponse>(`api/${id}`, request, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async broadcastCommand(command: string): Promise<SetCommandResponse> {
    const request: SetCommandRequest = { command };
    
    const response = await this.http.post<SetCommandResponse>('api/broadcast', request, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async requestWithTimeout(timeSeconds: number): Promise<SetCommandResponse> {
    const response = await this.http.get<SetCommandResponse>(`api/timeout/${timeSeconds}`, {}, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async ping(): Promise<boolean> {
    try {
      await this.http.get('ping', {}, { 
        timeout: 10000,
        headers: this.getAuthHeaders(),
      });
      return true;
    } catch (err) {
      return false;
    }
  }

  // TanStack Query helpers
  getConnectionQueryKey() {
    return this.createQueryKey('initiator-connection');
  }

  getDevicesListQueryKey() {
    return this.createQueryKey('initiator-devices-list');
  }

  getDeviceCommandQueryKey(id: string) {
    return this.createQueryKey('initiator-device-command', { id });
  }
}
