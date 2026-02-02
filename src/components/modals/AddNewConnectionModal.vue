<template>
  <VDialog :modelValue="open" persistent width="700">
    <VForm v-model="isValid" @submit.prevent="saveHandle">
      <VCard>
        <VCardTitle>
          {{ t(isEditMode ? "Edit connection" : "Add new connection") }}
        </VCardTitle>

        <VCardText>
          <!-- Basic fields -->
          <div class="field" v-for="field in basicFields" :key="field.name">
            <VTextField
              variant="outlined"
              :name="field.name"
              :label="field.label"
              :disabled="field.disabled"
              :modelValue="field.value"
              :rules="field.rules"
              @update:modelValue="field.onChange"
            />

            <VBtn
              color="primary"
              v-if="field.hasAuto"
              class="auto-button"
              @click="field.autoHandler"
              >{{ t("Auto") }}</VBtn
            >
          </div>

          <!-- Vulik settings group -->
          <div class="settings-group" v-if="isVulikEnabled">
            <div class="settings-group-header" @click="toggleVulikSettings">
              <div class="header-left">
                <VIcon>{{
                  isVulikSettingsOpen ? "mdi-chevron-down" : "mdi-chevron-right"
                }}</VIcon>
                <h3>{{ t("Vulik settings") }}</h3>
              </div>
              <div class="settings-actions" v-show="isVulikSettingsOpen">
                <VBtn color="primary" @click.stop="openPresetsModal = true">{{
                  t("Vulik presets")
                }}</VBtn>
                <VBtn
                  color="primary"
                  @click.stop="fillFromHost"
                  :disabled="!initialValues.hostIp"
                >
                  {{ t("Take from megapolis") }}
                </VBtn>
              </div>
            </div>
            <div
              class="settings-content"
              :class="{ 'settings-content-open': isVulikSettingsOpen }"
            >
              <div class="field" v-for="field in vulikFields" :key="field.name">
                <VTextField
                  variant="outlined"
                  :name="field.name"
                  :label="field.label"
                  :modelValue="field.value"
                  :rules="field.rules"
                  @update:modelValue="field.onChange"
                />
              </div>
            </div>
          </div>

          <!-- Initiator server settings group -->
          <div class="settings-group" v-if="isInitiatorEnabled">
            <div class="settings-group-header" @click="toggleInitiatorSettings">
              <div class="header-left">
                <VIcon>{{
                  isInitiatorSettingsOpen
                    ? "mdi-chevron-down"
                    : "mdi-chevron-right"
                }}</VIcon>
                <h3>{{ t("Initiator server settings") }}</h3>
              </div>
            </div>
            <div
              class="settings-content"
              :class="{ 'settings-content-open': isInitiatorSettingsOpen }"
            >
              <div
                class="field"
                v-for="field in initiatorFields"
                :key="field.name"
              >
                <VTextField
                  variant="outlined"
                  :name="field.name"
                  :label="field.label"
                  :modelValue="field.value"
                  :rules="field.rules"
                  :type="field.type"
                  @update:modelValue="field.onChange"
                />
              </div>
            </div>
          </div>

          <!-- Advanced fields -->
          <div v-if="isDevMode" class="advanced-fields">
            <div
              class="field"
              v-for="field in advancedFields"
              :key="field.name"
            >
              <VTextField
                 variant="outlined"
                :name="field.name"
                :label="field.label"
                :disabled="field.disabled"
                :modelValue="field.value"
                :rules="field.rules"
                @update:modelValue="field.onChange"
              />
            </div>
          </div>
        </VCardText>

        <VCardActions>
          <VBtn color="decline" @click="emit('close')">{{ t("Cancel") }}</VBtn>
          <VBtn color="save" type="submit">{{ t("Save") }}</VBtn>
        </VCardActions>
      </VCard>
    </VForm>

    <OwnIpSearchModal
      :open="openOwnIpSearchModal"
      @save="ownIpSaveHandle"
      :isAdvanced="isDevMode"
    />

    <HostSearchModal :open="openHostSearchModal" @save="hostIpSaveHandle" />

    <VulikPresetsModal
      :open="openPresetsModal"
      @save="presetsHandler"
      @close="openPresetsModal = false"
      v-if="isVulikEnabled"
    />
  </VDialog>
</template>

