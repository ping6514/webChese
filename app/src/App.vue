<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useThemeStore } from './stores/theme'

const theme = useThemeStore()
theme.init()
</script>

<template>
  <RouterView />
</template>
