<script setup lang="ts">
import { ref, watch } from "vue";
import { useMutation } from "@tanstack/vue-query";
import { useT } from "@/hooks/use-t";
import { getIpAddress, type Adapter } from "@/controllers/network-devices";
import {
  VDialog,
  VCard,
  VCardTitle,
  VCardText,
  VCardActions,
  VBtn,
  VList,
  VListItem,
  VListItemTitle,
  VAlert,
} from "vuetify/components";

type Props = {
  open: boolean;
  isAdvanced: boolean;
};

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "save", v: string | null): any;
}>();

const t = useT();
const ipAdaptersList = ref<Adapter[]>([]);

const loadIpAddesses = async () => {
  ipAdaptersList.value = await getIpAddress();

  if (props.isAdvanced === false) {
    return emit("save", ipAdaptersList.value[0].settings.IPv4Address);
  }
};

const { isPending, isError, mutate } = useMutation({
  mutationFn: loadIpAddesses,
});

const clickHandle = () => {
  mutate();
};

watch(
  () => props.open,
  (open) => {
    if (!open) {
      ipAdaptersList.value = [];
    } else {
      clickHandle();
    }
  }
);
</script>

<template>
  <VDialog
    width="500"
    :model-value="open"
    persistent
    @update:model-value="$emit('save', null)"
  >
    <VCard>
      <VCardTitle>
        {{ t("Auto ip search") }}
      </VCardTitle>

      <VCardText>
        <div v-if="isAdvanced">
          <VList density="compact">
            <VListItem
              v-for="adapter in ipAdaptersList"
              :key="adapter.name"
              :value="adapter.settings.IPv4Address"
              color="primary"
              @click="$emit('save', adapter.settings.IPv4Address)"
            >
              <VListItemTitle>
                <div class="ip-list-item">
                  <span>{{ adapter.name }}</span>
                  <span>{{ adapter.settings.IPv4Address }}</span>
                </div>
              </VListItemTitle>
            </VListItem>
          </VList>
        </div>

        <div v-if="isError">
          <VAlert>{{ t("Error, try again") }}</VAlert>
        </div>
      </VCardText>

      <VCardActions>
        <VBtn color="save" @click="clickHandle" :loading="isPending">{{ t("Start") }}</VBtn>
        <VBtn color="decline" @click="$emit('save', null)" :loading="isPending">{{
          t("Cancel")
        }}</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<style scoped>
.ip-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
