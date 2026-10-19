<template>
  <Teleport to="body">
    <Transition name="confirm-fade">
      <div v-if="gateSkill" class="drawer-confirm-overlay" @click.self="resolveCancelled">
        <div class="drawer-confirm-dialog enable-gate-dialog">
          <div class="confirm-icon confirm-icon--update">
            <i class="material-symbols-outlined">rule</i>
          </div>
          <h4>還不能啟用「{{ gateSkill.name }}」</h4>
          <p>{{ describeAiTestGateReason() }}</p>
          <div class="confirm-actions confirm-actions--column">
            <button class="custom-btn" @click="resolveGoToTest">
              <i class="material-symbols-outlined">science</i>前往測試
            </button>
            <button class="custom-btn" @click="resolveRevise">
              <i class="material-symbols-outlined">forum</i>去修改技能內容
            </button>
            <button class="custom-btn" @click="resolveCancelled">
              取消
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="confirm-fade">
      <div v-if="agentSkill" class="drawer-confirm-overlay" @click.self="resolveCancelled">
        <div class="drawer-confirm-dialog enable-agent-dialog">
          <div class="confirm-icon confirm-icon--update">
            <i class="material-symbols-outlined">smart_toy</i>
          </div>
          <h4>啟用「{{ agentSkill.name }}」</h4>
          <p>確認哪些 Agent 可以調用這個技能，之後隨時可以再調整。</p>
          <div class="se-agent-grid lively-stagger">
            <button
              v-for="agent in AVAILABLE_AGENTS"
              :key="agent"
              type="button"
              :class="['se-agent-chip', 'lively-card', { 'is-selected': selectedAgents.includes(agent) }]"
              @click="toggleAgent(agent)"
            >
              <i class="material-symbols-outlined">smart_toy</i>
              {{ agent }}
              <i v-if="selectedAgents.includes(agent)" class="material-symbols-outlined se-chip-check">check</i>
            </button>
          </div>
          <div class="confirm-actions confirm-actions--column">
            <button
              class="custom-btn custom-main-btn"
              :disabled="selectedAgents.length === 0"
              @click="resolveConfirmed"
            >
              <i class="material-symbols-outlined">check_circle</i>確認並啟用
            </button>
            <button class="custom-btn" @click="resolveCancelled">
              取消
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// 啟用一顆技能的共用流程：檢查這一版測過沒有（不要求全對） → 確認可調用此技能的 Agent。
// 只負責「問使用者、回傳結果」，不負責實際呼叫 store 把技能存檔或切換狀態——
// 三個呼叫端（SkillManagement/SkillEditor/SkillTestAI）的「啟用」動作形狀不一樣
// （已存在技能直接切換 vs. 表單送出的一部分），拿到結果後各自決定要做什麼。
import { ref } from 'vue'
import { canEnableSkill, describeAiTestGateReason, AVAILABLE_AGENTS } from '@/stores/skillStore'
import type { Skill } from '@/stores/skillStore'

export type EnableFlowOutcome =
  | { type: 'confirmed'; agents: string[] }
  | { type: 'revise' }
  | { type: 'goToTest' }
  | { type: 'cancelled' }

const gateSkill = ref<Skill | null>(null)
const agentSkill = ref<Skill | null>(null)
const selectedAgents = ref<string[]>([])

let resolver: ((outcome: EnableFlowOutcome) => void) | null = null
let pendingExistingAgents: string[] = []

function toggleAgent(agent: string) {
  const idx = selectedAgents.value.indexOf(agent)
  if (idx === -1) selectedAgents.value.push(agent)
  else selectedAgents.value.splice(idx, 1)
}

function enterAgentStep(skill: Skill) {
  gateSkill.value = null
  agentSkill.value = skill
  selectedAgents.value = [...pendingExistingAgents]
}

function resolveRevise() {
  gateSkill.value = null
  resolver?.({ type: 'revise' })
  resolver = null
}

function resolveGoToTest() {
  gateSkill.value = null
  resolver?.({ type: 'goToTest' })
  resolver = null
}

function resolveCancelled() {
  gateSkill.value = null
  agentSkill.value = null
  resolver?.({ type: 'cancelled' })
  resolver = null
}

function resolveConfirmed() {
  if (selectedAgents.value.length === 0) return
  agentSkill.value = null
  resolver?.({ type: 'confirmed', agents: [...selectedAgents.value] })
  resolver = null
}

function requestEnable(skill: Skill, existingAgents: string[]): Promise<EnableFlowOutcome> {
  // 若前一次呼叫的 promise 還沒 resolve（理論上不該發生，但呼叫端萬一重複呼叫，
  // 不能讓前一個 promise 永遠 pending 下去），先幫它 resolve 成 cancelled 再繼續
  resolver?.({ type: 'cancelled' })
  pendingExistingAgents = existingAgents
  return new Promise(resolve => {
    resolver = resolve
    if (!canEnableSkill(skill)) {
      gateSkill.value = skill
    } else {
      enterAgentStep(skill)
    }
  })
}

defineExpose({ requestEnable })
</script>
