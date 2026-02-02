// DEPRECATED: This file has been replaced by the new HardwareService
// All components should now use the new hooks from @/hooks/use-hardware-api

// TODO: Remove BaseApi import when all components are migrated
import { BaseApi } from "./base-api";

export type State = {
    timer: number | null,
    activeteTime: number | null,
    enabled: boolean,
}

export class ModemControllApi extends BaseApi {
    constructor() {
        super({ endpoint: '' });
    }

    async startTimer(): Promise<void> {
        await this.post('start');
    }

    async setTimer(timer: number): Promise<void> {
        await this.post('set', { timer });
    }

    async stopTimer() {
        await this.post('stop');
    }

    async disableModem() {
        await this.post('off');
    }

    async enableModem() {
        await this.post('on');
    }
    
    async getState (): Promise<State> {
        return this.get('state');
    }
}