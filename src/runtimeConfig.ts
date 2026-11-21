import { config } from './config';
import { redis } from './clients';

export interface RuntimeConfig {
  debounceBaseMs: number;
  debounceExtendMs: number;
  debounceMaxWaitMs: number;
  minBubbleDelayMs: number;
  maxBubbleDelayMs: number;
  charDelayMs: number;
}

export const defaultRuntimeConfig: RuntimeConfig = {
  debounceBaseMs: Number(process.env.DEBOUNCE_BASE_MS || 3000), // Rút ngắn từ 7s xuống 3s mặc định
  debounceExtendMs: Number(process.env.DEBOUNCE_EXTEND_MS || 4000), // Rút ngắn từ 12s xuống 4s
  debounceMaxWaitMs: Number(process.env.DEBOUNCE_MAX_WAIT_MS || 15000), // Rút ngắn trần từ 35s xuống 15s
  minBubbleDelayMs: 800,
  maxBubbleDelayMs: 2000,
  charDelayMs: 20,
};

const RUNTIME_CONFIG_KEY = 'system:runtime_config';

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const raw = await redis.get(RUNTIME_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultRuntimeConfig, ...parsed };
    }
  } catch (err) {
    console.error('[RuntimeConfig] Read error, fallback to defaults', err);
  }
  return defaultRuntimeConfig;
}

export async function setRuntimeConfig(patch: Partial<RuntimeConfig>): Promise<RuntimeConfig> {
  const current = await getRuntimeConfig();
  const merged: RuntimeConfig = {
    debounceBaseMs: Math.max(1000, Number(patch.debounceBaseMs ?? current.debounceBaseMs)),
    debounceExtendMs: Math.max(1000, Number(patch.debounceExtendMs ?? current.debounceExtendMs)),
    debounceMaxWaitMs: Math.max(3000, Number(patch.debounceMaxWaitMs ?? current.debounceMaxWaitMs)),
    minBubbleDelayMs: Math.max(200, Number(patch.minBubbleDelayMs ?? current.minBubbleDelayMs)),
    maxBubbleDelayMs: Math.max(500, Number(patch.maxBubbleDelayMs ?? current.maxBubbleDelayMs)),
    charDelayMs: Math.max(5, Number(patch.charDelayMs ?? current.charDelayMs)),
  };

  await redis.set(RUNTIME_CONFIG_KEY, JSON.stringify(merged));
  console.log('[RuntimeConfig] Updated:', merged);
  return merged;
}
