<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/gameStore'
import gameConfig from '../config/gameConfig'
import { buildStoryMap, getTimeLabel } from '../utils/gameUtils'
import type { StoryNode, StoryNodeStatus, CharacterStoryLine, StoryGapReason, GapDimension } from '../utils/gameUtils'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const gameStore = useGameStore()
const activeTab = ref<string>('all')
const expandedLines = ref<Set<string>>(new Set(['__shared__']))
const showGapsOnly = ref(false)

const characterConfigMap = computed(() =>
  new Map(gameConfig.characters.map(c => [c.id, c]))
)

const storyMap = computed(() =>
  buildStoryMap(
    gameConfig.events,
    gameConfig.characters.map(c => {
      const state = gameStore.getCharacterState(c.id)
      return {
        id: c.id,
        name: c.name,
        avatar: c.avatar,
        unlocked: state?.unlocked ?? c.unlocked,
        hidden: c.hidden
      }
    }),
    gameStore.day,
    gameStore.timeSlot,
    gameStore.characters,
    gameStore.triggeredEvents,
    gameStore.collectedCards,
    gameStore.flags,
    gameStore.eventChoices
  )
)

const tabs = computed(() => {
  const result: { id: string; label: string; icon: string; badge?: string }[] = [
    { id: 'all', label: '总览', icon: '🗺️' }
  ]
  for (const line of storyMap.value.characterLines) {
    const badges: string[] = []
    if (line.gapCount > 0) badges.push(`⚠️${line.gapCount}`)
    if (line.lockedCount > 0) badges.push(`🔒${line.lockedCount}`)
    result.push({
      id: line.characterId,
      label: line.characterName,
      icon: line.avatar,
      badge: badges.length > 0 ? badges.join(' ') : undefined
    })
  }
  return result
})

const activeLine = computed((): CharacterStoryLine | null => {
  if (activeTab.value === 'all') return null
  return storyMap.value.characterLines.find(l => l.characterId === activeTab.value) || null
})

const criticalGaps = computed(() => {
  const all: { line: CharacterStoryLine | { characterId: 'shared'; characterName: '公共事件'; avatar: '🔀' }; node: StoryNode }[] = []
  for (const line of storyMap.value.characterLines) {
    for (const node of line.nodes) {
      if (node.status === 'gap' || (node.status === 'locked' && node.gapReasons.some(r => r.dimension === 'affinity'))) {
        all.push({ line, node })
      }
    }
  }
  for (const node of storyMap.value.sharedEvents) {
    if (node.status === 'gap') {
      all.push({ line: { characterId: 'shared', characterName: '公共事件', avatar: '🔀' }, node })
    }
  }
  return all
})

function toggleLine(characterId: string) {
  if (expandedLines.value.has(characterId)) {
    expandedLines.value.delete(characterId)
  } else {
    expandedLines.value.add(characterId)
  }
}

function getStatusIcon(status: StoryNodeStatus): string {
  switch (status) {
    case 'completed': return '✅'
    case 'available': return '🔔'
    case 'locked': return '🔒'
    case 'gap': return '⚠️'
    default: return '❓'
  }
}

function getStatusClass(status: StoryNodeStatus): string {
  return `node-${status}`
}

function getStatusLabel(status: StoryNodeStatus): string {
  switch (status) {
    case 'completed': return '已完成'
    case 'available': return '可触发'
    case 'locked': return '未解锁'
    case 'gap': return '已错过'
    default: return ''
  }
}

function getProgressColor(progress: number): string {
  if (progress >= 80) return '#22c55e'
  if (progress >= 50) return '#3b82f6'
  if (progress >= 25) return '#f59e0b'
  return '#ef4444'
}

const overallProgress = computed(() => {
  const { totalEvents, completedEvents } = storyMap.value
  return totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0
})

function getGapDimensionLabel(d: GapDimension): { icon: string; label: string; color: string } {
  switch (d) {
    case 'day_passed': return { icon: '📅', label: '错过', color: '#ef4444' }
    case 'day_future': return { icon: '⏳', label: '未到', color: '#3b82f6' }
    case 'time': return { icon: '🕒', label: '时段', color: '#8b5cf6' }
    case 'affinity': return { icon: '💗', label: '好感', color: '#ec4899' }
    case 'character_locked': return { icon: '👤', label: '角色', color: '#f59e0b' }
    case 'flags': return { icon: '🏁', label: '标记', color: '#64748b' }
  }
}

