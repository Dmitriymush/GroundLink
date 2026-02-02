import { Socket, socket } from "./socket";

type ChannelsMap = {
  [key: string]: number[];
};

export class VirtualJR {
  public socket: Socket | null;
  public isRunning: boolean = false;
  private channes: Buffer;

  constructor(socket: Socket) {
    this.socket = socket;
    /**
     * [0, 1] AUX5 AUX6 AUX7 AUX8
     * [3, 4] CH1
     * [5, 6] CH2
     * [7, 8] CH3
     * [9, 10] CH4
     * [11, 12] CH5
     * [13, 14] CH6
     * [15, 16] CH7
     * [17, 18] CH8
     * [19, 20] AUX 11
     * [21, 22] AUX 12
     */
    this.channes = Buffer.alloc(24).fill(0);
  }

  public static get channelsMap(): ChannelsMap {
    return {
      CH1: [3, 4],
      CH2: [5, 6],
      CH3: [7, 8],
      CH4: [9, 10],
      CH5: [11, 12],
      CH6: [13, 14],
      CH7: [15, 16],
      CH8: [17, 18],
      CH9: [19, 20],
      CH10: [21, 22],
      CH11: [23, 24],
      CH12: [25, 26],
      CH13: [27, 28],
      CH14: [29, 30],
      CH15: [31, 32],
      CH16: [33, 34],
    };
  }

  // AUX = 9 10 11 12
  get channelsMap(): ChannelsMap {
    return VirtualJR.channelsMap;
  }

  setChannel(address: number[], value: number) {
    if (address[0] === 0) {
      const add = value > 1000 ? 1 : 0;

      if (add) {
        this.channes[0] = this.channes[0] | (1 << address[1]);
      } else {
        this.channes[0] = this.channes[0] & ~(1 << address[1]);
      }

      return;
    }

    if (typeof value === "number") {
      this.socket?.fillChannel(this.channes, value, address[0], address[1]);
    }
  }

  private loop() {
    this.socket?.send(this.channes);

    if (this.isRunning) {
      setTimeout(() => this.loop(), 20);
    }
  }

  public start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.loop();
  }

  public stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
  }
}

export const virtualJR = new VirtualJR(new Socket());
