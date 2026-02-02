<script lang="ts" setup>
import { useT } from "@/hooks/use-t";
import { useIntervalFn, useStorage, useSessionStorage } from "@vueuse/core";
import { ref, watch } from "vue";
import { useChangeRelayState } from "@/hooks/use-hardware-api";
import {
  VCardActions,
  VCardText,
  VCardTitle,
  VProgressLinear,
} from "vuetify/lib/components/index";

type Vulic = {
  item: number;
  active: boolean;
};

const t = useT();
const model = ref<number>(0);

const vulicts = useSessionStorage<Vulic[]>("vulic", [
  {
    item: 1,
    active: false,
  },
  {
    item: 2,
    active: false,
  },
]);

const videoState = useSessionStorage<boolean>("vulic-video-state", false);
const reserveState = useStorage<boolean>("vulic-reserve-state", false);
const host = useStorage<string>("host", "localhost");
const port = useStorage<number>("port", 8000);

const { mutate: changeRelayState, isPending } = useChangeRelayState(host.value, port.value);

const openVulic = async (): Promise<void> => {
  for (const vulic of vulicts.value) {
    changeRelayState({ relay: vulic.item, state: vulic.active });
  }
  changeRelayState({ relay: 3, state: videoState.value });
  changeRelayState({ relay: 4, state: reserveState.value });
};

watch([host, port], () => {
  // Update the hook with new host/port
});

watch(reserveState, () => openVulic());
watch(videoState, () => openVulic());

useIntervalFn(openVulic, 60e3);

const changeVulicState = (item: Number, state: boolean) => {
  vulicts.value = vulicts.value.map((vulic) => {
    if (vulic.item === item) {
      vulic.active = state;
    }

    return vulic;
  });

  openVulic();
};

const clickVulic = (vulic: Vulic) => {
  if (!vulic.active) {
    model.value = vulic.item;
  } else {
    vulic.active = false;
    openVulic();
  }
};
</script>

<template>
  <VContainer>
    <VCard class="settings-card" elevation="3">
      <VCardTitle class="text-h5 font-weight-medium">
        {{ t("Settings") }}
      </VCardTitle>

      <VCardText>
        <!-- Вулики кнопки -->
        <VRow dense>
          <VCol
              v-for="vulic in vulicts"
              :key="vulic.item"
              cols="6"
              sm="4"
              md="3"
              class="text-center"
          >
            <div class="vulic-box" @click="clickVulic(vulic)">
              <div class="vulic-label">{{vulic.active ? 'Закрити вулик' : 'Відкрити вулик'}}  №{{ vulic.item }}</div>
              <VIcon
                  :icon="vulic.active ? 'mdi-package-variant' : 'mdi-package-variant-closed'"
                  :color="vulic.active ? 'green' : 'grey'"
                  size="56"
              />
            </div>
          </VCol>
        </VRow>

        <!-- Divider -->
        <VDivider class="my-4" />

        <!-- Антенна & Резерв -->
        <VRow dense>
          <VCol cols="12" sm="6">
            <div class="status-row">
              <VIcon
                  :icon="videoState ? 'mdi-power' : 'mdi-power-off'"
                  :color="videoState ? 'green' : 'red'"
                  class="status-icon"
                  @click="videoState = !videoState"
              />
              <span class="status-label">
          Антенна: {{ videoState ? 'Увімкненна' : 'Вимкненна' }}
        </span>
            </div>
          </VCol>

          <VCol cols="12" sm="6">
            <div class="status-row">
              <VIcon
                  :icon="reserveState ? 'mdi-battery' : 'mdi-battery-off'"
                  :color="reserveState ? 'green' : 'red'"
                  class="status-icon"
                  @click="reserveState = !reserveState"
              />
              <span class="status-label">
          Резерв: {{ reserveState ? 'Увімкненний' : 'Вимкненний' }}
        </span>
            </div>
          </VCol>
        </VRow>
      </VCardText>

      <VCardActions>
        <VProgressLinear v-if="isPending" indeterminate />
      </VCardActions>
      <VCardActions>
        <VProgressLinear
            v-if="isPending"
            indeterminate
            color="primary"
            height="6"
        />
      </VCardActions>
    </VCard>

    <VDialog :modelValue="model > 0" persistent>
      <VCard>
        <VCardTitle
          >Ви точно хочете відкрити вулик номер {{ model }}</VCardTitle
        >
        <VCardText>
          <VBtn
            class="btn"
            color="decline"
            @click="
              changeVulicState(model, true);
              model = 0;
            ">Так</VBtn>
          <VBtn
              class="btn"
              color="save"
              @click="
                changeVulicState(model, false);
                model = 0;
              ">Ні</VBtn>
        </VCardText>
      </VCard>
    </VDialog>
  </VContainer>
</template>

<style scoped>
.settings-card {
  padding: 24px;
  border-radius: 12px;
}

.styled-btn {
  font-weight: 500;
  padding: 14px;
  font-size: 16px;
  border-radius: 10px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  text-transform: none;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 10px 0;
  font-size: 16px;
  font-weight: 500;
}

.status-icon {
  font-size: 32px;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.status-icon:hover {
  transform: scale(1.1);
}

.status-label {
  user-select: none;
}

.v-row {
  justify-content: space-around;
}

.vulic-box {
  cursor: pointer;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid lightgray;
  transition: all 0.2s ease;
}

.vulic-box:hover {
  background-color: rgba(0, 0, 0, 0.05);
  transform: scale(1.05);
}

.vulic-label {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 16px;
}
</style>
