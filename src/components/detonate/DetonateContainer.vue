<template>
  <div class="container">
    <slot class="actions-container" name="default">

    </slot>

    <div class="main-action" >
      <slot name="mainAction">

      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
}

.actions-container {
  display: flex;
}

.main-action {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-top: 20px;
}
</style>