import { BaseApiService } from './base-service';
// Types moved from old controller to this service
export type Dev = {
  label: string;
  value: string;
  caps: Cap[];
};

type Cap = {
  format: string;
  fpsmax: string;
  height: number;
  label: string;
  value: string;
  width: number;
};

type VidDevice = {
  label: string;
  value: string;
  caps: Array<Cap>;
};

type VideoDevices = {
  streamingStatus: boolean;
  UDPChecked: boolean;
  dev: Array<Dev>;
  fpsSelected: string;
  streamAddresses: Array<string>;
  timestamp: boolean;
  useUDPIP: string;
  useUDPPort: number;
  vidDeviceSelected: VidDevice;
  vidResSelected: Cap;
  vidres: Array<Cap>;
  bitrate: string;
};

export type VideoSettings = {
  active: boolean;
  device: string | null;
  height: number;
  width: number;
  format: string;
  rotation: number;
  fps: string;
  bitrate: string;
  useUDP: boolean;
  useUDPIP: string;
  useUDPPort: number;
  useTimestamp: boolean;
  useCameraHeartbeat: boolean;
  mavStreamSelected: number;
  compression: string;
  _status?: boolean;
  _devices?: Array<Dev>;
};

export type VideoSettingsShortParmas = {
  height: number;
  width: number;
  bitrate: number;
  fps: number;
  host: string;
  devices: Array<Dev>;
  format: string;
  active?: boolean;
  _status?: boolean;
};

export type BaudRateSettings = {
  label: string;
  value: number;
};

export type MavVersion = {
  label: string;
  value: number;
};

export type SerialPort = {
  label: string;
  pnpId: string;
  value: string;
};

export type TelemetrySettings = {
  UDPBPort: number;
  baudRateSelected: any | null;
  baudRates: any[];
  enableDSRequest: boolean;
  enableHeartbeat: boolean;
  enableTCP: boolean;
  enableUDPB: boolean;
  mavVersions: MavVersion[];
  mavVersionSelected: MavVersion | null;
  serialPorts: SerialPort[];
  serialPortSelected: SerialPort | null;
};

export interface RPanionConfig {
  baseURL: string;
  debug?: boolean;
}

export class RPanionService extends BaseApiService {
  constructor(config: RPanionConfig) {
    super({
      baseURL: config.baseURL,
      debug: config.debug || false,
    });
  }

  // Connection status
  async checkConnection(): Promise<boolean> {
    try {
      await this.http.get('api/FCDetails', {}, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  // Video settings
  async getVideoSettings(): Promise<VideoSettings> {
    const response = await this.http.get<VideoSettings>('api/video');
    return response.data;
  }

  async updateVideoSettings(settings: Partial<VideoSettings>): Promise<VideoSettings> {
    const response = await this.http.post<VideoSettings>('api/video', settings);
    return response.data;
  }

  async getVideoDevices(): Promise<VideoDevices> {
    const response = await this.http.get<VideoDevices>('api/video/devices');
    return response.data;
  }

  async startVideoStream(params: VideoSettingsShortParmas): Promise<void> {
    await this.http.post('api/startvideo', params);
  }

  async stopVideoStream(): Promise<void> {
    await this.http.post('api/stopvideo', {});
  }

  // Telemetry settings
  async getTelemetrySettings(): Promise<TelemetrySettings> {
    const response = await this.http.get<TelemetrySettings>('api/telemetry');
    return response.data;
  }

  async updateTelemetrySettings(settings: Partial<TelemetrySettings>): Promise<TelemetrySettings> {
    const response = await this.http.post<TelemetrySettings>('api/telemetry', settings);
    return response.data;
  }

  // Serial ports
  async getSerialPorts(): Promise<SerialPort[]> {
    const response = await this.http.get<SerialPort[]>('api/serial/ports');
    return response.data;
  }

  async getMavVersions(): Promise<MavVersion[]> {
    const response = await this.http.get<MavVersion[]>('api/mavlink/versions');
    return response.data;
  }

  async getBaudRates(): Promise<BaudRateSettings[]> {
    const response = await this.http.get<BaudRateSettings[]>('api/serial/baudrates');
    return response.data;
  }

  // Flight controller
  async getFCDetails(): Promise<any> {
    const response = await this.http.get('api/FCDetails');
    return response.data;
  }

  async getFCOutputs(): Promise<any> {
    const response = await this.http.get('api/FCOutputs');
    return response.data;
  }

  async modifyFC(params: any): Promise<any> {
    const response = await this.http.post('api/FCModify', params);
    return response.data;
  }

  // System operations
  async reboot(): Promise<void> {
    await this.http.get('reboot');
  }

  async shutdown(): Promise<void> {
    await this.http.get('shutdown');
  }

  async getVersionInfo(): Promise<any> {
    const response = await this.http.get('api/version');
    return response.data;
  }

  // Ethernet settings
  async getEthernetSettings(): Promise<any> {
    const response = await this.http.get('ethernet/get-settings');
    return response.data;
  }

  async updateEthernetSettings(settings: { gateway: string }): Promise<void> {
    await this.http.post('ethernet', settings);
  }

  // VPN configuration
  async getVpnConfig(): Promise<any> {
    const response = await this.http.get('api/vpn/config');
    return response.data;
  }

  async updateVpnConfig(config: any): Promise<void> {
    await this.http.post('api/vpn/config', config);
  }

  async activateVpn(): Promise<void> {
    await this.http.post('api/vpn/activate', {});
  }

  // TanStack Query helpers
  getConnectionQueryKey(host?: string) {
    return this.createQueryKey('rpanion-connection', { host });
  }

  getVideoSettingsQueryKey() {
    return this.createQueryKey('rpanion-video-settings');
  }

  getTelemetrySettingsQueryKey() {
    return this.createQueryKey('rpanion-telemetry-settings');
  }

  getFCDetailsQueryKey() {
    return this.createQueryKey('rpanion-fc-details');
  }

  getFCOutputsQueryKey() {
    return this.createQueryKey('rpanion-fc-outputs');
  }

  getSerialPortsQueryKey() {
    return this.createQueryKey('rpanion-serial-ports');
  }

  getMavVersionsQueryKey() {
    return this.createQueryKey('rpanion-mav-versions');
  }

  getBaudRatesQueryKey() {
    return this.createQueryKey('rpanion-baud-rates');
  }

  getEthernetSettingsQueryKey() {
    return this.createQueryKey('rpanion-ethernet-settings');
  }

  getVpnConfigQueryKey() {
    return this.createQueryKey('rpanion-vpn-config');
  }

  getVersionInfoQueryKey() {
    return this.createQueryKey('rpanion-version');
  }
}
