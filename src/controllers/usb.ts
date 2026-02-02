import _ from 'lodash';
import {type Device, devices} from 'node-hid';
import { sleep } from './sleep.js';

export class Usb {
    public allowedVendors: number[]

    constructor() {
        this.allowedVendors = [
            4617 // radio master
        ]
    }

    async getDevicesList(): Promise<Device[]> {
        const hidDevices = devices()
            .filter((device: Device) => !!device.product);

        return _.uniqBy(hidDevices, 'path')
    }
}
