<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../stores/gameStore'
import gameConfig from '../config/gameConfig'
import { buildStoryMap, getTimeLabel } from '../utils/gameUtils'
import type { StoryNode, StoryNodeStatus, CharacterStoryLine } from '../utils/gameUtils'

const emit = defineEmits<{
  (e: 'close'): void
}>()

const gameStore = useGameStore()
const activeTab = ref<string>('all')
const expandedLines = ref<Set<string>>(new Set())

const storyMap = computed(() =>
  buildStoryMap(
    gameConfig.events,
    gameConfig.characters.map(c => ({
      id: c.id,
      name: c.name,
      avatar: c.avatar,
      unlocked: gameStore.getCharacterState(c.id)?.unlocked ?? c.unlocked,
      hidden: c.hidden
    })),
    gameStore.day,
    gameStore.timeSlot,
    gameStore.characters,
    gameStore.triggeredEvents,
    gameStore.collectedCards,
    gameStore.flags
  )
)

const tabs = computed(() => {
  const result = [{ id: 'all', label: '总览', icon: '🗺️' }]
  for (const line of storyMap.value.characterLines) {
    result.push({
      id: line.characterId,
      label: line.characterName,
      icon: line.avatar
    })
  }
  return result
})

const activeLine = computed((): CharacterStoryLine | null => {
  if (activeTab.value === 'all') return null
  return storyMap.value.characterLines.find(l => l.characterId === activeTab.value) || null
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
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content story-map-modal">
        <div class="modal-header">
          <h2>🗺️ 剧情地图</h2>
          <button class="close-btn" @click="emit('close')">✕</button>
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
            <span class="summary-value">{{ storyMap.totalEvents - storyMap.completedEvents - storyMap.availableEvents - storyMap.gapEvents }}</span>
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
            <span class="progress-percent">{{ overallProgress }}%</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: overallProgress + '%', background: getProgressColor(overallProgress) }"
            ></div>
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
                  <span class="line-name">{{ line.characterName }}线</span>
                  <span class="line-count">{{ line.nodes.filter(n => n.status === 'completed').length }}/{{ line.nodes.length }}</span>
                </div>
                <div class="line-progress-wrap">
                  <div class="progress-bar mini">
                    <div
                      class="progress-fill"
                      :style="{ width: line.progress + '%', background: getProgressColor(line.progress) }"
                    ></div>
                  </div>
                  <span class="line-progress-text">{{ line.progress }}%</span>
                  <span class="expand-icon">{{ expandedLines.has(line.characterId) ? '▼' : '▶' }}</span>
                </div>
              </div>

              <div v-if="expandedLines.has(line.characterId)" class="line-nodes">
                <div
                  v-for="node in line.nodes"
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
                      <span>📅 第{{ node.day }}天</span>
                      <span v-if="node.timeOfDay">{{ getTimeLabel(node.timeOfDay) }}</span>
                    </div>
                    <div v-if="node.status === 'gap' || node.status === 'locked'" class="node-reasons">
                      <span v-for="(reason, idx) in node.gapReasons" :key="idx" class="reason-tag">
                        {{ reason }}
                      </span>
                    </div>
                    <div v-if="node.choiceTexts.length > 0" class="node-choices">
                      <div class="choices-label">分支选项：</div>
                      <div
                        v-for="(choice, idx) in node.choiceTexts"
                        :key="idx"
                        :class="['choice-tag', {
                          chosen: node.choicesMade.includes(choice),
                          locked: node.status !== 'completed'
                        }]"
                      >
                        {{ choice }}
                      </div>
                    </div>
                  </div>
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
                  <span class="line-name">公共事件</span>
                  <span class="line-count">{{ storyMap.sharedEvents.filter(n => n.status === 'completed').length }}/{{ storyMap.sharedEvents.length }}</span>
                </div>
                <div class="line-progress-wrap">
                  <span class="expand-icon">{{ expandedLines.has('__shared__') ? '▼' : '▶' }}</span>
                </div>
              </div>
              <div v-if="expandedLines.has('__shared__')" class="line-nodes">
                <div
                  v-for="node in storyMap.sharedEvents"
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
                      <span>📅 第{{ node.day }}天</span>
                      <span v-if="node.timeOfDay">{{ getTimeLabel(node.timeOfDay) }}</span>
                    </div>
                    <div v-if="node.status === 'gap' || node.status === 'locked'" class="node-reasons">
                      <span v-for="(reason, idx) in node.gapReasons" :key="idx" class="reason-tag">
                        {{ reason }}
                      </span>
                    </div>
                    <div v-if="node.choiceTexts.length > 0" class="node-choices">
                      <div class="choices-label">分支选项：</div>
                      <div
                        v-for="(choice, idx) in node.choiceTexts"
                        :key="idx"
                        :class="['choice-tag', {
                          chosen: node.choicesMade.includes(choice),
                          locked: node.status !== 'completed'
                        }]"
                      >
                        {{ choice }}
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
                <h3>{{ activeLine.characterName }}线</h3>
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

              <div class="line-nodes expanded">
                <div
                  v-for="node in activeLine.nodes"
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
                      <span>📅 第{{ node.day }}天</span>
                      <span v-if="node.timeOfDay">{{ getTimeLabel(node.timeOfDay) }}</span>
                    </div>
                    <div v-if="node.status === 'gap' || node.status === 'locked'" class="node-reasons">
                      <span v-for="(reason, idx) in node.gapReasons" :key="idx" class="reason-tag">
                        {{ reason }}
                      </span>
                    </div>
                    <div v-if="node.choiceTexts.length > 0" class="node-choices">
                      <div class="choices-label">分支选项：</div>
                      <div
                        v-for="(choice, idx) in node.choiceTexts"
                        :key="idx"
                        :class="['choice-tag', {
                          chosen: node.choicesMade.includes(choice),
                          locked: node.status !== 'completed'
                        }]"
                      >
                        {{ choice }}
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
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.story-map-modal {
  padding: 24px;
  max-width: 680px;
  max-height: 85vh;
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
  margin-bottom: 16px;
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
  width: 80px;
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
  gap: 8px;
}

