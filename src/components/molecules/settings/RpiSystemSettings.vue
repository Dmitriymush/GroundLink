<template>
  <div>
    <VExpansionPanels class="container">
      <VExpansionPanel>
        <!-- Custom header with status badge -->
        <VExpansionPanelTitle>
          <div class="header-content">
            <span class="header-title">{{ t('System settings') }}</span>
            <!-- Use a v-chip as a status indicator for a compact badge -->
            <VChip
                v-if="!connectionStatus"
                color="warning"
                class="status-chip"
                small
            >
              {{ t("No connection") }}
            </VChip>
          </div>
        </VExpansionPanelTitle>

        <VExpansionPanelText>
          <!-- Actions Row -->
          <VRow class="actions-row" dense>
            <VCol cols="6" class="action-col">
              <VBtn
                  color="warning"
                  class="button"
                  @click="reboot()"
                  :loading="loading"
                  block
              >
                {{ t("Reboot") }}
              </VBtn>
            </VCol>
            <VCol cols="6" class="action-col" v-if="appSettingsStore.isDevMode">
              <VBtn
                  color="warning"
                  class="button"
                  @click="shutdown()"
                  :loading="loading"
                  block
              >
                {{ t("Shutdown") }}
              </VBtn>
            </VCol>
            <VCol cols="6" class="action-col">
              <VBtn
                  class="button"
                  @click="gotoWebSettings"
                  block
                  color="primary"
              >
                {{ t("Web settings") }}
              </VBtn>
            </VCol>
          </VRow>

          <VRow class="gateway-row" dense align="center">
            <VCol cols="6">
              <VTextField
                  variant="outlined"
                  class="item"
                  v-model="gatewayValue"
                  :label="t('Gateway')"
                  :disabled="gatewayLoading"
              />
            </VCol>
            <VCol cols="6">
              <VBtn
                  class="item"
                  color="save"
                  :loading="savingGateway || gatewayLoading"
                  @click="saveGateway"
                  block
              >
                {{ t("Save gateway") }}
              </VBtn>
            </VCol>
          </VRow>
        </VExpansionPanelText>
      </VExpansionPanel>
    </VExpansionPanels>

    <VDialog v-model="confirm" persistent width="700">
      <VCard>
        <VCardTitle>
          {{ t("Are you sure ?") }}
        </VCardTitle>

        <VCardActions>
          <VBtn color="decline" @click="confirm = false">{{ t("Cancel") }}</VBtn>
          <VBtn color="save" @click="apply()">{{ t("Yes") }}</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<script lang="ts" setup>
import { useT } from "@/hooks/use-t";
import { watch, ref, onMounted, computed } from "vue";
import { useStorage } from "@vueuse/core";
import { shell } from "electron";
import { useAppSeetingsStore } from "@/store/app-settings-store";
import { 
  useRPanionConnection, 
  useRPanionGateway, 
  useSetRPanionGateway, 
  useRPanionReboot, 
  useRPanionShutdown 
} from "@/hooks/use-rpanion-api";

const t = useT();
const confirm = ref<boolean>(false);
const action = ref<string>("");
const storageHost = useStorage<string>("host", null);
const gatewayValue = ref<string>("");
const appSettingsStore = useAppSeetingsStore();

const { data: connectionStatus } = useRPanionConnection(storageHost.value);

const {
  data: gateway,
  isPending: gatewayLoading,
  refetch,
} = useRPanionGateway(storageHost.value);

const { mutate: saveGateway, isPending: savingGateway } = useSetRPanionGateway(storageHost.value);

const { mutate: doReboot, isPending: rebootLoading } = useRPanionReboot(storageHost.value);
const { mutate: doShutdown, isPending: shutdownLoading } = useRPanionShutdown(storageHost.value);

const loading = computed(() => rebootLoading.value || shutdownLoading.value);

const reboot = () => {
  action.value = "reboot";
  confirm.value = true;
};

const shutdown = () => {
  action.value = "shutdown";
  confirm.value = true;
};

const apply = () => {
  if (action.value === "reboot") {
    doReboot();
  } else if (action.value === "shutdown") {
    doShutdown();
  }
  confirm.value = false;
};

const gotoWebSettings = () => {
  shell.openExternal(`http://${storageHost.value}:3003/app`);
};

watch(gateway, (value) => {
  gatewayValue.value = value?.gateway || "";
});

onMounted(() => {
  gatewayValue.value = gateway.value?.gateway || "";
});
</script>

<style scoped>

/* Custom Header Content */
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

/* Actions Row Styling */
.actions-row {
  margin-bottom: 16px;
}
.action-col {
  display: flex;
  justify-content: center;
  padding: 8px;
}

.button {
  margin: 5px;
}

/* Gateway Row Styling */
.gateway-row {
  margin-top: 16px;
}
.gateway-row .item {
  margin: 5px;
}

.gateway .item {
  margin: 5px;
}

.v-expansion-panel-title {
  height: 64px;
}
</style>
