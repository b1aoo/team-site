export const ALTERING_CAVE_ROTATION_ONE_INGAME_DAY = 82342
export const REAL_MS_PER_INGAME_DAY = 6 * 60 * 60 * 1000
export const IN_GAME_DAYS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']
export const DAY_OFFSET = 5
export const ALTERING_CAVE_MOVE_WARNINGS = {
  pineco: '会使用自爆 / 猛撞',
  mareep: '会使用猛撞',
  smeargle: '可能挣扎',
  snubbull: '会使用吼叫',
  shuppet: '会使用诅咒',
  absol: '可能携带生命宝珠',
  aron: '会使用吼叫',
}

export const ALTERING_CAVE_MOVE_SUMMARY = [
  {
    pokemon: 'Pineco',
    summary: '榛果球在 Lv.19 及以下会使用自爆和猛撞。请携带湿气特性的宝可梦，不要使用点到为止。',
  },
  {
    pokemon: 'Mareep',
    summary: '咩利羊会使用猛撞；请勿使用点到为止。',
  },
  {
    pokemon: 'Smeargle',
    summary: '图图犬会使用写生。换上捕捉手前先使用一次招式，否则它会开始挣扎。',
  },
  {
    pokemon: 'Snubbull',
    summary: '布鲁在 Lv.25 学会吼叫。请换上等级更高的宝可梦，避免它强制结束战斗。',
  },
  {
    pokemon: 'Aron',
    summary: '可可多拉在 Lv.23 及以下会使用吼叫。请换上等级更高的宝可梦，避免它强制结束战斗。',
  },
  {
    pokemon: 'Shuppet',
    summary: '怨影娃娃在 Lv.26 及以上会使用诅咒。可先用浸水使其不再是幽灵属性，或在它倒下前捕获。',
  },
  {
    pokemon: 'Absol',
    summary: '阿勃梭鲁有小概率携带生命宝珠；若携带，请勿使用点到为止。',
  },
]

export function getAlteringCaveMoveWarning(name) {
  return ALTERING_CAVE_MOVE_WARNINGS[String(name || '').trim().toLowerCase()] || ''
}

export function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor
}

export function getAlteringCaveRotationState(nowMs = Date.now()) {
  const inGameDay = Math.floor(nowMs / REAL_MS_PER_INGAME_DAY)
  const rotationIndex = positiveModulo(inGameDay - ALTERING_CAVE_ROTATION_ONE_INGAME_DAY, 7)
  const msIntoDay = positiveModulo(nowMs, REAL_MS_PER_INGAME_DAY)
  const msUntilSwap = REAL_MS_PER_INGAME_DAY - msIntoDay

  return {
    rotation: rotationIndex + 1,
    msUntilSwap,
  }
}

export function getMsUntilAlteringCaveRotation(targetRotation, rotationState = getAlteringCaveRotationState()) {
  const currentIndex = rotationState.rotation - 1
  const targetIndex = targetRotation - 1
  const rotationsUntilTarget = positiveModulo(targetIndex - currentIndex, 7)

  if (rotationsUntilTarget === 0) return 0

  return rotationState.msUntilSwap + (rotationsUntilTarget - 1) * REAL_MS_PER_INGAME_DAY
}

export function formatRotationDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}小时 ${String(minutes).padStart(2, '0')}分 ${String(seconds).padStart(2, '0')}秒`
  }

  return `${minutes}分 ${String(seconds).padStart(2, '0')}秒`
}
