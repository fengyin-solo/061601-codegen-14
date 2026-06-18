import type { TimeOfDay, MoodLevel, GameConfig, CharacterConfig, GameEventConfig } from '../types/game'

export function getMoodLevel(mood: number): MoodLevel {
  if (mood >= 80) return 'happy'
  if (mood >= 60) return 'good'
  if (mood >= 40) return 'neutral'
  if (mood >= 20) return 'bad'
  return 'angry'
}

export function getMoodColor(mood: number): string {
  const level = getMoodLevel(mood)
  const colors: Record<MoodLevel, string> = {
    happy: '#22c55e',
    good: '#84cc16',
    neutral: '#eab308',
    bad: '#f97316',
    angry: '#ef4444'
  }
  return colors[level]
}

export function getMoodLabel(mood: number): string {
  const level = getMoodLevel(mood)
  const labels: Record<MoodLevel, string> = {
    happy: '开心',
    good: '不错',
    neutral: '一般',
    bad: '低落',
    angry: '生气'
  }
  return labels[level]
}

export function getTimeLabel(time: TimeOfDay): string {
  const labels: Record<TimeOfDay, string> = {
    morning: '早晨',
    afternoon: '下午',
    evening: '傍晚',
    night: '深夜'
  }
  return labels[time]
}

