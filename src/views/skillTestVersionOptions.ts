// 技能測試沙盒的版型清單（SkillTestVersions.vue 依這份切換頁面）：1＝原本的單一技能測試（SkillTest.vue），
// 2＝全系統對話＋右側觸發追蹤（SkillSandboxA.vue），3＝全寬對話、追蹤內嵌（SkillSandboxB.vue）
export const SKILL_TEST_VERSIONS = ['1', '2', '3'] as const
export type SkillTestVersion = typeof SKILL_TEST_VERSIONS[number]

export function resolveSkillTestVersion(raw: unknown): SkillTestVersion {
  return SKILL_TEST_VERSIONS.includes(raw as SkillTestVersion) ? (raw as SkillTestVersion) : '1'
}
