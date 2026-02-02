<template>
  <VContainer class="container">
    <div class="config-container">
      <div
        class="config-item"
        v-for="connection in connectionSettings"
        :key="connection.id"
      >
        <VBtn
          :color="selectedConnection?.id === connection.id ? 'red' : ''"
          class="connection-btn"
          @click="selectConnectionHandler(connection)"
        >
          {{ connection.name }}
          <span class="divider">|</span>
          <span class="action-icons">
            <ActionIcon
              icon="mdi-pencil"
              :tooltip="t('Edit connection tooltip')"
              @click="editConnectionHandler(connection)"
            />
            <span class="actions-divider">|</span>
            <ActionIcon
              icon="mdi-delete"
              :tooltip="t('Delete connection tooltip')"
              @click="confirmDelete(connection)"
            />
          </span>
        </VBtn>
      </div>
    </div>

    <div>
      <VBtn color="primary" class="create-action" @click="openModal()">
        {{ t("Add new connection") }}
      </VBtn>
    </div>

    <AddNewConnectionModal
      :open="openAddConnectionModal"
      :connection="editingConnection"
      @save="saveConnection"
      @close="closeModal"
    />

    <ConfigmModal
      v-if="pendingDelete"
      :text="`${t('Delete connection message')} '${pendingDelete?.name}'?`"
      @onSuccess="confirmDeleteHandler"
      @onCancel="pendingDelete = undefined"
    />
  </VContainer>
</template>

<script setup lang="ts">
import AddNewConnectionModal from "@/components/modals/AddNewConnectionModal.vue";
import { useT } from "@/hooks/use-t";
import { useAppSeetingsStore, type ConnectionSetting } from "@/store";
import { ref, toRefs } from "vue";
import { VBtn, VContainer } from "vuetify/components";
import ConfigmModal from "@/components/modals/ConfigmModal.vue";
import ActionIcon from "@/components/atoms/ActionIcon.vue";

const appSettingsStore = useAppSeetingsStore();
const {
  saveConnection: saveToStore,
  deleteConnection,
  selectConnection,
} = appSettingsStore;
const { connectionSettings, selectedConnection } = toRefs(appSettingsStore);
const openAddConnectionModal = ref<boolean>(false);
const editingConnection = ref<ConnectionSetting | undefined>(undefined);
const pendingDelete = ref<ConnectionSetting | undefined>(undefined);
const t = useT();

const selectConnectionHandler = (connection: ConnectionSetting): void => {
  selectConnection(connection);
};

const confirmDelete = (connection: ConnectionSetting) => {
  pendingDelete.value = connection;
};

const confirmDeleteHandler = () => {
  if (pendingDelete.value?.id) {
    deleteConnection(pendingDelete.value.id);
    pendingDelete.value = undefined;
  }
};

const openModal = () => {
  editingConnection.value = undefined;
  openAddConnectionModal.value = true;
};

const editConnectionHandler = (connection: ConnectionSetting) => {
  editingConnection.value = connection;
  openAddConnectionModal.value = true;
};

const closeModal = () => {
  openAddConnectionModal.value = false;
  editingConnection.value = undefined;
};

const saveConnection = (connection: ConnectionSetting): void => {
  saveToStore(connection);
  closeModal();
};
</script>

<style scoped>
.container {
  display: flex;
  /* Center the connection buttons instead of space-between */
  justify-content: center;
  flex-wrap: wrap;
}

.config-container {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
}

.config-item {
  display: flex;
  margin: 0 10px 10px 0;
  align-items: center;
}

.connection-btn {
  display: flex;
  align-items: center;
}

.divider {
  margin: 0 10px;
  opacity: 0.5;
}

.action-icons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.actions-divider {
  opacity: 0.3;
  font-size: 0.9em;
}
</style>
