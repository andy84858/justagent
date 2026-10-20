/// <reference types="vite/client" />


interface ImportMetaEnv {
  // true 才讓技能對話打後端；沒設就用前端模擬回覆
  readonly VITE_SKILL_AGENT_API?: string
}
