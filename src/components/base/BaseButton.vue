<script setup lang="ts">
withDefaults(
    defineProps<{
        variant?: "default" | "primary" | "gold" | "danger";
        size?: "md" | "sm";
        type?: "button" | "submit" | "reset";
    }>(),
    { variant: "default", size: "md", type: "button" }
);
</script>

<template>
    <button :type="type" class="btn" :class="[variant !== 'default' && `btn-${variant}`, { 'btn--sm': size === 'sm' }]">
        <slot />
    </button>
</template>
