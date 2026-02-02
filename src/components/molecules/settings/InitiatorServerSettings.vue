<script setup lang="ts">
import { ref, watch } from "vue";
import { useAppSeetingsStore } from "@/store";
import { useT } from "@/hooks/use-t";
import { debounce } from "lodash";

const t = useT();
const store = useAppSeetingsStore();

const connection = ref({
  initiatorServerEndpoint:
    store.selectedConnection?.initiatorServerEndpoint || "",
  initiatorServerToken: store.selectedConnection?.initiatorServerToken || "",
});

const saveHandle = () => {
  if (!store.selectedConnection) return;

  store.saveConnection({
    ...store.selectedConnection,
    initiatorServerEndpoint: connection.value.initiatorServerEndpoint,
    initiatorServerToken: connection.value.initiatorServerToken,
  });
};

const autoSave = debounce(saveHandle, 500, { trailing: true });

watch(() => connection.value.initiatorServerEndpoint, autoSave);
watch(() => connection.value.initiatorServerToken, autoSave);

watch(
  () => store.selectedConnection,
  (newValue) => {
    if (!newValue) return;
    connection.value = {
      initiatorServerEndpoint: newValue.initiatorServerEndpoint || "",
      initiatorServerToken: newValue.initiatorServerToken || "",
    };
  },
  { immediate: true }
);
</script>

<template>
  <div class="initiator-server-settings">
    <h4>{{ t("Initiator server settings") }}</h4>

    <div class="input-block">
      <v-text-field
        :label="t('Endpoint')"
        hide-details
        v-model="connection.initiatorServerEndpoint"
      />
    </div>

    <div class="input-block">
      <v-text-field
        :label="t('Access token')"
        type="password"
        hide-details
        v-model="connection.initiatorServerToken"
      />
    </div>
  </div>
</template>

<style scoped>
.initiator-server-settings {
  margin-bottom: 16px;
}

.input-block {
  margin-bottom: 10px;
}
</style>
