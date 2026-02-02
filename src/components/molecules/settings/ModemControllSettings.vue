<template>
  <VExpansionPanels class="container">
    <VExpansionPanel>
      <!-- Expansion Panel Header -->
      <VExpansionPanelTitle>
        <div class="header-content">
          <span class="header-title">{{ t("Modem settings") }}</span>
          <!-- Optional: You can add a status chip here if needed -->
          <!-- <v-chip v-if="!data.enabled" color="warning" dense text class="status-chip">
            {{ t("Disabled") }}
          </v-chip> -->
        </div>
      </VExpansionPanelTitle>
      <VExpansionPanelText>
        <!-- Section 1: Control Buttons -->
        <VRow class="buttons-row" dense>
          <!-- Conditionally show timer-related buttons if a timer exists -->
          <VCol v-if="computedData.timer != null" cols="6">
            <VBtn
                @click="executeAction('start-timer')"
                :loading="actionLoading"
                class="modem-btn"
                block
                color="primary"
            >
              {{ t("Start timer") }}
            </VBtn>
          </VCol>
          <VCol v-if="computedData.timer != null" cols="6">
            <VBtn
                @click="executeAction('stop-timer')"
                :loading="actionLoading"
                class="modem-btn"
                block
                color="primary"
            >
              {{ t("Stop timer") }}
            </VBtn>
          </VCol>
          <VCol cols="6">
            <VBtn
                @click="executeAction('enable-modem')"
                :loading="actionLoading"
                class="modem-btn"
                block
                color="warning"
            >
              {{ t("Pernamentry enable modem") }}
            </VBtn>
          </VCol>
          <VCol cols="6">
            <VBtn
                @click="executeAction('disable-modem')"
                :loading="actionLoading"
                class="modem-btn"
                block
                color="warning"
            >
              {{ t("Pernamentry disable modem") }}
            </VBtn>
          </VCol>
        </VRow>

        <!-- Section 2: Switches -->
        <VRow class="switches-row" dense>
          <VCol cols="6">
            <VSwitch
                inset
                :label="timerText"
                :model-value="computedData.activeteTime != null"
                color="primary"
                :loading="isPending"
                hide-details
                @update:modelValue="() => null"
                block
            />
          </VCol>
          <VCol cols="6">
            <VSwitch
                inset
                :label="modemText"
                :model-value="computedData.enabled"
                color="primary"
                :loading="isPending"
                hide-details
                @update:modelValue="() => null"
                block
            />
          </VCol>
        </VRow>

        <!-- Section 3: Timer Input & Apply Button -->
        <VRow class="input-row" dense align="center">
          <VCol cols="8">
            <v-text-field
                variant="outlined"
                name="timer"
                type="number"
                min="0"
                :label="t('Timer Seconds')"
                :loading="actionLoading"
                v-model="initalValues.timer"
                hide-details
                outlined
            />
          </VCol>
          <VCol cols="4">
            <VBtn
                @click="executeAction('set-timer')"
                :loading="actionLoading"
                block
                color="save"
            >
              {{ t("Apply") }}
            </VBtn>
          </VCol>
        </VRow>

        <!-- Section 4: Timer Display -->
        <VRow class="timer-row" dense v-if="computedData.remainigTime != null">
          <VCol cols="12" class="timer-display">
            <span>{{ t("Time remaining") }}: {{ remainigTime }}</span>
          </VCol>
        </VRow>
      </VExpansionPanelText>
    </VExpansionPanel>
  </VExpansionPanels>
</template>

<script lang="ts" setup>
import { useT } from "@/hooks/use-t";
import { computed, reactive, watch } from "vue";
import { VBtn, VSwitch, VTextField } from "vuetify/components";
import { 
  useModemState, 
  useSetModemTimer, 
  useStartModemTimer, 
  useStopModemTimer, 
  useEnableModem, 
  useDisableModem 
} from "@/hooks/use-hardware-api";

const t = useT();

const { data, isPending, refetch } = useModemState();

// Compute remaining time from modem state
const computedData = computed(() => {
  if (!data.value) return {
    timer: null,
    activeteTime: null,
    enabled: false,
    remainigTime: null,
  };

  const activateTimestamp = data.value.activeteTime;
  const currentTimestamp = new Date().getTime();
  if (!activateTimestamp) {
    return { ...data.value, remainigTime: null };
  }

  const remainig = activateTimestamp - currentTimestamp;
  const value = Math.round(remainig / 1e3);

  return {
    ...data.value,
    remainigTime: value < 0 ? 0 : value,
  };
});

const { mutate: setTimer, isPending: setTimerLoading } = useSetModemTimer();
const { mutate: startTimer, isPending: startTimerLoading } = useStartModemTimer();
const { mutate: stopTimer, isPending: stopTimerLoading } = useStopModemTimer();
const { mutate: enableModem, isPending: enableModemLoading } = useEnableModem();
const { mutate: disableModem, isPending: disableModemLoading } = useDisableModem();

const actionLoading = computed(() => 
  setTimerLoading.value || startTimerLoading.value || stopTimerLoading.value || 
  enableModemLoading.value || disableModemLoading.value
);

const executeAction = (action: string) => {
  switch (action) {
    case "set-timer":
      setTimer(initalValues.timer || 0);
      break;
    case "start-timer":
      startTimer();
      break;
    case "stop-timer":
      stopTimer();
      break;
    case "enable-modem":
      enableModem();
      break;
    case "disable-modem":
      disableModem();
      break;
  }
};

const initalValues = reactive({
  timer: computedData.value?.timer || null,
});

const timerText = computed(() => {
  return computedData.value.activeteTime == null
    ? t("Timer not running")
    : t("Timer running");
});

const modemText = computed(() => {
  return computedData.value.enabled ? t("Modem enabled") : t("Modem disabled");
});

const remainigTime = computed(() => {
  //@ts-ignore
  const date = new Date(null);
  date.setSeconds(computedData.value.remainigTime || 0); // specify value for SECONDS here
  return date.toISOString().slice(11, 19);
});

watch(computedData, () => {
  initalValues.timer = computedData.value?.timer || null;
});
</script>

<style scoped>

/* Consistent Header Styling */
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

/* Section 1: Buttons Grid */
.buttons-row {
  margin-bottom: 16px;
}
.buttons-row > .v-col {
  padding: 8px;
}
.controls-group {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.modem-btn {
  width: 100%;
}

/* Section 2: Switches */
.switches-row {
  margin-bottom: 16px;
}
.switches-row > .v-col {
  padding: 8px;
}

/* Section 3: Timer Input */
.input-row {
  margin-top: 16px;
}
.input-row > .v-col {
  padding: 8px;
}

/* Section 4: Timer Display */
.timer-row {
  margin-top: 16px;
}
.timer-display {
  text-align: center;
  font-weight: 500;
  color: #12004a;
}

.v-expansion-panel-title {
  height: 64px;
}
</style>