function filterNodes<T extends StoryNode>(nodes: T[]): T[] {
  if (!showGapsOnly.value) return nodes
  return nodes.filter(n => n.status !== 'completed')
}
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content story-map-modal">
        <div class="modal-header">
          <h2>🗺️ 剧情地图</h2>
          <div class="header-actions">
            <label class="gaps-toggle" :class="{ active: showGapsOnly }">
              <input type="checkbox" v-model="showGapsOnly" />
              <span>只看缺口</span>
            </label>
            <button class="close-btn" @click="emit('close')">✕</button>
          </div>
        </div>

        <div class="summary-bar">
          <div class="summary-item completed">
            <span class="summary-icon">✅</span>
            <span class="summary-value">{{ storyMap.completedEvents }}</span>
            <span class="summary-label">已完成</span>
          </div>
          <div class="summary-item available">
            <span class="summary-icon">🔔</span>
            <span class="summary-value">{{ storyMap.availableEvents }}</span>
            <span class="summary-label">可触发</span>
          </div>
          <div class="summary-item locked">
            <span class="summary-icon">🔒</span>
            <span class="summary-value">{{ storyMap.lockedEvents }}</span>
            <span class="summary-label">未解锁</span>
          </div>
          <div class="summary-item gap">
            <span class="summary-icon">⚠️</span>
            <span class="summary-value">{{ storyMap.gapEvents }}</span>
            <span class="summary-label">已错过</span>
          </div>
        </div>

        <div class="overall-progress">
          <div class="progress-header">
            <span>总体进度</span>
            <span class="progress-percent">{{ overallProgress }}% · {{ storyMap.completedEvents }}/{{ storyMap.totalEvents }}</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: overallProgress + '%', background: getProgressColor(overallProgress) }"
            ></div>
          </div>
        </div>

        <div v-if="activeTab === 'all' && criticalGaps.length > 0" class="gap-overview">
          <div class="gap-overview-title">🔎 关键缺口总览</div>
          <div class="gap-list">
            <div
              v-for="(item, idx) in criticalGaps"
              :key="idx"
              class="gap-card"
              @click="activeTab = item.line.characterId; expandedLines.add(item.line.characterId)"
            >
              <span class="gap-line-avatar">{{ item.line.avatar }}</span>
              <div class="gap-card-info">
                <div class="gap-card-title">{{ item.node.title }}</div>
                <div class="gap-card-meta">
                  <span>📅 第{{ item.node.day }}{{ item.node.maxDay ? `~${item.node.maxDay}` : '' }}天</span>
                  <span v-if="item.node.timeOfDay">🕒 {{ getTimeLabel(item.node.timeOfDay) }}</span>
                </div>
                <div class="gap-card-reasons">
                  <span
                    v-for="(r, i) in item.node.gapReasons"
                    :key="i"
                    class="reason-chip"
                    :style="{ '--chip-color': getGapDimensionLabel(r.dimension).color }"
                  >
                    <span class="chip-icon">{{ getGapDimensionLabel(r.dimension).icon }}</span>
                    {{ r.text }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="tab-bar">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            :class="['tab-btn', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            <span class="tab-label">{{ tab.label }}</span>
            <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
          </button>
        </div>

        <div class="story-content">
          <template v-if="activeTab === 'all'">
            <div
              v-for="line in storyMap.characterLines"
              :key="line.characterId"
              class="character-line"
            >
              <div
                class="line-header"
                @click="toggleLine(line.characterId)"
              >
                <div class="line-info">
                  <span class="line-avatar">{{ line.avatar }}</span>
                  <div class="line-title-wrap">
                    <span class="line-name">{{ line.characterName }}线</span>
                    <div class="line-badges">
                      <span class="mini-badge success" v-if="line.nodes.filter(n => n.status === 'available').length > 0">
                        🔔 可触发 {{ line.nodes.filter(n => n.status === 'available').length }}
                      </span>
                      <span class="mini-badge warn" v-if="line.gapCount > 0">
                        ⚠️ 错过 {{ line.gapCount }}
                      </span>
                      <span class="mini-badge muted" v-if="line.lockedCount > 0">
                        🔒 未解锁 {{ line.lockedCount }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="line-progress-wrap">
                  <div class="progress-bar mini">
                    <div
                      class="progress-fill"
                      :style="{ width: line.progress + '%', background: getProgressColor(line.progress) }"
                    ></div>
                  </div>
                  <span class="line-progress-text">{{ line.nodes.filter(n => n.status === 'completed').length }}/{{ line.nodes.length }} · {{ line.progress }}%</span>
                  <span class="expand-icon">{{ expandedLines.has(line.characterId) ? '▼' : '▶' }}</span>
                </div>
              </div>

              <div v-if="line.nextAvailableNode && expandedLines.has(line.characterId)" class="line-hint">
                💡 下一节点：<b>{{ line.nextAvailableNode.title }}</b>
                （第{{ line.nextAvailableNode.day }}天
                <span v-if="line.nextAvailableNode.timeOfDay">· {{ getTimeLabel(line.nextAvailableNode.timeOfDay) }}</span>）
              </div>

              <div v-if="expandedLines.has(line.characterId)" class="line-nodes">
                <div
                  v-for="node in filterNodes(line.nodes)"
                  :key="node.eventId"
                  :class="['story-node', getStatusClass(node.status)]"
                >
                  <div class="node-connector">
                    <div class="connector-line"></div>
                    <div class="connector-dot"></div>
                  </div>
                  <div class="node-body">
                    <div class="node-header">
                      <span class="node-status-icon">{{ getStatusIcon(node.status) }}</span>
                      <span class="node-title">{{ node.title }}</span>
                      <span :class="['node-badge', getStatusClass(node.status)]">
                        {{ getStatusLabel(node.status) }}
                      </span>
                    </div>

                    <div class="node-meta">
                      <span>📅 第{{ node.day }}{{ node.maxDay ? `~${node.maxDay}` : '' }}天</span>
                      <span v-if="node.timeOfDay">🕒 {{ getTimeLabel(node.timeOfDay) }}</span>
                      <span v-if="node.affinityRequirement && (node.affinityRequirement.min || node.affinityRequirement.max)" class="meta-affinity">
                        💗 好感{{ node.affinityRequirement.min ? `≥${node.affinityRequirement.min}` : '' }}
                        {{ node.affinityRequirement.max ? ` ≤${node.affinityRequirement.max}` : '' }}
                        <span :class="{ 'affinity-ok': node.status === 'completed' || node.status === 'available', 'affinity-low': node.status === 'locked' }">
                          （当前 {{ node.affinityRequirement.current }}）
                        </span>
                      </span>
                    </div>

                    <div v-if="node.status === 'gap' || node.status === 'locked'" class="node-reasons">
                      <span
                        v-for="(reason, idx) in node.gapReasons"
                        :key="idx"
                        class="reason-chip"
                        :style="{ '--chip-color': getGapDimensionLabel(reason.dimension).color }"
                      >
                        <span class="chip-icon">{{ getGapDimensionLabel(reason.dimension).icon }}</span>
                        {{ reason.text }}
                      </span>
                    </div>

                    <div v-if="node.choiceItems.length > 0" class="node-choices">
                      <div class="choices-label">
                        分支选项
                        <span v-if="node.status === 'completed' && node.chosenChoiceText" class="chosen-summary">
                          · 你选择了：<b>{{ node.chosenChoiceText }}</b>
                        </span>
                      </div>
                      <div class="choice-list">
                        <div
                          v-for="(choice, idx) in node.choiceItems"
                          :key="idx"
                          :class="['choice-tag', {
                            chosen: choice.chosen,
                            rejected: node.status === 'completed' && !choice.chosen,
                            pending: node.status !== 'completed'
                          }]"
                        >
                          <span class="choice-prefix">
                            <template v-if="choice.chosen">✅</template>
                            <template v-else-if="node.status === 'completed'">❌</template>
                            <template v-else>○</template>
                          </span>
                          {{ choice.text }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-if="filterNodes(line.nodes).length === 0" class="empty-line">
                  所有节点均已完成 ✨
                </div>
              </div>
            </div>

            <div v-if="storyMap.sharedEvents.length > 0" class="character-line shared-line">
              <div
                class="line-header"
                @click="toggleLine('__shared__')"
              >
                <div class="line-info">
                  <span class="line-avatar">🔀</span>
                  <div class="line-title-wrap">
                    <span class="line-name">公共事件</span>
                    <div class="line-badges">
                      <span class="mini-badge success" v-if="storyMap.sharedEvents.filter(n => n.status === 'available').length > 0">
                        🔔 可触发 {{ storyMap.sharedEvents.filter(n => n.status === 'available').length }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="line-progress-wrap">
                  <span class="line-progress-text">
                    {{ storyMap.sharedEvents.filter(n => n.status === 'completed').length }}/{{ storyMap.sharedEvents.length }}
                  </span>
                  <span class="expand-icon">{{ expandedLines.has('__shared__') ? '▼' : '▶' }}</span>
                </div>
              </div>
              <div v-if="expandedLines.has('__shared__')" class="line-nodes">
                <div
                  v-for="node in filterNodes(storyMap.sharedEvents)"
                  :key="node.eventId"
                  :class="['story-node', getStatusClass(node.status)]"
                >
                  <div class="node-connector">
                    <div class="connector-line"></div>
                    <div class="connector-dot"></div>
                  </div>
                  <div class="node-body">
                    <div class="node-header">
                      <span class="node-status-icon">{{ getStatusIcon(node.status) }}</span>
                      <span class="node-title">{{ node.title }}</span>
                      <span :class="['node-badge', getStatusClass(node.status)]">
                        {{ getStatusLabel(node.status) }}
                      </span>
                    </div>
                    <div class="node-meta">
                      <span>📅 第{{ node.day }}{{ node.maxDay ? `~${node.maxDay}` : '' }}天</span>
                      <span v-if="node.timeOfDay">🕒 {{ getTimeLabel(node.timeOfDay) }}</span>
                      <span v-if="node.characterId" class="meta-char">
                        👤 {{ characterConfigMap.get(node.characterId)?.name || node.characterId }}
                      </span>
                    </div>
                    <div v-if="node.status === 'gap' || node.status === 'locked'" class="node-reasons">
                      <span
                        v-for="(reason, idx) in node.gapReasons"
                        :key="idx"
                        class="reason-chip"
                        :style="{ '--chip-color': getGapDimensionLabel(reason.dimension).color }"
                      >
                        <span class="chip-icon">{{ getGapDimensionLabel(reason.dimension).icon }}</span>
                        {{ reason.text }}
                      </span>
                    </div>
                    <div v-if="node.choiceItems.length > 0" class="node-choices">
                      <div class="choices-label">
                        分支选项
                        <span v-if="node.status === 'completed' && node.chosenChoiceText" class="chosen-summary">
                          · 你选择了：<b>{{ node.chosenChoiceText }}</b>
                        </span>
                      </div>
                      <div class="choice-list">
                        <div
                          v-for="(choice, idx) in node.choiceItems"
                          :key="idx"
                          :class="['choice-tag', {
                            chosen: choice.chosen,
                            rejected: node.status === 'completed' && !choice.chosen,
                            pending: node.status !== 'completed'
                          }]"
                        >
                          <span class="choice-prefix">
                            <template v-if="choice.chosen">✅</template>
                            <template v-else-if="node.status === 'completed'">❌</template>
                            <template v-else>○</template>
                          </span>
                          {{ choice.text }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="activeLine">
            <div class="single-line-view">
              <div class="single-line-header">
                <span class="single-avatar">{{ activeLine.avatar }}</span>
                <div>
                  <h3>{{ activeLine.characterName }}线</h3>
                  <div class="line-badges">
                    <span class="mini-badge success" v-if="activeLine.nodes.filter(n => n.status === 'available').length > 0">
                      🔔 可触发 {{ activeLine.nodes.filter(n => n.status === 'available').length }}
                    </span>
                    <span class="mini-badge warn" v-if="activeLine.gapCount > 0">
                      ⚠️ 错过 {{ activeLine.gapCount }}
                    </span>
                    <span class="mini-badge muted" v-if="activeLine.lockedCount > 0">
                      🔒 未解锁 {{ activeLine.lockedCount }}
                    </span>
                  </div>
                </div>
                <div class="single-progress">
                  <div class="progress-bar">
                    <div
                      class="progress-fill"
                      :style="{ width: activeLine.progress + '%', background: getProgressColor(activeLine.progress) }"
                    ></div>
                  </div>
                  <span>{{ activeLine.progress }}%</span>
                </div>
              </div>

              <div v-if="activeLine.nextAvailableNode" class="line-hint highlighted">
                💡 <b>下一个可触发节点：</b>
                <span class="hint-title">{{ activeLine.nextAvailableNode.title }}</span>
                <span class="hint-meta">
                  📅 第{{ activeLine.nextAvailableNode.day }}天
                  <span v-if="activeLine.nextAvailableNode.timeOfDay"> · {{ getTimeLabel(activeLine.nextAvailableNode.timeOfDay) }}</span>
                </span>
              </div>

              <div class="line-nodes expanded">
                <div
                  v-for="node in filterNodes(activeLine.nodes)"
                  :key="node.eventId"
                  :class="['story-node', getStatusClass(node.status)]"
                >
                  <div class="node-connector">
                    <div class="connector-line"></div>
                    <div class="connector-dot"></div>
                  </div>
                  <div class="node-body">
                    <div class="node-header">
                      <span class="node-status-icon">{{ getStatusIcon(node.status) }}</span>
                      <span class="node-title">{{ node.title }}</span>
                      <span :class="['node-badge', getStatusClass(node.status)]">
                        {{ getStatusLabel(node.status) }}
                      </span>
                    </div>
                    <div class="node-meta">
                      <span>📅 第{{ node.day }}{{ node.maxDay ? `~${node.maxDay}` : '' }}天</span>
                      <span v-if="node.timeOfDay">🕒 {{ getTimeLabel(node.timeOfDay) }}</span>
                      <span v-if="node.affinityRequirement && (node.affinityRequirement.min || node.affinityRequirement.max)" class="meta-affinity">
                        💗 好感{{ node.affinityRequirement.min ? `≥${node.affinityRequirement.min}` : '' }}
                        {{ node.affinityRequirement.max ? ` ≤${node.affinityRequirement.max}` : '' }}
                        <span :class="{ 'affinity-ok': node.status === 'completed' || node.status === 'available', 'affinity-low': node.status === 'locked' }">
                          （当前 {{ node.affinityRequirement.current }}）
                        </span>
                      </span>
                    </div>
                    <div v-if="node.status === 'gap' || node.status === 'locked'" class="node-reasons">
                      <span
                        v-for="(reason, idx) in node.gapReasons"
                        :key="idx"
                        class="reason-chip"
                        :style="{ '--chip-color': getGapDimensionLabel(reason.dimension).color }"
                      >
                        <span class="chip-icon">{{ getGapDimensionLabel(reason.dimension).icon }}</span>
                        {{ reason.text }}
                      </span>
                    </div>
                    <div v-if="node.choiceItems.length > 0" class="node-choices">
                      <div class="choices-label">
                        分支选项
                        <span v-if="node.status === 'completed' && node.chosenChoiceText" class="chosen-summary">
                          · 你选择了：<b>{{ node.chosenChoiceText }}</b>
                        </span>
                      </div>
                      <div class="choice-list">
                        <div
                          v-for="(choice, idx) in node.choiceItems"
                          :key="idx"
                          :class="['choice-tag', {
                            chosen: choice.chosen,
                            rejected: node.status === 'completed' && !choice.chosen,
                            pending: node.status !== 'completed'
                          }]"
                        >
                          <span class="choice-prefix">
                            <template v-if="choice.chosen">✅</template>
                            <template v-else-if="node.status === 'completed'">❌</template>
                            <template v-else>○</template>
                          </span>
                          {{ choice.text }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="legend">
          <div class="legend-item"><span class="legend-dot completed"></span> 已完成</div>
          <div class="legend-item"><span class="legend-dot available"></span> 可触发</div>
          <div class="legend-item"><span class="legend-dot locked"></span> 未解锁</div>
          <div class="legend-item"><span class="legend-dot gap"></span> 已错过</div>
          <div class="legend-sep"></div>
          <div class="legend-item">💗 好感缺口</div>
          <div class="legend-item">📅 天数错过</div>
          <div class="legend-item">🕒 时段不符</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.story-map-modal {
  padding: 24px;
  max-width: 720px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-header h2 {
  font-size: 20px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.gaps-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 6px 10px;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}

.gaps-toggle input {
  margin: 0;
  accent-color: var(--accent-primary);
}

.gaps-toggle.active {
  background: var(--accent-light);
  color: var(--accent-primary);
  font-weight: 500;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--accent-light);
}

.summary-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 8px;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  gap: 2px;
}

