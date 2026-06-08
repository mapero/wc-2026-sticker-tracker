<script setup lang="ts">
withDefaults(defineProps<{ variant?: "default" | "need" | "done" | "swap" }>(), { variant: "default" });
</script>

<template>
    <span class="chip" :class="variant !== 'default' && `chip--${variant}`"><slot /></span>
</template>
