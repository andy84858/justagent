import type { Skill, SkillRdFields } from '@/stores/skillStore'

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'skill'
}

const section = (heading: string, body: string) => `## ${heading}\n\n${body}`

// 技能內文：RD 的步驟／例外或特殊情況／固定輸出格式／適用範圍四段。手動建立精靈的
// 「技能內文」就是這四項，存檔時用這裡組出 instructions；技能定義也用同一份組法
export function buildSkillContentMarkdown(fields: SkillRdFields): string {
  const sections: string[] = []
  if (fields.steps?.length) sections.push(section('步驟', fields.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')))
  if (fields.exceptions?.length) sections.push(section('例外或特殊情況', fields.exceptions.map(ex => `- ${ex}`).join('\n')))
  if (fields.outputFormat) sections.push(section('固定輸出格式', fields.outputFormat))
  if (fields.applicableScope) sections.push(section('適用範圍', fields.applicableScope))
  return sections.join('\n\n')
}

// buildSkillContentMarkdown 的反向：手動建立精靈只給一個技能內文輸入框（格式用 placeholder
// 示範），存檔時從標題拆出四項。標題寬鬆比對（# 數不限、可帶冒號、「例外」「輸出格式」簡稱
// 也算）；完全沒有標題時，把編號／條列的行當成步驟，至少不會整份內文都拆不出東西
const CONTENT_HEADINGS: [RegExp, keyof SkillRdFields][] = [
  [/^步驟$/, 'steps'],
  [/^(例外(或特殊情況)?|特殊情況)$/, 'exceptions'],
  [/^(固定)?輸出格式$/, 'outputFormat'],
  [/^適用範圍$/, 'applicableScope'],
]
const HEADING_LINE = /^#{1,6}\s*(.+?)\s*[：:]?\s*$/
const LIST_MARKER = /^\s*(\d+\s*[.、)）]|[-*•])\s*/

export function parseSkillContentMarkdown(text: string): Required<SkillRdFields> {
  const buckets: Record<keyof SkillRdFields, string[]> = { steps: [], exceptions: [], outputFormat: [], applicableScope: [] }
  let current: keyof SkillRdFields | null = null
  let sawHeading = false
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const heading = line.match(HEADING_LINE)?.[1]
    if (heading) {
      current = CONTENT_HEADINGS.find(([re]) => re.test(heading))?.[1] ?? null
      sawHeading = true
      continue
    }
    if (current) buckets[current].push(line)
    else if (!sawHeading && LIST_MARKER.test(line)) buckets.steps.push(line)
  }
  const items = (lines: string[]) => lines.map(l => l.replace(LIST_MARKER, '').trim()).filter(Boolean)
  return {
    steps: items(buckets.steps),
    exceptions: items(buckets.exceptions),
    outputFormat: buckets.outputFormat.join('\n'),
    applicableScope: buckets.applicableScope.join('\n'),
  }
}

// 技能定義依 RD 給的六段依序組出：技能描述＋技能內文四段＋覆蓋能力，沒有的段落直接
// 不出現（不是留白的固定區塊）。抽屜裡的「技能定義」直接 render 這段 markdown，
// 跟完整 skill.md 共用同一份組法
export function buildSkillDefinitionMarkdown(skill: Skill): string {
  const sections: string[] = []
  if (skill.description) sections.push(section('技能描述', skill.description))
  const content = buildSkillContentMarkdown(skill)
  if (content) sections.push(content)
  if (skill.capabilities?.length) sections.push(section('覆蓋能力', skill.capabilities.map(tag => `#${tag}`).join(' ')))
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
