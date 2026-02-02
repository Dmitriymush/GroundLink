import { useStorage } from "@vueuse/core";
import { defineStore } from "pinia";

export type CanDevice = {
  id: number;
  online: boolean;
  type: number;
  droneState: boolean;
  relayState: boolean;
  leadOpen: boolean;
  droneVoltage: number;
  cartridgeState: number;
};

export const useCanStore = defineStore("canStore", () => {
  const devices = useStorage<CanDevice[]>("can-devices", []);

  const clearDevices = () => {
    devices.value = [];
  };

  return { devices, clearDevices };
});
