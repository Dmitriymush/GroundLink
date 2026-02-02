import { HID, type Device } from "node-hid";
import _, { add } from "lodash";
import { Usb } from "./usb";
import { socket, Socket } from "./socket";
import { EventEmitter } from "events";
import { ipcRenderer } from "electron";

export type Channels = {
  roll: number;
  pitch: number;
  throttle: number;
  yaw: number;
  arm: number;
  mode: number;
  aux3: number;
  aux4: number;
  aux5: number;
  aux6: number;
  aux7: number;
  aux8: number;
  aux9: number;
  aux10: number;
  aux11: number;
  aux12: number;
};

type DataTOSend = {};

type Channel = {
  address: Array<number>;
  value: number;
};

class Devices extends EventEmitter {
  private usb: Usb;
  public device: Device | null | undefined;
  private hid: HID | null | undefined;
  private active: boolean = false;
  private manualChannels: {
    [key: string]: Channel;
  };
  private lastReceivedMessage: number;
  private invervalId: any;
  private status: boolean;

  constructor() {
    super();
    this.usb = new Usb();
    this.device = null;
    this.hid = null;
    this.active = false;
    this.status = false;
    this.lastReceivedMessage = Date.now();
    this.invervalId = null;

    this.manualChannels = {};
    this.on('status', status => this.status = status);
    setInterval(this.resoreDevice.bind(this), 1e3);
  }

  public get allowedDevicesVendors(): number[] {
    return this.usb.allowedVendors;
  }

  public set ver(value: number) {
  }

  public set hoz(value: number) {
  }

  public setRefrashRate(value: number) {

  }

  async getDevices(): Promise<Device[]> {
    return this.usb.getDevicesList();
  }

  public setDevice(device: Device | null): void {
    this.device = device;

    if (device != null) {
      this.active = true;
      this.start();
    } else {
      ipcRenderer.invoke("hid", { vendorId: -1, productId: -1 });
    }
  }

  public setManualChannel(key: string, channel: Channel): this {
    this.manualChannels[key] = channel;
    ipcRenderer.invoke("hid", { manualChannels: this.manualChannels });
    return this;
  }

  public reaseManualChannel(key: string): this {
    delete this.manualChannels[key];
    ipcRenderer.invoke("hid", { manualChannels: this.manualChannels });
    return this;
  }

  public reaseAllManualChannels(): this {
    this.manualChannels = {};
    ipcRenderer.invoke("hid", { manualChannels: this.manualChannels });
    return this;
  }

  private emitData(event: any, data: Buffer): void {
    this.emit("data", data);
    this.lastReceivedMessage = Date.now();
  }

  private start() {
    if (!this.device || !this.active) {
      return;
    }

    ipcRenderer.invoke("hid", {
      vendorId: this.device.vendorId,
      productId: this.device.productId,
    });

    ipcRenderer.off('channels', this.emitData.bind(this));
    ipcRenderer.on("channels", this.emitData.bind(this));

    clearInterval(this.invervalId);

    this.invervalId = setInterval(() => {
      if (Date.now() - this.lastReceivedMessage > 1e3) {
        this.emit('status', false);
      } else {
        this.emit('status', true);
      }
    });
  }

  public stop() {
    ipcRenderer.invoke("hid", { vendorId: -1, productId: -1 });
  }

  private async resoreDevice(): Promise<void> {
    if (this.status) {
      return;
    }

    if (!this.device) {
      return;
    }

    const devices = await this.usb.getDevicesList();
    const currentDevice = devices.find((device) => 
      device.vendorId === this.device?.vendorId && device.productId === this.device?.productId
    );

    if (!currentDevice) {
      return;
    }

    this.stop();
    this.setDevice(currentDevice);
  };
}

export const devices = new Devices();
