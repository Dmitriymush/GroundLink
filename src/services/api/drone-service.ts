import { BaseApiService } from './base-service';

export interface DroneConfig {
  baseURL: string;
  debug?: boolean;
}

export enum LeadState {
  open = "open",
  close = "close",
  stuck = "stuck",
}

export enum BoxState {
  service = "service",
  normal = "normal",
  empty = "empty",
  error = "error",
}

enum Actions {
  lead = "lead",
  unload = "unload",
}

export interface Drone {
  id: string; // uuid v4
  dronesCount: number; // number of loaded drones
  batteryLevel: number; // battery level in volts - float
  droneReady: boolean; // drone ready to fly - boolean
  leadState: LeadState; // lead state - enum
  boxState: BoxState; // box state - enum
}

export interface GetAllDronesResponse {
  vuliks: Drone[];
}

export interface GetDroneResponse {
  vulik: Drone;
}

export interface ChangeLeadStateRequest {
  id: string; // vulicId
  action: Actions.lead;
  state: LeadState.open | LeadState.close;
}

export interface ChangeLeadStateResponse {
  state: LeadState;
}

export interface UnloadDroneRequest {
  id: string; // vulicId
  action: Actions.unload;
}

export interface UnloadDroneResponse {
  success: boolean;
}

export class DroneService extends BaseApiService {
  constructor(config: DroneConfig) {
    super({
      baseURL: config.baseURL,
      debug: config.debug || false,
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.http.get('ping', {}, { timeout: 10000 });
      return true;
    } catch (err) {
      return false;
    }
  }

  async getDrones(): Promise<GetAllDronesResponse> {
    const response = await this.http.get<any>('vuliks');
    return { vuliks: response.data || [] };
  }

  async getDrone(id: string): Promise<GetDroneResponse> {
    const response = await this.http.get<any>(`vuliks/${id}`);
    console.log('get one drone', response.data);
    return response.data;
  }

  async changeLeadState(
    droneId: string,
    leadState: LeadState.open | LeadState.close
  ): Promise<ChangeLeadStateResponse> {
    console.time('changeLeadState');
    const request: ChangeLeadStateRequest = {
      id: droneId,
      action: Actions.lead,
      state: leadState,
    };

    const response = await this.http.post<ChangeLeadStateResponse>(`vuliks/${droneId}`, request);
    console.timeEnd('changeLeadState');
    return response.data;
  }

  async unloadDrone(droneId: string): Promise<UnloadDroneResponse> {
    const request: UnloadDroneRequest = {
      id: droneId,
      action: Actions.unload,
    };

    const response = await this.http.post<UnloadDroneResponse>(`vuliks/${droneId}`, request);
    return response.data;
  }

  // ===== TANSTACK QUERY HELPERS =====
  getConnectionQueryKey() {
    return this.createQueryKey('drone-connection');
  }

  getDronesQueryKey() {
    return this.createQueryKey('drone-list');
  }

  getDroneQueryKey(id: string) {
    return this.createQueryKey('drone-details', { id });
  }

  getLeadStateQueryKey(droneId: string) {
    return this.createQueryKey('drone-lead-state', { droneId });
  }
}
