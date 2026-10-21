import type { Skill } from '@/stores/skillStore'

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'skill'
}

// 技能指令／覆蓋能力／實際使用情境是同一份 skill.md 依序組出來的三段內容，
// 沒有的段落直接不出現（不是留白的固定區塊）。抽屜裡的「技能定義」直接
// render 這段 markdown，跟完整 skill.md 共用同一份組法
export function buildSkillDefinitionMarkdown(skill: Skill): string {
  const lines: string[] = []

  if (skill.instructions) {
    lines.push(skill.instructions)
  }

  if (skill.capabilities?.length) {
    lines.push('')
    lines.push('## 覆蓋能力')
    lines.push('')
    lines.push(skill.capabilities.map(tag => `#${tag}`).join(' '))
  }

  if (skill.usageScenarios?.length) {
    lines.push('')
    lines.push('## 使用情境')
    lines.push('')
    skill.usageScenarios.forEach((sc, i) => {
      lines.push(`${i + 1}. **${sc.title}** — ${sc.description}`)
    })
  }

  return lines.join('\n').trim()
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
