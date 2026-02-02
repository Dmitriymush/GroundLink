<template>
  <VForm v-model="isValid" @submit.prevent="saveHandler" class="jr-form">
    <VRow class="jr-fields" justify="center">
      <VCol cols="12" sm="6">
        <VSelect
            variant="outlined"
            class="field"
            :items="baudRates"
            label="Baud Rate"
            :model-value="initalValues.baudRate"
            disabled
        />
      </VCol>
      <VCol cols="12" sm="6">
        <VSelect
            variant="outlined"
            class="field"
            :items="refreshRate"
            label="Refresh Rate"
            v-model="initalValues.refreshRate"
        />
      </VCol>
    </VRow>
    <div class="jr-btn-container">
      <VBtn color="save" type="submit" class="jr-submit-btn">
        {{ t("Save") }}
      </VBtn>
    </div>
  </VForm>
</template>

<script setup lang="ts">
import { useT } from "@/hooks/use-t";
import type { JRSettings } from "@/store";
import { ref, watch } from "vue";
import { VBtn, VSelect, VForm, VRow, VCol } from "vuetify/components";

type InitalValues = {
  baudRate?: number;
  refreshRate?: number;
};

type Props = {
  initalValues?: InitalValues;
};

type Emits = {
  (e: "save", v: JRSettings): boolean;
};

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const baudRates = [115200, 400000];
const refreshRate = [10, 25, 50, 100, 150, 200];

const isValid = ref<boolean>(false);
const t = useT();
const initalValues = ref<InitalValues>({
  baudRate: props?.initalValues?.baudRate || 115200,
  refreshRate: props?.initalValues?.refreshRate || 25,
});

watch(
    () => props.initalValues,
    (values) => {
      initalValues.value = {
        baudRate: values?.baudRate || 115200,
        refreshRate: values?.refreshRate || 25,
      };
    }
);

const saveHandler = () => {
  emit("save", {
    baudRate: initalValues.value.baudRate || 115200,
    refreshRate: initalValues.value.refreshRate || 25,
  });
};
</script>

<style scoped>
.jr-form {
  padding: 16px;
}
.jr-fields {
  margin-bottom: 16px;
}
.jr-btn-container {
  text-align: center;
}
.jr-submit-btn {
  background-color: #ff0000;
  color: #ffffff;
  padding: 12px 24px;
  font-size: 18px;
  height: 50px;
}
.field {
  margin-bottom: 10px;
}
</style>