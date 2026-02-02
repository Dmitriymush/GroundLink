<script setup lang="ts">
</script>

<template>
  <v-container class="container">
    <div class="actions">
      <slot name="actions"></slot>
    </div>


    <div class="menu">
      <slot name="menu"></slot>
    </div>
  </v-container>
</template>


<style scoped>
.container {
  display: flex;
  justify-content: space-between;
}

.actions {
  display: flex;
  flex-direction: column;
  width: 30%;
  padding: 10px;
  max-width: 300px;
}

.menu {
  display: flex;
  flex-direction: column;
  width: 70%;
  padding: 10px;
}
</style>