.summary-icon {
  font-size: 18px;
}

.summary-value {
  font-size: 22px;
  font-weight: 700;
}

.summary-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.summary-item.completed .summary-value { color: #22c55e; }
.summary-item.available .summary-value { color: #3b82f6; }
.summary-item.locked .summary-value { color: #94a3b8; }
.summary-item.gap .summary-value { color: #ef4444; }

.overall-progress {
  margin-bottom: 14px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 6px;
  color: var(--text-secondary);
}

.progress-percent {
  font-weight: 600;
  color: var(--text-primary);
}

.progress-bar.mini {
  height: 6px;
  width: 90px;
}

.gap-overview {
  background: linear-gradient(135deg, #fef2f2, #fff7ed);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  margin-bottom: 14px;
  border: 1px solid #fecaca;
}

[data-theme='dark'] .gap-overview {
  background: linear-gradient(135deg, #450a0a, #431407);
  border: 1px solid #7f1d1d;
}

.gap-overview-title {
  font-size: 13px;
  font-weight: 600;
  color: #991b1b;
  margin-bottom: 10px;
}

[data-theme='dark'] .gap-overview-title {
  color: #fecaca;
}

.gap-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding-right: 4px;
}

.gap-card {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.gap-card:hover {
  border-color: var(--accent-primary);
  transform: translateX(2px);
}

.gap-line-avatar {
  font-size: 22px;
  flex-shrink: 0;
}

.gap-card-info {
  flex: 1;
  min-width: 0;
}

.gap-card-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 2px;
}

.gap-card-meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.gap-card-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tab-bar {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  font-size: 13px;
  white-space: nowrap;
  transition: all 0.2s;
}

.tab-btn.active {
  background: var(--accent-primary);
  color: white;
}

.tab-btn:hover:not(.active) {
  background: var(--accent-light);
}

.tab-icon {
  font-size: 16px;
}

.tab-badge {
  font-size: 11px;
  opacity: 0.85;
}

.story-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}

.character-line {
  margin-bottom: 8px;
}

.line-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.line-header:hover {
  background: var(--accent-light);
}

.line-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.line-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.line-avatar {
  font-size: 22px;
}

.line-name {
  font-weight: 600;
  font-size: 15px;
}

.line-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mini-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}
.mini-badge.success { background: #dcfce7; color: #166534; }
.mini-badge.warn { background: #fee2e2; color: #991b1b; }
.mini-badge.muted { background: #f1f5f9; color: #475569; }
[data-theme='dark'] .mini-badge.success { background: #14532d; color: #86efac; }
[data-theme='dark'] .mini-badge.warn { background: #7f1d1d; color: #fecaca; }
[data-theme='dark'] .mini-badge.muted { background: #1e293b; color: #cbd5e1; }

.line-progress-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.line-progress-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
}

.expand-icon {
  font-size: 12px;
  color: var(--text-muted);
  transition: transform 0.2s;
}

.line-hint {
  margin: 8px 14px 4px;
  padding: 8px 12px;
  background: #eff6ff;
  color: #1e40af;
  border-radius: var(--radius-sm);
  font-size: 12px;
  border-left: 3px solid #3b82f6;
}

[data-theme='dark'] .line-hint {
  background: #172554;
  color: #93c5fd;
}

.line-hint.highlighted {
  background: #fef3c7;
  color: #92400e;
  border-color: #f59e0b;
}
[data-theme='dark'] .line-hint.highlighted {
  background: #451a03;
  color: #fde68a;
  border-color: #f59e0b;
}

.hint-title {
  font-weight: 600;
}

.hint-meta {
  margin-left: 8px;
  opacity: 0.9;
}

.line-nodes {
  padding: 8px 0 8px 8px;
}

.line-nodes.expanded {
  padding: 12px 0 12px 8px;
}

.story-node {
  display: flex;
  gap: 0;
  position: relative;
}

.node-connector {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 28px;
  flex-shrink: 0;
}

.connector-line {
  width: 2px;
  flex: 1;
  background: var(--border-light);
}

.connector-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid;
  flex-shrink: 0;
}

.node-completed .connector-dot { border-color: #22c55e; background: #22c55e; }
.node-available .connector-dot { border-color: #3b82f6; background: #3b82f6; animation: pulse 2s infinite; }
.node-locked .connector-dot { border-color: #94a3b8; }
.node-gap .connector-dot { border-color: #ef4444; background: #ef4444; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.node-body {
  flex: 1;
  padding: 10px 14px;
  margin: 4px 0;
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
}

.node-completed .node-body { border-left: 3px solid #22c55e; }
.node-available .node-body { border-left: 3px solid #3b82f6; }
.node-locked .node-body { border-left: 3px solid #94a3b8; opacity: 0.85; }
.node-gap .node-body { border-left: 3px solid #ef4444; background: linear-gradient(135deg, var(--bg-secondary), #fff1f2); }
[data-theme='dark'] .node-gap .node-body { background: linear-gradient(135deg, var(--bg-secondary), #450a0a); }

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.node-status-icon {
  font-size: 14px;
}

.node-title {
  font-weight: 600;
  font-size: 14px;
  flex: 1;
}

.node-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-weight: 500;
}

.node-badge.node-completed { background: #dcfce7; color: #166534; }
.node-badge.node-available { background: #dbeafe; color: #1e40af; }
.node-badge.node-locked { background: #f1f5f9; color: #64748b; }
.node-badge.node-gap { background: #fee2e2; color: #991b1b; }

[data-theme='dark'] .node-badge.node-completed { background: #14532d; color: #86efac; }
[data-theme='dark'] .node-badge.node-available { background: #1e3a5f; color: #93c5fd; }
[data-theme='dark'] .node-badge.node-locked { background: #1e293b; color: #94a3b8; }
[data-theme='dark'] .node-badge.node-gap { background: #7f1d1d; color: #fca5a5; }

.node-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.meta-affinity {
  color: var(--text-secondary);
}

.meta-affinity .affinity-ok { color: #16a34a; font-weight: 500; }
.meta-affinity .affinity-low { color: #dc2626; font-weight: 500; }

.meta-char {
  font-style: italic;
  opacity: 0.8;
}

.node-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.reason-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--chip-color, #f59e0b) 15%, transparent);
  color: var(--chip-color, #f59e0b);
  border: 1px solid color-mix(in srgb, var(--chip-color, #f59e0b) 30%, transparent);
  font-weight: 500;
}

.chip-icon {
  font-size: 12px;
}

.node-choices {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-light);
}

.choices-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.chosen-summary {
  color: var(--accent-primary);
  font-weight: 500;
}

.choice-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.choice-tag {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  transition: all 0.15s;
}

.choice-tag.chosen {
  background: #dcfce7;
  color: #166534;
  font-weight: 500;
  border: 1px solid #86efac;
}

.choice-tag.rejected {
  opacity: 0.45;
  text-decoration: line-through;
}

.choice-tag.pending {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

[data-theme='dark'] .choice-tag.chosen {
  background: #14532d;
  color: #86efac;
  border: 1px solid #166534;
}

.choice-prefix {
  flex-shrink: 0;
  font-size: 11px;
  line-height: 1.5;
}

.single-line-view {
  padding: 4px 0;
}

.single-line-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 14px 18px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.single-avatar {
  font-size: 34px;
}

.single-line-header h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.single-line-header > div:nth-child(2) {
  flex: 1;
}

.single-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  min-width: 140px;
}

.single-progress .progress-bar {
  width: 100px;
}

.empty-line {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.legend {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 14px;
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid var(--border-light);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.legend-dot.completed { background: #22c55e; }
.legend-dot.available { background: #3b82f6; }
.legend-dot.locked { background: #94a3b8; }
.legend-dot.gap { background: #ef4444; }

.legend-sep {
  width: 1px;
  background: var(--border-light);
  margin: 0 4px;
}

.shared-line .line-header {
  background: linear-gradient(135deg, var(--bg-tertiary), var(--accent-light));
}
</style>
