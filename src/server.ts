import Fastify from 'fastify';
import { config } from './config';
import { debounceQueue, redis, supabase } from './clients';
import { isAiSentMessage } from './services/pancake';
import { BufferedMessage, startDebounceWorker } from './worker';

const app = Fastify({ logger: true });

import fs from 'fs';

app.addHook('onRequest', async (req, reply) => {
  const line = `[${new Date().toISOString()}] ${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers)}\n`;
  fs.appendFileSync('webhook.log', line);
});

// Hỗ trợ tất cả Content-Type từ Botcake (chống lỗi 415 Unsupported Media Type và lỗi Empty Body)
app.addContentTypeParser(['application/json', 'text/plain', '*'], { parseAs: 'string' }, (req, body, done) => {
  const bodyStr = typeof body === 'string' ? body : '';
  fs.appendFileSync('webhook.log', `[${new Date().toISOString()}] Raw Body: ${bodyStr}\n`);
  if (!bodyStr || bodyStr.trim() === '') {
    return done(null, {});
  }
  try {
    done(null, JSON.parse(bodyStr));
  } catch {
    done(null, { rawText: bodyStr });
  }
});

// Hàm chuẩn hóa payload từ Pancake hoặc Botcake Webhook
function parsePancakeWebhook(body: any) {
  const pageId = String(
    body?.page_id ||
    body?.conversation?.page_id ||
    body?.fb_page_id ||
    body?.entry?.[0]?.id ||
    ''
  ).trim();

  // Xử lý message object hoặc string
  const msg = body?.message || body?.data || body;
  const messageId = String(
    (typeof msg === 'object' ? msg?.id : '') ||
    body?.message_id ||
    body?.mid ||
    ''
  );
  const senderId = String(
    (typeof msg === 'object' ? msg?.from?.id : '') ||
    body?.sender_id ||
    body?.psid ||
    ''
  );

  // Lấy PSID của khách hàng
  let psid = '';
  const convId = String(body?.conversation_id || (typeof msg === 'object' ? msg?.conversation_id : '') || '');
  if (body?.psid) {
    psid = String(body.psid);
  } else if (convId.includes('_')) {
    psid = convId.split('_')[1];
  } else if (senderId && senderId !== pageId) {
    psid = senderId;
  } else if (body?.customer?.fb_id) {
    psid = String(body.customer.fb_id);
  } else if (body?.user_id) {
    psid = String(body.user_id);
  }

  // Lấy nội dung tin nhắn dạng text
  let rawText = '';
  if (typeof body?.message === 'string') {
    rawText = body.message;
  } else if (typeof msg === 'object') {
    rawText = String(msg?.original_message || msg?.message || msg?.text || '');
  } else if (typeof msg === 'string') {
    rawText = msg;
  }
  rawText = rawText.replace(/<[^>]+>/g, '').trim();

  // Lấy hình ảnh nếu có
  const attachments: any[] = Array.isArray(msg?.attachments)
    ? msg.attachments
    : Array.isArray(body?.attachments)
    ? body.attachments
    : [];
  const imageUrls = attachments
    .filter((a) => a?.type === 'photo' || a?.type === 'image' || /\.(jpg|jpeg|png|webp)/i.test(a?.url || a?.file_url || ''))
    .map((a) => a.url || a.file_url)
    .filter(Boolean);

  // Tên khách hàng
  const customerName =
    body?.customer_name ||
    body?.customer?.name ||
    (typeof msg === 'object' && senderId !== pageId ? msg?.from?.name : undefined) ||
    undefined;

  const isOutgoingFromPage = Boolean(pageId && senderId && senderId === pageId);

  return { pageId, psid, messageId, rawText, imageUrls, customerName, isOutgoingFromPage };
}

app.get('/health', async () => ({ ok: true, status: 'healthy', timestamp: new Date().toISOString() }));