.line-avatar {
  font-size: 22px;
}

.line-name {
  font-weight: 600;
  font-size: 15px;
}

.line-count {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  padding: 2px 8px;
  border-radius: 9999px;
}

.line-progress-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.line-progress-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.expand-icon {
  font-size: 12px;
  color: var(--text-muted);
  transition: transform 0.2s;
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
.node-locked .node-body { border-left: 3px solid #94a3b8; opacity: 0.75; }
.node-gap .node-body { border-left: 3px solid #ef4444; }

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
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.node-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.reason-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #fef3c7;
  color: #92400e;
}

[data-theme='dark'] .reason-tag {
  background: #422006;
  color: #fcd34d;
}

.node-choices {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-light);
}

.choices-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.choice-tag {
  display: inline-block;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
  background: var(--bg-tertiary);
  margin: 2px 4px 2px 0;
  color: var(--text-secondary);
}

.choice-tag.chosen {
  background: #dcfce7;
  color: #166534;
  font-weight: 500;
}

.choice-tag.locked {
  opacity: 0.6;
}

[data-theme='dark'] .choice-tag.chosen {
  background: #14532d;
  color: #86efac;
}

.single-line-view {
  padding: 4px 0;
}

.single-line-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
}

.single-avatar {
  font-size: 32px;
}

.single-line-header h3 {
  font-size: 18px;
  font-weight: 600;
  flex: 1;
}

.single-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}

.single-progress .progress-bar {
  width: 100px;
}

.legend {
  display: flex;
  justify-content: center;
  gap: 16px;
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

.shared-line .line-header {
  background: linear-gradient(135deg, var(--bg-tertiary), var(--accent-light));
}
</style>
