// DEPRECATED: This file has been replaced by the new unified API services
// All components should now use the new hooks from @/hooks/use-*-api

import type { ConnectionSetting } from "@/store";

// TODO: Remove these exports once all components are migrated
// export const megaServerApi = new MegaServerApi();
// export const modemControllApi = new ModemControllApi();
// export const vulikApi = new VulikApi();
// export const intiatorApi = new InitiatorApi();

// TODO: Replace with new service factory methods
export const setHost = (host: string, port: number | string) => {
  // TODO: Use new HardwareService instead
  console.warn('setHost is deprecated, use new unified services');
};

export const setHostV2 = (connection: ConnectionSetting) => {
  // TODO: Use new service factory instead
  console.warn('setHostV2 is deprecated, use new unified services');
  console.info("set new connection", connection);
};
