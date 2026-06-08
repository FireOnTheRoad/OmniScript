import { createRouter, createWebHashHistory } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'

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
    },
    {
      path: '/video',
      name: 'video',
      component: () => import('@/views/VideoProjectView.vue')
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const store = useProjectStore()

  if (!store.hasOpenProject) {
    if (to.name !== 'script') return next({ name: 'script' })
    return next()
  }

  if (store.isVideoProject && (to.name === 'storyboard' || to.name === 'shot-edit')) {
    return next({ name: 'video' })
  }

  if (store.isScriptProject && to.name === 'video') {
    return next({ name: 'script' })
  }

  next()
})

export default router
