// 手動建立技能時，「技能描述」不由使用者填寫，改由 Agent 依使用者填的內容生成。
// 規則式串接（名稱／適用範圍／前幾個步驟／輸出格式），不是真的語意生成，
// 跟 useSkillStudioConversation 的模擬 AI 回覆同一種風格
export interface SkillDescriptionSource {
  name: string
  steps: string[]
  applicableScope?: string
  outputFormat?: string
}

const MAX_STEPS = 3

export function generateSkillDescription(src: SkillDescriptionSource): string {
  const steps = src.steps.map(st => st.trim()).filter(Boolean)
  const scope = src.applicableScope?.trim()
  const format = src.outputFormat?.trim()

  // 沒有步驟就沒東西可以描述「做什麼」，退回技能名稱本身
  if (!steps.length) return src.name.trim()

  const shown = steps.slice(0, MAX_STEPS).join('、')
  const doing = steps.length > MAX_STEPS ? `${shown}等` : shown
  const lead = scope ? `針對${scope}，` : ''
  const tail = format ? `，並以「${format}」輸出結果` : ''
  return `${lead}${doing}${tail}`
}
