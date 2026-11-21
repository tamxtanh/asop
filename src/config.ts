import 'dotenv/config';

function mustGet(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env variable: ${key}`);
  return val;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  supabaseUrl: mustGet('SUPABASE_URL'),
  supabaseKey: mustGet('SUPABASE_SERVICE_ROLE_KEY'),
  difyApiUrl: process.env.DIFY_API_URL || 'https://api.dify.ai/v1',
  difyApiKey: mustGet('DIFY_API_KEY'),
  pancakeUserToken: process.env.PANCAKE_USER_ACCESS_TOKEN || '',
  telegramBotToken: mustGet('TELEGRAM_BOT_TOKEN'),
  telegramChatId: mustGet('TELEGRAM_SALE_CHAT_ID'),
  debounceBaseMs: Number(process.env.DEBOUNCE_BASE_MS || 7000),
  debounceExtendMs: Number(process.env.DEBOUNCE_EXTEND_MS || 12000),
  debounceMaxWaitMs: Number(process.env.DEBOUNCE_MAX_WAIT_MS || 35000),
};