<script lang="ts" setup>
import { useT } from "@/hooks/use-t";
import { useAppSeetingsStore, type ConnectionSetting } from "@/store";
import { validatorIp } from "@/utils";
import { computed, ref, watch } from "vue";
import { FEATURES } from "@/constants/features";
import { getAllowedFeatures } from "@/utils";
import {
  VBtn,
  VCard,
  VCardText,
  VCardTitle,
  VCardActions,
  VDialog,
  VForm,
  VTextField,
  VIcon,
} from "vuetify/components";
import OwnIpSearchModal from "../molecules/OwnIpSearchModal.vue";
import HostSearchModal from "../molecules/HostSearchModal.vue";
import VulikPresetsModal from "./VulikPresetsModal.vue";

interface Field {
  name: string;
  label: string;
  value: string | number;
  rules: ((v: any) => string | true)[];
  onChange: (value: string) => void;
  disabled?: boolean;
  hasAuto?: boolean;
  autoHandler?: () => void;
  type?: string;
}

const getFieldValue = (value: string | number | undefined): string | number => {
  return value ?? "";
};

type Props = {
  open: boolean;
  connection?: ConnectionSetting;
};

type Emits = {
  (e: "save", value: ConnectionSetting): void;
  (e: "close"): void;
};

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const isEditMode = computed(() => !!props.connection);

const isValid = ref<boolean>(false);
const openOwnIpSearchModal = ref<boolean>(false);
const openHostSearchModal = ref<boolean>(false);
const openPresetsModal = ref<boolean>(false);
const appStore = useAppSeetingsStore();
const isDevMode = computed(() => Boolean(appStore.isDevMode));
const isVulikSettingsOpen = ref(false);
const isInitiatorSettingsOpen = ref(false);
const t = useT();

const allowedFeatures = getAllowedFeatures();
const isVulikEnabled = computed(() =>
  allowedFeatures.includes(FEATURES.VULIK_CONTROLL)
);
const isInitiatorEnabled = computed(() =>
  allowedFeatures.includes(FEATURES.REMOTE_CONTROLL)
);

const toggleVulikSettings = () => {
  if (!isVulikEnabled.value) return;
  isVulikSettingsOpen.value = !isVulikSettingsOpen.value;
};

const toggleInitiatorSettings = () => {
  if (!isInitiatorEnabled.value) return;
  isInitiatorSettingsOpen.value = !isInitiatorSettingsOpen.value;
};

const defaultValues: ConnectionSetting = {
  hostIp: "",
  operatorIp: "",
  mainServerPort: 3003,
  relayServerPort: 8000,
  rpanionServerPort: 3000,
  port: 27015,
  secondPort: 27016,
  name: "",
  vulikHost: "localhost",
  vulikPort: 27017,
  initiatorServerEndpoint: "",
  initiatorServerToken: "",
};

const initialValues = ref<ConnectionSetting>({ ...defaultValues });

const resetForm = () => {
  if (props.connection) {
    initialValues.value = { ...props.connection };
  } else {
    initialValues.value = { ...defaultValues };
  }
};

const changeHandle = (name: string, type?: string) => (value: string) => {
  initialValues.value = {
    ...initialValues.value,
    [name]: type === "number" ? Number(value.trim()) : value.trim(),
  };
};

const ownIpSaveHandle = (value: string | null) => {
  openOwnIpSearchModal.value = false;

  if (value == null) {
    return;
  }
  initialValues.value = {
    ...initialValues.value,
    operatorIp: value,
  };
};

const hostIpSaveHandle = (value: string | null) => {
  openHostSearchModal.value = false;

  if (value == null) {
    return;
  }

  initialValues.value = {
    ...initialValues.value,
    hostIp: value,
  };
};

const saveHandle = () => {
  if (!isValid.value) {
    return;
  }

  emit("save", {
    ...initialValues.value,
    id: props.connection?.id,
  });
};

const basicFields = computed((): Field[] => [
  {
    name: "name",
    label: t("Name"),
    rules: [(v: string) => !!v || t("Name is required")],
    value: getFieldValue(initialValues.value.name),
    onChange: changeHandle("name"),
  },
  {
    name: "hostIp",
    label: t("HostIp"),
    hasAuto: true,
    rules: [(v: string) => !!v || t("HostIp is required"), validatorIp],
    value: getFieldValue(initialValues.value.hostIp),
    onChange: changeHandle("hostIp"),
    autoHandler: () => (openHostSearchModal.value = true),
  },
  {
    name: "operatorIp",
    label: t("OperatorIp"),
    hasAuto: true,
    rules: [(v: string) => !!v || t("OperatorIp is required"), validatorIp],
    value: getFieldValue(initialValues.value.operatorIp),
    onChange: changeHandle("operatorIp"),
    autoHandler: () => (openOwnIpSearchModal.value = true),
  },
]);

