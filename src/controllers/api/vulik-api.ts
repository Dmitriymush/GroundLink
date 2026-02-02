// DEPRECATED: This file has been replaced by the new DroneService
// All components should now use the new hooks from @/hooks/use-drone-api

// TODO: Remove BaseApi import when all components are migrated
import { BaseApi } from "./base-api";

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

export type Vulik = {
  id: string; //uuid v4
  dronesCount: number; // number of loaded drones
  batteryLevel: number; // battery level in volts - float
  droneReady: boolean; // drone ready to fly - boolean
  leadState: LeadState; // lead state - enum
  boxState: BoxState; // box state - enum
};

type GetAllVuliksResponse = {
  vuliks: Vulik[];
};

type GetVulikResponse = {
  vulik: Vulik;
};

type ChangeLeadStateRequest = {
  id: string; // vulicId
  action: Actions.lead;
  state: LeadState.open | LeadState.close;
};

type ChangeLeadStateResponse = {
  state: LeadState;
};

type UnloadDroneRequest = {
  id: string; // vulicId
  action: Actions.unload;
};

type UnloadDroneResponse = {
  success: boolean;
};

export class VulikApi extends BaseApi {
  constructor() {
    super({ endpoint: "", debug: true });
  }

  async ping(): Promise<boolean> {
    try {
      await this.get("ping", {}, { timeout: 10e3, noDebug: true });
      return true;
    } catch (err) {
      return false;
    }
  }

  async getVuliks(): Promise<GetAllVuliksResponse> {
    const data = await this.get("vuliks");
    return { vuliks: data };
  }

  async getVulik(id: string): Promise<GetVulikResponse> {
    const data = await this.get(`vuliks/${id}`);
    console.log("get one vulik", data);
    return data;
  }

  async changeLeadState(
    vulicId: string,
    leadState: LeadState.open | LeadState.close
  ): Promise<ChangeLeadStateResponse> {
    console.time("1");
    const request: ChangeLeadStateRequest = {
      id: vulicId,
      action: Actions.lead,
      state: leadState,
    };

    const res = await this.post(`vuliks/${vulicId}`, request, { json: true });
    console.timeEnd("1");
    return res;
  }

  async unloadDrone(vulicId: string): Promise<UnloadDroneResponse> {
    const request: UnloadDroneRequest = {
      id: vulicId,
      action: Actions.unload,
    };

    return this.post(`vuliks/${vulicId}`, request, { json: true });
  }
}
