<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { initMessageApi } from '@/utils/notify'

const message = useMessage()
initMessageApi(
  (content: string) => message.success(content),
  (content: string) => message.error(content),
  (content: string) => message.info(content)
)
</script>

<template>
  <div style="display: none" />
</template>
