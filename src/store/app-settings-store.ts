import { useStorage } from "@vueuse/core";
import { defineStore } from "pinia";
import { ref } from "vue";
import { v4 as uuid } from "uuid";

export type ConnectionSetting = {
  id?: string;
  name?: string;
  hostIp?: string;
  operatorIp?: string;
  port?: number;
  secondPort?: number;
  mainServerPort?: number;
  rpanionServerPort?: number;
  relayServerPort?: number;
  vulikHost?: string;
  vulikPort?: number;
  initiatorServerEndpoint?: string;
  initiatorServerToken?: string;
};

export type ConnectionSettings = Array<ConnectionSetting>;

export const useAppSeetingsStore = defineStore("app-settings", () => {
  const isDevMode = ref<boolean>(false);
  const isDarkMode = ref<boolean>(false);
  const connectionSettings = useStorage<ConnectionSettings>(
    "connection-settings",
    []
  );
  const selectedConnection = useStorage<ConnectionSetting>(
    "selected-connection",
    {}
  );
  const storageHost = useStorage<string>("host", null);
  const storagePort = useStorage<number>("port", 27015);
  const storageOwnIp = useStorage<string>("own-ip", null);
  const storageSecondPort = useStorage<number>("second-port", 27016);

  // todo migrate to backend server only for firts prototype
  const vulikHost = useStorage<string>("vulik-host", "localhost");
  const vulikPort = useStorage<number>("vulik-port", 27017);

  const saveConnection = (connection: ConnectionSetting) => {
    if (!connection.id) {
      connectionSettings.value = [
        ...connectionSettings.value,
        { ...connection, id: uuid() },
      ];

      return;
    }

    connectionSettings.value = connectionSettings.value.map((con) => {
      if (con.id !== connection.id) {
        return con;
      }

      return connection;
    });
  };

  const deleteConnection = (id: string) => {
    connectionSettings.value = connectionSettings.value.filter(
      (con) => con.id !== id
    );
  };

  const initiatorServerEndpoint = useStorage<string>(
    "initiator-server-endpoint",
    ""
  );
  const initiatorServerToken = useStorage<string>("initiator-server-token", "");

  const applyConnection = (connection = selectedConnection.value) => {
    if (!connection) {
      return;
    }

    storageHost.value = connection.hostIp;
    storagePort.value = connection.port;
    storageOwnIp.value = connection.operatorIp;
    storageSecondPort.value = connection.secondPort;
    vulikHost.value = connection.vulikHost;
    vulikPort.value = connection.vulikPort;
    initiatorServerEndpoint.value = connection.initiatorServerEndpoint || "";
    initiatorServerToken.value = connection.initiatorServerToken || "";
  };

  const selectConnection = (connection: ConnectionSetting) => {
    applyConnection(connection);
    selectedConnection.value = connection;
  };

  return {
    isDevMode,
    isDarkMode,
    connectionSettings,
    selectedConnection,
    saveConnection,
    deleteConnection,
    selectConnection,
    initiatorServerEndpoint,
    initiatorServerToken
  };
});