export function getTimeIcon(time: TimeOfDay): string {
  const icons: Record<TimeOfDay, string> = {
    morning: '🌅',
    afternoon: '☀️',
    evening: '🌆',
    night: '🌙'
  }
  return icons[time]
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function getAffinityColor(affinity: number, maxAffinity: number): string {
  const ratio = affinity / maxAffinity
  if (ratio >= 0.8) return '#ec4899'
  if (ratio >= 0.6) return '#f472b6'
  if (ratio >= 0.4) return '#fb923c'
  if (ratio >= 0.2) return '#fbbf24'
  if (ratio >= 0) return '#94a3b8'
  return '#64748b'
}

export function getAffinityStage(affinity: number): string {
  if (affinity >= 80) return '恋人'
  if (affinity >= 60) return '亲密'
  if (affinity >= 40) return '好友'
  if (affinity >= 20) return '朋友'
  if (affinity >= 0) return '相识'
  return '陌生'
}

export function getRarityColor(rarity: string): string {
  const colors: Record<string, string> = {
    common: '#94a3b8',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f59e0b'
  }
  return colors[rarity] || '#94a3b8'
}

export function getRarityLabel(rarity: string): string {
  const labels: Record<string, string> = {
    common: '普通',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说'
  }
  return labels[rarity] || '普通'
}

export function getNextTimeSlot(current: TimeOfDay, timeSlots: TimeOfDay[]): TimeOfDay {
  const index = timeSlots.indexOf(current)
  if (index < timeSlots.length - 1) {
    return timeSlots[index + 1]
  }
  return timeSlots[0]
}

export function isGiftLiked(giftId: string, character: CharacterConfig): boolean {
  return character.favoriteGifts.includes(giftId)
}

export function isGiftDisliked(giftId: string, character: CharacterConfig): boolean {
  return character.dislikedGifts.includes(giftId)
}

export function calculateChatAffinity(
  topic: string,
  character: CharacterConfig,
  mood: number,
  timeOfDay: TimeOfDay
): number {
  const topicConfig = character.chatTopics.find(t => t.topic === topic)
  let baseChange = topicConfig ? topicConfig.affinity : 0

  const moodMultiplier = 0.5 + (mood / 100)
  baseChange *= moodMultiplier

  if (timeOfDay === 'night' && character.baseMood < 50) {
    baseChange *= 0.7
  }
  if (timeOfDay === 'morning' && character.baseMood >= 60) {
    baseChange *= 1.2
  }

  return Math.round(baseChange * 10) / 10
}

export type StoryNodeStatus = 'completed' | 'available' | 'locked' | 'gap'

export type GapDimension = 'time' | 'day_passed' | 'day_future' | 'affinity' | 'character_locked' | 'flags'

export interface StoryGapReason {
  dimension: GapDimension
  text: string
  value?: { current: number | string; required: number | string; delta?: number }
}

export interface StoryNode {
  eventId: string
  title: string
  characterId: string | undefined
  day: number
  maxDay?: number
  timeOfDay: TimeOfDay | undefined
  status: StoryNodeStatus
  chosenChoiceId: string | undefined
  chosenChoiceText: string | undefined
  choicesMade: string[]
  choiceItems: { id: string; text: string; chosen: boolean }[]
  gapReasons: StoryGapReason[]
  affinityRequirement?: { min?: number; max?: number; current: number }
}

export interface CharacterStoryLine {
  characterId: string
  characterName: string
  avatar: string
  nodes: StoryNode[]
  progress: number
  gapCount: number
  lockedCount: number
  nextAvailableNode: StoryNode | undefined
}

export interface StoryMapData {
  characterLines: CharacterStoryLine[]
  sharedEvents: StoryNode[]
  totalEvents: number
  completedEvents: number
  availableEvents: number
  gapEvents: number
  lockedEvents: number
}

function checkEventCondition(
  event: GameEventConfig,
  currentDay: number,
  currentTimeSlot: TimeOfDay,
  characterStates: { id: string; affinity: number; unlocked: boolean }[],
  triggeredEvents: string[],
  flags: string[]
): { meets: boolean; reasons: StoryGapReason[] } {
  const reasons: StoryGapReason[] = []
  const cond = event.triggerCondition

  if (cond.minDay !== undefined && currentDay < cond.minDay) {
    reasons.push({
      dimension: 'day_future',
      text: `需第${cond.minDay}天（当前第${currentDay}天）`,
      value: { current: currentDay, required: cond.minDay, delta: cond.minDay - currentDay }
    })
  }
  if (cond.maxDay !== undefined && currentDay > cond.maxDay) {
    reasons.push({
      dimension: 'day_passed',
      text: `已过期限（最晚第${cond.maxDay}天，当前第${currentDay}天）`,
      value: { current: currentDay, required: cond.maxDay, delta: currentDay - cond.maxDay }
    })
  }
  if (cond.timeOfDay !== undefined && currentTimeSlot !== cond.timeOfDay) {
    const onScheduleDay =
      (cond.minDay === undefined || currentDay >= cond.minDay) &&
      (cond.maxDay === undefined || currentDay <= cond.maxDay)
    reasons.push({
      dimension: 'time',
      text: onScheduleDay
        ? `需在${getTimeLabel(cond.timeOfDay)}触发（当前为${getTimeLabel(currentTimeSlot)}）`
        : `需第${cond.minDay ?? '?'}~${cond.maxDay ?? '?'}天的${getTimeLabel(cond.timeOfDay)}`
    })
  }

  let affinityInfo: { min?: number; max?: number; current: number } | undefined

  if (cond.characterId) {
    const charState = characterStates.find(c => c.id === cond.characterId)
    if (!charState || !charState.unlocked) {
      reasons.push({
        dimension: 'character_locked',
        text: '该角色尚未解锁'
      })
    } else {
      affinityInfo = { min: cond.minAffinity, max: cond.maxAffinity, current: charState.affinity }
      if (cond.minAffinity !== undefined && charState.affinity < cond.minAffinity) {
        reasons.push({
          dimension: 'affinity',
          text: `好感需≥${cond.minAffinity}（当前${charState.affinity}）`,
          value: { current: charState.affinity, required: cond.minAffinity, delta: cond.minAffinity - charState.affinity }
        })
      }
      if (cond.maxAffinity !== undefined && charState.affinity > cond.maxAffinity) {
        reasons.push({
          dimension: 'affinity',
          text: `好感需≤${cond.maxAffinity}（当前${charState.affinity}）`,
          value: { current: charState.affinity, required: cond.maxAffinity, delta: charState.affinity - cond.maxAffinity }
        })
      }
    }
  }

  if (cond.requiredFlags) {
    const missingFlags = cond.requiredFlags.filter(f => !flags.includes(f))
    if (missingFlags.length > 0) {
      reasons.push({
        dimension: 'flags',
        text: `缺少前置标记: ${missingFlags.join(', ')}`
      })
    }
  }

  if (event.once && triggeredEvents.includes(event.id)) {
    return { meets: true, reasons: [] }
  }

  return { meets: reasons.length === 0, reasons }
}

const TIME_SLOT_ORDER: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night']

function isTimeWindowDefinitelyPassed(
  event: GameEventConfig,
  currentDay: number,
  currentTimeSlot: TimeOfDay
): boolean {
  const cond = event.triggerCondition

  if (cond.maxDay !== undefined && currentDay > cond.maxDay) {
    return true
  }

  if (cond.timeOfDay !== undefined && cond.minDay !== undefined && cond.maxDay === cond.minDay) {
    if (currentDay === cond.minDay) {
      const needIdx = TIME_SLOT_ORDER.indexOf(cond.timeOfDay)
      const currIdx = TIME_SLOT_ORDER.indexOf(currentTimeSlot)
      if (currIdx > needIdx) {
        return true
      }
    }
    if (currentDay > cond.minDay) {
      return true
    }
  }

  return false
}

export function buildStoryMap(
  events: GameEventConfig[],
  characters: { id: string; name: string; avatar: string; unlocked: boolean; hidden?: boolean }[],
  currentDay: number,
  currentTimeSlot: TimeOfDay,
  characterStates: { id: string; affinity: number; unlocked: boolean }[],
  triggeredEvents: string[],
  collectedCards: string[],
  flags: string[],
  eventChoices: Record<string, string>
): StoryMapData {
  const characterMap = new Map(characters.map(c => [c.id, c]))

  const lineMap = new Map<string, StoryNode[]>()
  const sharedNodes: StoryNode[] = []

  for (const char of characters) {
    if (char.hidden && !char.unlocked) continue
    lineMap.set(char.id, [])
  }

  let totalEvents = 0
  let completedEvents = 0
  let availableEvents = 0
  let gapEvents = 0
  let lockedEvents = 0

  for (const event of events) {
    totalEvents++
    const { meets, reasons } = checkEventCondition(
      event, currentDay, currentTimeSlot, characterStates, triggeredEvents, flags
    )

    const isCompleted = triggeredEvents.includes(event.id)
    const day = event.triggerCondition.minDay ?? 1

    const chosenId = isCompleted ? eventChoices[event.id] ?? undefined : undefined
    const chosenChoice = chosenId ? event.choices.find(c => c.id === chosenId) : undefined

    const choiceItems = event.choices.map(c => ({
      id: c.id,
      text: c.text,
      chosen: chosenId === c.id
    }))

    let status: StoryNodeStatus

    if (isCompleted) {
      status = 'completed'
      completedEvents++
    } else {
      const timeWindowGone = isTimeWindowDefinitelyPassed(event, currentDay, currentTimeSlot)
      const hasPassedDayReason = reasons.some(r => r.dimension === 'day_passed')

      if (timeWindowGone || hasPassedDayReason) {
        status = 'gap'
        gapEvents++
      } else if (meets) {
        status = 'available'
        availableEvents++
      } else {
        status = 'locked'
        lockedEvents++
      }
    }

    const charState = event.triggerCondition.characterId
      ? characterStates.find(c => c.id === event.triggerCondition.characterId)
      : undefined
    const affinityRequirement =
      event.triggerCondition.characterId &&
      (event.triggerCondition.minAffinity !== undefined || event.triggerCondition.maxAffinity !== undefined)
        ? {
            min: event.triggerCondition.minAffinity,
            max: event.triggerCondition.maxAffinity,
            current: charState?.affinity ?? 0
          }
        : undefined

    const node: StoryNode = {
      eventId: event.id,
      title: event.title,
      characterId: event.characterId,
      day,
      maxDay: event.triggerCondition.maxDay,
      timeOfDay: event.triggerCondition.timeOfDay,
      status,
      chosenChoiceId: chosenId,
      chosenChoiceText: chosenChoice?.text,
      choicesMade: chosenChoice ? [chosenChoice.text] : [],
      choiceItems,
      gapReasons: status === 'gap' || status === 'locked' ? reasons : [],
      affinityRequirement
    }

    if (event.characterId && lineMap.has(event.characterId)) {
      lineMap.get(event.characterId)!.push(node)
    } else if (event.characterId) {
      sharedNodes.push(node)
    } else {
      sharedNodes.push(node)
    }
  }

  const characterLines: CharacterStoryLine[] = []

  for (const char of characters) {
    if (char.hidden && !char.unlocked) continue
    const nodes = lineMap.get(char.id) || []
    nodes.sort((a, b) => a.day - b.day)
    const completed = nodes.filter(n => n.status === 'completed').length
    const progress = nodes.length > 0 ? Math.round((completed / nodes.length) * 100) : 0
    const gapCount = nodes.filter(n => n.status === 'gap').length
    const lockedCount = nodes.filter(n => n.status === 'locked').length
    const nextAvailableNode = nodes.find(n => n.status === 'available')

    characterLines.push({
      characterId: char.id,
      characterName: char.name,
      avatar: char.avatar,
      nodes,
      progress,
      gapCount,
      lockedCount,
      nextAvailableNode
    })
  }

  sharedNodes.sort((a, b) => a.day - b.day)

  return {
    characterLines,
    sharedEvents: sharedNodes,
    totalEvents,
    completedEvents,
    availableEvents,
    gapEvents,
    lockedEvents
  }
}

export function calculateGiftAffinity(
  giftId: string,
  character: CharacterConfig,
  giftPrice: number,
  mood: number
): number {
  let baseChange = giftPrice / 10

  if (isGiftLiked(giftId, character)) {
    baseChange *= 2
  } else if (isGiftDisliked(giftId, character)) {
    baseChange *= -0.5
  }

  const moodMultiplier = 0.6 + (mood / 150)
  baseChange *= moodMultiplier

  return Math.round(baseChange * 10) / 10
}
