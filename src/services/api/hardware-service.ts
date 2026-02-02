import { BaseApiService } from './base-service';

export interface HardwareConfig {
  baseURL: string;
  debug?: boolean;
}

// Relay/Relay Control (from Vulic)
export interface RelayState {
  relay: number;
  state: boolean;
}

// Modem Control
export interface ModemState {
  timer: number | null;
  activeteTime: number | null;
  enabled: boolean;
}

// CAN Device Control (from MegaServer)
export interface CanDevice {
  id: number;
  type: string;
  state: boolean;
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

export class HardwareService extends BaseApiService {
  private channelMapping: { [input: number]: number };

  constructor(config: HardwareConfig) {
    super({
      baseURL: config.baseURL,
      debug: config.debug || false,
    });

    // Relay channel mapping (from Vulic)
    this.channelMapping = {
      1: 2,
      2: 3,
      3: 1,
      4: 4,
    };
  }

  // ===== RELAY CONTROL (from Vulic) =====
  private getRelayCode(relay: number, state: boolean): string {
    const channel = this.channelMapping[relay];

    if (relay != null && relay < 5) {
      return state ? `High${channel}` : `Low${channel}`;
    }

    return "";
  }

  async changeRelayState(relay: number, state: boolean): Promise<void> {
    const relayCode = this.getRelayCode(relay, state);
    
    if (!relayCode) {
      throw new Error(`Invalid relay number: ${relay}`);
    }

    await this.http.post('', {
      submit: relayCode,
    });
  }

  async changeMultipleRelays(states: RelayState[]): Promise<void> {
    const promises = states.map(({ relay, state }) => 
      this.changeRelayState(relay, state)
    );
    
    await Promise.all(promises);
  }

  // ===== MODEM CONTROL =====
  async startModemTimer(): Promise<void> {
    await this.http.post('start', {});
  }

  async setModemTimer(timer: number): Promise<void> {
    await this.http.post('set', { timer });
  }

  async stopModemTimer(): Promise<void> {
    await this.http.post('stop', {});
  }

  async disableModem(): Promise<void> {
    await this.http.post('off', {});
  }

  async enableModem(): Promise<void> {
    await this.http.post('on', {});
  }

  async getModemState(): Promise<ModemState> {
    const response = await this.http.get<ModemState>('state');
    return response.data;
  }

  // ===== CAN DEVICE CONTROL (from MegaServer) =====
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

  async changeCanRelayState(params: ChangeRelayStateParams): Promise<void> {
    const path = `can/${params.type}/${params.state ? 'on' : 'off'}/${params.id}`;
    await this.http.get(path);
    console.log('CAN relay state change request sent:', path);
  }

  async changeCanLeadState(params: ChangeLeadStateParams): Promise<void> {
    const path = `can/lead/${params.state ? 'open' : 'close'}/${params.id}`;
    await this.http.get(path);
    console.log('CAN lead state change request sent:', path);
  }

  async testCanCartridge(id: number): Promise<void> {
    const path = `can/cartridge/${id}`;
    await this.http.get(path);
    console.log('CAN cartridge test request sent:', path);
  }

  // ===== UTILITY METHODS =====
  async ping(): Promise<boolean> {
    try {
      await this.http.get('ping', {}, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  // ===== TANSTACK QUERY HELPERS =====
  getConnectionQueryKey() {
    return this.createQueryKey('hardware-connection');
  }

  getModemStateQueryKey() {
    return this.createQueryKey('hardware-modem-state');
  }

  getCanDevicesQueryKey() {
    return this.createQueryKey('hardware-can-devices');
  }

  getRelayStateQueryKey(relay: number) {
    return this.createQueryKey('hardware-relay-state', { relay });
  }

  getCanRelayStateQueryKey(type: string, id: number) {
    return this.createQueryKey('hardware-can-relay-state', { type, id });
  }

  getCanLeadStateQueryKey(id: number) {
    return this.createQueryKey('hardware-can-lead-state', { id });
  }
}