const vulikFields = computed((): Field[] => [
  {
    name: "vulikHost",
    label: t("VulikHost"),
    value: getFieldValue(initialValues.value.vulikHost),
    rules: [(v: string) => !!v || t("VulikHost is required")],
    onChange: changeHandle("vulikHost"),
  },
  {
    name: "vulikPort",
    label: t("VulikPort"),
    value: getFieldValue(initialValues.value.vulikPort),
    rules: [(v: number) => !!v || t("VulikPort is required")],
    onChange: changeHandle("vulikPort", "number"),
  },
]);

const initiatorFields = computed((): Field[] => [
  {
    name: "initiatorServerEndpoint",
    label: t("Endpoint"),
    value: getFieldValue(initialValues.value.initiatorServerEndpoint),
    rules: [], // Optional field
    onChange: changeHandle("initiatorServerEndpoint"),
  },
  {
    name: "initiatorServerToken",
    label: t("Access token"),
    value: getFieldValue(initialValues.value.initiatorServerToken),
    rules: [
      (v: string) => {
        // Only required if endpoint is provided
        if (initialValues.value.initiatorServerEndpoint && !v) {
          return t("Access token is required when endpoint is provided");
        }
        return true;
      },
    ],
    onChange: changeHandle("initiatorServerToken"),
    type: "password",
  },
]);

const advancedFields = computed((): Field[] => [
  {
    name: "port",
    label: t("Port"),
    disabled: !isDevMode.value || false,
    rules: [(v: number) => !!v || t("Port is required")],
    value: getFieldValue(initialValues.value.port),
    onChange: changeHandle("port", "number"),
  },
  {
    name: "secondPort",
    label: t("SecondJrPort"),
    disabled: !isDevMode.value || false,
    rules: [(v: number) => !!v || t("SecondJrPort is required")],
    value: getFieldValue(initialValues.value.secondPort),
    onChange: changeHandle("secondPort", "number"),
  },
  {
    name: "mainServerPort",
    label: t("MainServerPort"),
    disabled: !isDevMode.value || false,
    rules: [(v: number) => !!v || t("MainServerPort is required")],
    value: getFieldValue(initialValues.value.mainServerPort),
    onChange: changeHandle("mainServerPort", "number"),
  },
  {
    name: "rpanionServerPort",
    label: t("RpanionServerPort"),
    disabled: !isDevMode.value || false,
    value: getFieldValue(initialValues.value.rpanionServerPort),
    rules: [(v: number) => !!v || t("RpanionServerPort is required")],
    onChange: changeHandle("rpanionServerPort", "number"),
  },
  {
    name: "relayServerPort",
    label: t("RelayServerPort"),
    disabled: !isDevMode.value || false,
    value: getFieldValue(initialValues.value.relayServerPort),
    rules: [(v: number) => !!v || t("RelayServerPort is required")],
    onChange: changeHandle("relayServerPort", "number"),
  },
]);

const fillFromHost = () => {
  initialValues.value = {
    ...initialValues.value,
    vulikHost: initialValues.value.hostIp,
    vulikPort: 3003,
  };
};

const presetsHandler = (host: string, port: number) => {
  initialValues.value = {
    ...initialValues.value,
    vulikHost: host,
    vulikPort: port,
  };
  openPresetsModal.value = false;
};

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return;
    }
    resetForm();
  }
);

watch(
  () => props.connection,
  () => {
    if (props.open) {
      resetForm();
    }
  }
);
</script>

<style scoped>
.field {
  display: flex;
}

.auto-button {
  margin: 10px;
}

.settings-group {
  margin: 20px 0;
  padding: 15px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.settings-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  padding: 8px 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-group-header h3 {
  margin: 0;
}

.settings-actions {
  display: flex;
  gap: 10px;
}

.settings-content {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  padding: 0;
  transition: all 0.3s ease-in-out;
}

.settings-content-open {
  max-height: 300px;
  padding: 16px 0 0 0;
  opacity: 1;
}

.advanced-fields {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
