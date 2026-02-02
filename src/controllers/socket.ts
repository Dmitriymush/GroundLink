import { fillChannel } from "@/utils";
import dgram from "dgram";
import { ipcRenderer } from "electron";
import { v4 as uuid } from "uuid";

interface ResponseCallbacks {
  [name: string]: Function;
}

enum COMMANDS {
  SAFE = "safe",
  DETONATE = "detonate",
}

export class Socket {
  private port: number;
  private host: string;
  private client: dgram.Socket | null | undefined;
  private callbacks: ResponseCallbacks;
  private lastMessageReceived: number;
  private detonateRunning: boolean;
  private detonateTimeout: any;
  private command: COMMANDS | null;

  constructor() {
    this.port = 0;
    this.host = "";
    this.client = null;

    this.callbacks = {};
    this.lastMessageReceived = Date.now();
    this.detonateTimeout = null;
    this.detonateRunning = false;
    this.command = null;
  }

  get isConnectionOk(): boolean {
    return Date.now() - this.lastMessageReceived < 1e3;
  }

  connect(host: string, port: number): void {
    this.host = host;
    this.port = port;

    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  disconnect(): void {
    this.client?.close();
    this.client = null;
  }

  messageHandle(data: Buffer): void {
    this.lastMessageReceived = Date.now();

    Object.keys(this.callbacks).forEach((key) => {
      this.callbacks[key]();
    });
  }

  public send(data: Buffer): void {
    if (!this.client || !this.port || !this.host) {
      return;
    }

    // this.client.send(
    //   data,
    //   0,
    //   data.length,
    //   this.port,
    //   this.host,
    //   (err, bytes) => {
    //     if (err) {
    //       console.error(`UDP message send error:`, err);
    //     }
    //   }
    // );
  }

  async request(data: Buffer, clb: Function): Promise<any> {
    const promise = new Promise(async (resolve, reject) => {
      const callback = (): void => {
        delete this.callbacks[uuid()];
        resolve(true);
      };

      this.callbacks[uuid()] = callback;
      this.send(data);
    });

    return Promise.race([
      promise,
      new Promise((resolve, reject) => setTimeout(reject, 10e3)),
    ]);
  }

  public fillChannel(
    buffer: Buffer,
    value: number,
    start: number,
    stop: number
  ) {
    return fillChannel(buffer, value, start, stop);
  }

  public generateCommand(): Buffer {
    const buffer = new Buffer(23).fill(0);
    buffer[7] = this.command === COMMANDS.DETONATE ? 254 : 0;
    buffer[8] = this.command === COMMANDS.DETONATE ? 0x07 : 0;

    buffer[11] = this.command === COMMANDS.DETONATE ? 254 : 0;
    buffer[12] = this.command === COMMANDS.DETONATE ? 0x07 : 0;

    buffer[3] = this.command === COMMANDS.DETONATE ? 254 : 0;
    buffer[4] = this.command === COMMANDS.DETONATE ? 0x07 : 0;

    buffer[5] = this.command === COMMANDS.DETONATE ? 254 : 0;
    buffer[6] = this.command === COMMANDS.DETONATE ? 0x07 : 0;

    buffer[9] = this.command === COMMANDS.DETONATE ? 254 : 0;
    buffer[10] = this.command === COMMANDS.DETONATE ? 0x07 : 0;

    buffer[13] = this.command === COMMANDS.DETONATE ? 254 : 0;
    buffer[14] = this.command === COMMANDS.DETONATE ? 0x07 : 0;

    buffer[15] = this.command === COMMANDS.DETONATE ? 254 : 0;
    buffer[16] = this.command === COMMANDS.DETONATE ? 0x07 : 0;

    buffer[0] = 0x00;
    return buffer;
  }

  private detonateLoop(): any {
    if (!this.detonateRunning) {
      return;
    }

    if (this.command == null) {
      return setTimeout(() => this.detonateLoop(), 20);
    }

    if (this.command === COMMANDS.SAFE) {
      this.send(this.generateCommand());
    }

    if (this.command === COMMANDS.DETONATE) {
      this.send(this.generateCommand());
    }

    setTimeout(() => this.detonateLoop(), 20);
  }

  public startLoop(): void {
    this.detonateRunning = true;
    this.detonateLoop();
  }

  public stopLoop(): void {
    this.detonateRunning = false;
    clearTimeout(this.detonateTimeout);
  }

  public arm(isArm: Boolean): void {
    this.command = isArm ? COMMANDS.SAFE : null;
  }

  public detonate(isDetonate: Boolean): void {
    if (this.command == null) {
      return;
    }

    this.command = isDetonate ? COMMANDS.DETONATE : COMMANDS.SAFE;
  }

  public changeAddress(host: string, port: number): void {
    this.port = port;
    this.host = host;

    ipcRenderer.invoke('hid', { port, host });

    this.disconnect();
    this.connect(host, port);
  }
}

export const socket = new Socket();
