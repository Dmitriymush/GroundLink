import { useStorage } from "@vueuse/core";
import { devices } from "@/controllers/devices";
import { virtualJR } from "@/controllers/virtualJR";
import { config } from "@/config";

export const useDroneControll = () => {
  const droneControllEnable = useStorage("doneControllEnable", false);
  const droneControllChannel = useStorage("doneControllChannel", "");
  const droneControllValue = useStorage("doneControllValue", 0);

  const setDefaultManualChannel = () => {
    droneControllChannel.value = config.defaultManualChannel;

    devices.setManualChannel(droneControllChannel.value, {
      address: virtualJR.channelsMap[droneControllChannel.value],
      value: droneControllValue.value,
    });
  };

  const restoreState = () => {
    if (!droneControllEnable.value) {
      devices.reaseAllManualChannels();
      return;
    }

    if (!droneControllChannel.value) {
      if (config.defaultManualChannel) {
        setDefaultManualChannel();
      } else {
        devices.reaseAllManualChannels();
      }
      return;
    }

    devices.setManualChannel(droneControllChannel.value, {
      address: virtualJR.channelsMap[droneControllChannel.value],
      value: droneControllValue.value,
    });
  };

  return {
    droneControllChannel,
    droneControllEnable,
    droneControllValue,
    restoreState,
  };
};
