import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useRootStore } from '@/stores/rootStore'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    parentName?: string
    // 麵包屑的非連結上層標籤（例如 side-menu 的群組名稱，本身不是可導覽的頁面），
    // 跟 parentName（會連到實際路由）不同，純粹補一層文字
    parentLabel?: string
    useCompanyName?: boolean
    hideMenuTree?: boolean
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
  },
  {
    path: '/entrance', // 移到這邊
    name: 'AppEntrance',
    component: () => import('../views/AppEntrance.vue'),
  },
  {
    path: '/view',
    redirect: '/view/ProjectDashboard',
    name: 'Home',
    component: () => import('../container/Full.vue'),
    children: [
      {
        path: '/view/ProjectDashboard',
        name: 'ProjectDashboard',
        component: () => import('@/views/ProjectDashboard.vue'),
        meta: { title: '最近使用' },
      },
      {
        path: '/view/TeamProject',
        name: 'TeamProject',
        component: () => import('@/views/TeamProject.vue'),
        meta: { title: '團隊專案' },
      },
      {
        path: '/view/ResourceLibrary',
        name: 'ResourceLibrary',
        component: () => import('@/views/ResourceLibrary.vue'),
        meta: { title: '共用檔案管理', parentLabel: '共享資源庫' },
      },
      {
        path: '/view/TeamAccessManagement',
        name: 'TeamAccessManagement',
        component: () => import('@/views/TeamAccessManagement.vue'),
        meta: { title: '權限管理' },
      },
      {
        path: '/view/AiViewer',
        name: 'AiViewer',
        component: () => import('@/views/AiViewer.vue'),
        meta: { hideMenuTree: true },
      },
      {
        path: '/view/journeys',
        name: 'JourneyDashboard',
        component: () => import('@/views/JourneyDashboard.vue'),
        meta: { hideMenuTree: true },
      },
      {
        path: '/view/CompanyTeamSettings',
        name: 'CompanyTeamSettings',
        component: () => import('@/views/CompanyTeamSettings.vue'),
        meta: { title: '企業設定', useCompanyName: true },
      },
      {
        path: '/view/GUI',
        name: 'GUI',
        component: () => import('@/views/GUI.vue'),
      },
      {
        path: '/view/ProjectTrashCans',
        name: 'ProjectTrashCans',
        component: () => import('@/views/ProjectTrashCans.vue'),
        meta: { title: '專案垃圾桶' },
      },
      {
        path: '/view/KnowledgeBase',
        name: 'KnowledgeBase',
        component: () => import('@/views/KnowledgeBase.vue'),
        meta: { title: '知識庫管理' },
      },
      {
        path: '/view/KnowledgeDetail/:id',
        name: 'KnowledgeDetail',
        component: () => import('@/views/KnowledgeDetail.vue'),
        props: true,
        meta: { title: '知識庫', parentName: 'KnowledgeBase' },
      },
      {
        path: '/view/KnowledgeEditor/:knowledgeId/:versionId',
        name: 'KnowledgeEditor',
        component: () => import('@/views/KnowledgeEditor.vue'),
        props: true,
        meta: { title: '編輯器', parentName: 'KnowledgeBase' },
      },
      {
        path: '/view/Explore',
        name: 'Explore',
        component: () => import('@/views/Explore.vue'),
        meta: { title: '探索' },
      },
      {
        path: '/view/Skills',
        name: 'SkillManagement',
        component: () => import('@/views/SkillManagement.vue'),
        meta: { title: '技能管理', parentLabel: 'AI 技能' },
      },
      {
        path: '/view/SkillTest',
        name: 'SkillTest',
        component: () => import('@/views/SkillTestVersions.vue'),
        meta: { title: '技能測試沙盒', parentName: 'SkillManagement' },
      },
      {
        path: '/view/SkillEditor',
        name: 'SkillEditor',
        component: () => import('@/views/SkillEditor.vue'),
        meta: { title: '建立技能', parentName: 'SkillManagement' },
      },
      {
        // AI 賦能已經整併進技能管理頁的抽屜（SkillStudioDrawer），不再是獨立頁面；
        // 保留這條重定向讓舊書籤/分享連結（含 skillId/method/from query）還能用
        path: '/view/SkillStudio',
        redirect: (to) => ({ path: '/view/Skills', query: to.query }),
      },
    ]
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to, from, next) => {
  // TODO... 之後還要處理登入驗證的邏輯 (可參考中台, 因為也是走Ｂ端身份識別中心)

  const rootStore = useRootStore()
  rootStore.isEnterAppSearchPage = false
  rootStore.appSearchKeyword = ''

  next();
})

export default router
