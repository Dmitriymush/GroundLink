// DEPRECATED: This file has been replaced by the new InitiatorService
// All components should now use the new hooks from @/hooks/use-initiator-api

// TODO: Remove BaseApi import when all components are migrated
import { BaseApi } from "./base-api";

export type Device = {
  id: string;
  command: string;
};

type GetDeviceResponse = Device;

export type GetDevicesListResponse = {
  devices: Device[];
};

type SetCommandRequest = {
  command: string;
};

type SetCommandResponse = {
  success: string;
};

export class InitiatorApi extends BaseApi {
  private accessToken: string = "";

  constructor() {
    super({ endpoint: "", debug: true });
  }

  setConnectionSettings(connection: {
    endpoint: string;
    accessToken: string | null | undefined;
  }): void {
    this.setEndpoint(`${connection.endpoint}:${3000}`);
    this.accessToken = connection.accessToken + "";
  }

  async get(url: string, data?: any, options: any = {}) {
    if (this.accessToken) {
      options = {
        ...options,
        headers: {
          ...options?.headers,
          Authorization: `Bearer ${this.accessToken}`,
        },
      };
    }
    return super.get(url, data, options);
  }

  async post(url: string, data?: any, options: any = {}) {
    if (this.accessToken) {
      options = {
        ...options,
        headers: {
          ...options?.headers,
          Authorization: `Bearer ${this.accessToken}`,
        },
      };
    }
    return super.post(url, data, options);
  }

  async getDeviceCommand(id: string): Promise<GetDeviceResponse> {
    const data = await this.get(`api/${id}`);
    return data;
  }

  async getDevicesList(): Promise<GetDevicesListResponse> {
    const data = await this.get("api/list");

    if (data.error) {
      throw new Error(data.error);
    }

    return { devices: data };
  }

  async setDeviceCommand(
    id: string,
    command: string
  ): Promise<SetCommandResponse> {
    const request: SetCommandRequest = {
      command,
    };

    return this.post(`api/${id}`, request, { json: true });
  }

  async broadcastCommand(command: string): Promise<SetCommandResponse> {
    const request: SetCommandRequest = {
      command,
    };

    return this.post("api/broadcast", request, { json: true });
  }

  async requestWithTimeout(timeSeconds: number): Promise<SetCommandResponse> {
    return this.get(`api/timeout/${timeSeconds}`);
  }

  async ping(): Promise<boolean> {
    try {
      await this.get("ping", {}, { timeout: 10e3, noDebug: true });
      return true;
    } catch (err) {
      return false;
    }
  }
}
