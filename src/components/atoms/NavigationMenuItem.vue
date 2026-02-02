<script setup lang="ts">
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useT } from "@/hooks/use-t";

type Props = {
  title: string;
  href: string;
  icon?: string;
};

const t = useT();

const props = defineProps<Props>();
const router = useRouter();
const route = useRoute();

const clickHandle = () => {
  router.push(props.href);
};

const isActive = computed(() => {
  return route.path === props.href;
});

const getDefaultIcon = () => {
  const iconMap: Record<string, string> = {
    [t("Remote controll")]: "mdi-gamepad-variant-outline",
    [t("Detonate")]: "mdi-bomb",
    [t("Antenna controll")]: "mdi-satellite-uplink",
    [t("Bee")]: "mdi-texture-box",
    [t("Second JR")]: "mdi-antenna",
    [t("Bee V2")]: "mdi-treasure-chest",
    [t("Vulic controll")]: "mdi-crane",
    [t("Settings")]: "mdi-cog-outline",
  };
  return iconMap[props.title] || "mdi-menu";
};
</script>

<template>
  <div>
    <v-tooltip :text="title" location="right" open-delay="500">
      <template v-slot:activator="{ props }">
        <v-list-item
          class="list-item"
          link
          :active="isActive"
          :title="title"
          @click="clickHandle"
          v-bind="props"
        >
          <template v-slot:prepend>
            <v-icon :icon="icon || getDefaultIcon()"></v-icon>
          </template>
        </v-list-item>
      </template>
    </v-tooltip>
    <v-divider />
  </div>
</template>

<style scoped>
.list-item {
  text-align: initial;
}

:deep(.v-list-item__content) {
  opacity: 1;
  transition: opacity 0.3s ease;
}

:deep(.menu--collapsed .v-list-item__content) {
  opacity: 0;
}

:deep(.v-list-item__prepend) {
  min-width: 40px;
}
</style>
