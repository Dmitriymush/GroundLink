export * from './types';
export * from './http-client';
export * from './base-service';
export * from './rpanion-service';
export * from './hardware-service';
export * from './drone-service';
export * from './initiator-service';

import { RPanionService } from './rpanion-service';
import { HardwareService } from './hardware-service';
import { DroneService } from './drone-service';
import { InitiatorService } from './initiator-service';
import { useStorage } from '@vueuse/core';

// Service factory
export class ApiServiceFactory {
  private static instances = new Map<string, any>();

  static createRPanionService(host?: string): RPanionService {
    const storageHost = useStorage<string>('host', null);
    const baseURL = host || storageHost.value || 'http://10.0.2.100:3000';
    
    const key = `rpanion-${baseURL}`;
    
    if (!this.instances.has(key)) {
      const service = new RPanionService({
        baseURL,
        debug: process.env.NODE_ENV === 'development',
      });
      this.instances.set(key, service);
    }
    
    return this.instances.get(key);
  }

  static createHardwareService(host?: string, port?: number): HardwareService {
    const baseURL = `http://${host || '127.0.0.1'}:${port || 3003}`;
    const key = `hardware-${baseURL}`;
    
    if (!this.instances.has(key)) {
      const service = new HardwareService({
        baseURL,
        debug: process.env.NODE_ENV === 'development',
      });
      this.instances.set(key, service);
    }
    
    return this.instances.get(key);
  }

  static createDroneService(host?: string, port?: number): DroneService {
    const baseURL = `http://${host || '127.0.0.1'}:${port || 8000}`;
    const key = `drone-${baseURL}`;
    
    if (!this.instances.has(key)) {
      const service = new DroneService({
        baseURL,
        debug: process.env.NODE_ENV === 'development',
      });
      this.instances.set(key, service);
    }
    
    return this.instances.get(key);
  }

  static createInitiatorService(endpoint?: string, accessToken?: string): InitiatorService {
    const baseURL = endpoint || 'http://127.0.0.1:3000';
    const key = `initiator-${baseURL}-${accessToken || 'no-token'}`;
    
    if (!this.instances.has(key)) {
      const service = new InitiatorService({
        baseURL,
        accessToken,
        debug: process.env.NODE_ENV === 'development',
      });
      this.instances.set(key, service);
    }
    
    return this.instances.get(key);
  }

  static clearInstances(): void {
    this.instances.clear();
  }
}

// Convenience exports
export const createRPanionService = ApiServiceFactory.createRPanionService.bind(ApiServiceFactory);
export const createHardwareService = ApiServiceFactory.createHardwareService.bind(ApiServiceFactory);
export const createDroneService = ApiServiceFactory.createDroneService.bind(ApiServiceFactory);
export const createInitiatorService = ApiServiceFactory.createInitiatorService.bind(ApiServiceFactory);
