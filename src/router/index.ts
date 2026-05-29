import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/script'
    },
    {
      path: '/script',
      name: 'script',
      component: () => import('@/views/ScriptView.vue')
    },
    {
      path: '/storyboard',
      name: 'storyboard',
      component: () => import('@/views/StoryboardView.vue')
    },
    {
      path: '/edit/:shotId',
      name: 'shot-edit',
      component: () => import('@/views/ShotEditView.vue'),
      props: true
    }
  ]
})

export default router
