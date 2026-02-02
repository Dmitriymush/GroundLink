// DEPRECATED: This file has been replaced by the new HardwareService
// All components should now use the new hooks from @/hooks/use-hardware-api

// TODO: Remove BaseApi import when all components are migrated
import { BaseApi } from "./base-api";

export class MegaServerApi extends BaseApi {
  constructor() {
    super({ endpoint: "" });
  }

  async ping(): Promise<boolean> {
    try {
      await this.get("ping", {}, { timeout: 5000 });
      return true;
    } catch (error) {
      console.warn(error);
      return false;
    }
  }

  async getCanDevices(): Promise<any> {
    const response = await this.get("can");

    if (typeof response === "string") {
      try {
        return JSON.parse(response);
      } catch (e) {
        return [];
      }
    }

    return response;
  }

  async changeRelayState(
    type: string,
    id: number,
    state: boolean
  ): Promise<void> {
    const path = `can/${type}/${state ? "on" : "off"}/${id}`;
    await this.get(path);

    console.log("send request", path);
  }

  async changeLeadState(id: number, state: boolean): Promise<void> {
    const path = `can/lead/${state ? "open" : "close"}/${id}`;
    await this.get(path);

    console.log("send request", path);
  }

  async testCartridge(id: number): Promise<void> {
    const path = `can/cartridge/${id}`;
    await this.get(path);

    console.log("send request", path);
  }
}
