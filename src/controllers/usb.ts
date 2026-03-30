import _ from 'lodash';
import { sleep } from './sleep.js';

type Device = import('node-hid').Device;

let _devices: (() => Device[]) | null = null;
try {
    _devices = require('node-hid').devices;
} catch {
    console.warn('[USB] node-hid not available');
}

export class Usb {
    public allowedVendors: number[]

    constructor() {
        this.allowedVendors = [
            4617 // radio master
        ]
    }

    async getDevicesList(): Promise<Device[]> {
        if (!_devices) return [];

        const hidDevices = _devices()
            .filter((device: Device) => !!device.product);

        return _.uniqBy(hidDevices, 'path')
    }
}
