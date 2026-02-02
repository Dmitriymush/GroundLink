import { BaseApiService } from './base-service';

export interface MegaServerConfig {
  baseURL: string;
  debug?: boolean;
}

export interface CanDevice {
  id: number;
  type: string;
  state: boolean;
  // Add more properties as needed
}

export interface ChangeRelayStateParams {
  type: string;
  id: number;
  state: boolean;
}

export interface ChangeLeadStateParams {
  id: number;
  state: boolean;
}

export class MegaServerService extends BaseApiService {
  constructor(config: MegaServerConfig) {
    super({
      baseURL: config.baseURL,
      debug: config.debug || false,
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.http.get('ping', {}, { timeout: 5000 });
      return true;
    } catch (error) {
      console.warn('MegaServer ping failed:', error);
      return false;
    }
  }

  async getCanDevices(): Promise<CanDevice[]> {
    const response = await this.http.get<any>('can');
    
    if (typeof response.data === 'string') {
      try {
        return JSON.parse(response.data);
      } catch (e) {
        console.error('Failed to parse CAN devices response:', e);
        return [];
      }
    }

    return response.data || [];
  }

  async changeRelayState(params: ChangeRelayStateParams): Promise<void> {
    const path = `can/${params.type}/${params.state ? 'on' : 'off'}/${params.id}`;
    await this.http.get(path);
    console.log('Relay state change request sent:', path);
  }

  async changeLeadState(params: ChangeLeadStateParams): Promise<void> {
    const path = `can/lead/${params.state ? 'open' : 'close'}/${params.id}`;
    await this.http.get(path);
    console.log('Lead state change request sent:', path);
  }

  async testCartridge(id: number): Promise<void> {
    const path = `can/cartridge/${id}`;
    await this.http.get(path);
    console.log('Cartridge test request sent:', path);
  }

  // TanStack Query helpers
  getConnectionQueryKey() {
    return this.createQueryKey('mega-server-connection');
  }

  getCanDevicesQueryKey() {
    return this.createQueryKey('mega-server-can-devices');
  }

  getRelayStateQueryKey(type: string, id: number) {
    return this.createQueryKey('mega-server-relay-state', { type, id });
  }

  getLeadStateQueryKey(id: number) {
    return this.createQueryKey('mega-server-lead-state', { id });
  }
}
