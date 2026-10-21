import type { Skill } from '@/stores/skillStore'

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'skill'
}

// 技能定義依 RD 給的六段依序組出：技能描述／步驟／例外或特殊情況／固定輸出格式／
// 適用範圍／覆蓋能力，沒有的段落直接不出現（不是留白的固定區塊）。技能指令、使用情境
// 不在 RD 定義裡，不放進來。抽屜裡的「技能定義」直接 render 這段 markdown，
// 跟完整 skill.md 共用同一份組法
export function buildSkillDefinitionMarkdown(skill: Skill): string {
  const sections: string[] = []
  const add = (heading: string, body: string) => sections.push(`## ${heading}\n\n${body}`)

  if (skill.description) add('技能描述', skill.description)
  if (skill.steps?.length) add('步驟', skill.steps.map((step, i) => `${i + 1}. ${step}`).join('\n'))
  if (skill.exceptions?.length) add('例外或特殊情況', skill.exceptions.map(ex => `- ${ex}`).join('\n'))
  if (skill.outputFormat) add('固定輸出格式', skill.outputFormat)
  if (skill.applicableScope) add('適用範圍', skill.applicableScope)
  if (skill.capabilities?.length) add('覆蓋能力', skill.capabilities.map(tag => `#${tag}`).join(' '))

  return sections.join('\n\n')
}

// 依技能目前的欄位組出完整 skill.md 內容（frontmatter + 技能定義），供審核／管理時查看實際會發佈的技能定義
export function buildSkillMarkdown(skill: Skill): string {
  const lines: string[] = []

  lines.push('---')
  lines.push(`name: ${slugify(skill.name)}`)
  lines.push(`description: ${skill.description}`)
  lines.push('---')
  lines.push('')
  lines.push(`# ${skill.name}`)

  const body = buildSkillDefinitionMarkdown(skill)
  if (body) {
    lines.push('')
    lines.push(body)
  }

  return `${lines.join('\n').trim()}\n`
}
