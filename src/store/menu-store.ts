import { defineStore } from "pinia";
import { ref } from "vue";

export const useMenuStore = defineStore("menu", () => {
  const isCollapsed = ref(window.innerWidth < 1000);
  const isManualCollapse = ref(false);

  const toggleMenu = () => {
    isManualCollapse.value = !isManualCollapse.value;
    isCollapsed.value = isManualCollapse.value;
  };

  const handleResize = () => {
    if (!isManualCollapse.value) {
      isCollapsed.value = window.innerWidth < 1000;
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("resize", handleResize);
  }

  return {
    isCollapsed,
    isManualCollapse,
    toggleMenu,
  };
});
