// DEPRECATED: This file has been replaced by the new HardwareService
// All components should now use the new hooks from @/hooks/use-hardware-api

// TODO: Remove needle import when all components are migrated
import needle from "needle";

export class VulicApi {
  public host: string;
  public port: number;
  private chanaelMapping: { [input: number]: number };

  constructor() {
    this.host = "127.0.0.1";
    this.port = 8000;
    this.chanaelMapping = {
      1: 2,
      2: 3,
      3: 1,
      4: 4,
    };
  }

  setHost(host: string): void {
    this.host = host;
  }

  setPort(port: number): void {
    this.port = port;
  }

  private getRelayCode(relay: number, state: boolean): string {
    const channel = this.chanaelMapping[relay];

    if (relay != null && relay < 5) {
      return state ? `High${channel}` : `Low${channel}`;
    }

    return "";
  }

  async changeRelayState(relay: number, state: boolean) {
    const response = await needle(
      "post",
      `http://${this.host}:${this.port}/`,
      {
        submit: this.getRelayCode(relay, state),
      },
      {}
    );

    console.log(response.body);
  }
}

export const vulicApi = new VulicApi();