app.post('/webhook/pancake', async (req, reply) => {
  const body = req.body as any;

  // Log raw payload để đối chiếu trường dữ liệu từ Pancake
  app.log.info({ rawWebhook: body }, 'Received Pancake webhook');

  // Trả 200 OK ngay lập tức (<50ms) để Pancake không timeout/retry
  const parsed = parsePancakeWebhook(body);
  if (!parsed.pageId || !parsed.psid) {
    return reply.code(200).send({ ignored: 'missing_ids' });
  }

  // 1. Chống trùng Webhook bằng messageId (TTL 24h)
  if (parsed.messageId) {
    const dedup = await redis.set(`dedup:${parsed.messageId}`, '1', 'EX', 86400, 'NX');
    if (!dedup) return reply.code(200).send({ ignored: 'duplicate' });
  }

  const { pageId, psid, messageId, rawText, imageUrls, customerName, isOutgoingFromPage } = parsed;
  const baseKey = `chat:${pageId}:${psid}`;
  const lastJobKey = `${baseKey}:last_job_id`;

  // 2. NẾU LÀ TIN NHẮN CHIỀU ĐI TỪ PAGE -> PHÂN BIỆT AI GỬI HAY SALE GÕ TAY TRÊN FACEBOOK
  if (isOutgoingFromPage) {
    const sentByAi =
      (await isAiSentMessage(pageId, psid, messageId, rawText)) ||
      (imageUrls.length > 0 && Boolean(await redis.get(`ai_sending_media:${pageId}:${psid}`)));

    if (!sentByAi) {
      // Sale vừa mở Facebook/Pancake nhắn tay -> TẮT HẲN AI VĨNH VIỄN cho khách này
      await supabase.from('conversations').upsert({
        page_id: pageId,
        psid,
        ai_enabled: false,
        handover_reason: 'sale_manual_reply',
        updated_at: new Date().toISOString(),
      });

      // Xóa buffer và hủy job debounce đang chờ (nếu có)
      await redis.del(`${baseKey}:buf`, `${baseKey}:first_ts`);
      const oldJobId = await redis.get(lastJobKey);
      if (oldJobId) {
        const pendingJob = await debounceQueue.getJob(oldJobId);
        if (pendingJob) {
          const state = await pendingJob.getState();
          if (state === 'delayed' || state === 'waiting') {
            await pendingJob.remove();
          }
        }
      }
      app.log.info(`Sale took over manually -> Disabled AI for ${pageId}_${psid}`);
    }
    return reply.code(200).send({ ok: true });
  }

  // Bỏ qua nếu tin khách gửi không có cả chữ lẫn ảnh (VD: reaction, sticker rỗng)
  if (!rawText && imageUrls.length === 0) {
    return reply.code(200).send({ ignored: 'empty_content' });
  }

  // 3. Kiểm tra nhanh nếu khách này đã bị tắt AI -> bỏ qua luôn, không đẩy vào Redis
  const { data: conv } = await supabase
    .from('conversations')
    .select('ai_enabled')
    .eq('page_id', pageId)
    .eq('psid', psid)
    .maybeSingle();

  if (conv && conv.ai_enabled === false) {
    return reply.code(200).send({ ignored: 'ai_disabled' });
  }

  // 4. Đẩy tin (Text + Ảnh) vào Redis Buffer & tăng Version
  const item: BufferedMessage = { text: rawText, images: imageUrls, ts: Date.now() };
  await redis.rpush(`${baseKey}:buf`, JSON.stringify(item));
  await redis.set(`${baseKey}:first_ts`, String(Date.now()), 'EX', 120, 'NX');
  const version = await redis.incr(`${baseKey}:ver`);

  // 5. TRUE ROLLING DEBOUNCE: Hủy job cũ (nếu đang đợi) và đặt lại đồng hồ mới
  const oldJobId = await redis.get(lastJobKey);
  if (oldJobId) {
    const existingJob = await debounceQueue.getJob(oldJobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === 'delayed' || state === 'waiting') {
        await existingJob.remove();
      }
    }
  }

  // Tính thời gian chờ còn lại theo trần max_wait (35s)
  const firstTs = Number((await redis.get(`${baseKey}:first_ts`)) || Date.now());
  const remainingMax = Math.max(0, config.debounceMaxWaitMs - (Date.now() - firstTs));
  const delay = Math.min(config.debounceBaseMs, remainingMax);

  const newJobId = `debounce-${pageId}-${psid}-v${version}`;
  await redis.set(lastJobKey, newJobId, 'EX', 120);

  await debounceQueue.add(
    'flush',
    { pageId, psid, customerName, extended: false },
    { jobId: newJobId, delay }
  );

  return reply.code(200).send({ queued: true, version, delay });
});

async function bootstrap() {
  startDebounceWorker();
  await app.listen({ port: config.port, host: '0.0.0.0' });
}

bootstrap().catch((err) => {
  app.log.error(err);
  process.exit(1);
});
