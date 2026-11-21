import { Worker } from 'bullmq';
import { config } from './config';
import {
  DEBOUNCE_QUEUE_NAME,
  DebounceJobData,
  debounceQueue,
  redis,
  supabase,
} from './clients';
import { callDifyChat } from './services/dify';
import { sendPancakeImageBySku, sendPancakeText } from './services/pancake';
import { notifySalesPhoneLead } from './services/telegram';
import {
  extractAiHandoverPhone,
  extractPhoneNumber,
  isLikelyIncomplete,
  parseBubbles,
} from './utils/text';

export interface BufferedMessage {
  text: string;
  images: string[];
  ts: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function startDebounceWorker() {
  const worker = new Worker<DebounceJobData>(
    DEBOUNCE_QUEUE_NAME,
    async (job) => {
      const { pageId, psid, customerName, gender, extended } = job.data;
      const baseKey = `chat:${pageId}:${psid}`;
      const bufKey = `${baseKey}:buf`;
      const verKey = `${baseKey}:ver`;
      const firstTsKey = `${baseKey}:first_ts`;

      // 1. Kiểm tra trạng thái AI trong DB (nếu đã tắt hẳn -> dừng và dọn buffer)
      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('page_id', pageId)
        .eq('psid', psid)
        .maybeSingle();

      if (conv && conv.ai_enabled === false) {
        await redis.del(bufKey, firstTsKey);
        return;
      }

      // 2. Snapshot toàn bộ tin trong buffer (CHƯA xóa ngay để chống mất tin nếu bị ngắt)
      const currentVer = await redis.get(verKey);
      const rawItems = await redis.lrange(bufKey, 0, -1);
      if (rawItems.length === 0) return;

      const messages: BufferedMessage[] = rawItems.map((s) => JSON.parse(s));
      const texts = messages.map((m) => m.text).filter(Boolean);
      const images = messages.flatMap((m) => m.images);
      const combinedText = texts.join('\n').trim();

      // 3. ADAPTIVE DEBOUNCE: Nếu mới gõ câu mào đầu hoặc mới thả ảnh và chưa vượt trần max_wait -> gia hạn chờ thêm
      const firstTs = Number((await redis.get(firstTsKey)) || Date.now());
      const waitedMs = Date.now() - firstTs;

      if (!extended && waitedMs < config.debounceMaxWaitMs && isLikelyIncomplete(texts, images)) {
        const extJobId = `debounce-${pageId}-${psid}-ext-${currentVer}`;
        await redis.set(`${baseKey}:last_job_id`, extJobId, 'EX', 120);
        await debounceQueue.add(
          'flush',
          { pageId, psid, customerName, extended: true },
          { jobId: extJobId, delay: config.debounceExtendMs }
        );
        return;
      }

      // 4. BẮT SĐT LỚP 1 (REGEX): Đã đủ thời gian chờ im lặng nên gom luôn câu dặn dò đi kèm
      const phone = extractPhoneNumber(combinedText);
      if (phone) {
        await supabase.from('conversations').upsert({
          page_id: pageId,
          psid,
          customer_name: customerName || conv?.customer_name,
          dify_conversation_id: conv?.dify_conversation_id || null,
          ai_enabled: false,
          handover_reason: 'phone_detected',
          phone_number: phone,
          updated_at: new Date().toISOString(),
        });

        await redis.del(bufKey, firstTsKey);

        // Nếu trước đó đã trò chuyện qua Dify, nhờ Dify tóm tắt nhanh 2 dòng cho Sale
        let summary = '';
        if (conv?.dify_conversation_id) {
          try {
            const sumRes = await callDifyChat({
              pageId,
              psid,
              conversationId: conv.dify_conversation_id,
              query:
                '[HỆ THỐNG NỘI BỘ - KHÔNG GỬI KHÁCH]: Tóm tắt ngắn gọn trong 2 câu nhu cầu vườn, cây trồng, sản phẩm khách quan tâm để chuyển nhân viên kỹ thuật gọi điện.',
            });
            summary = sumRes.answer.replace(/\|\|\|/g, ' ').trim();
          } catch {
            summary = '';
          }
        }

        await sendPancakeText(
          pageId,
          psid,
          `Em nhận được số ${phone} của mình rồi ạ. Em chuyển thông tin sang bạn kỹ thuật gọi trao đổi chi tiết cho anh/chị trong ít phút nữa nhé.`
        );

        const isReorder = conv?.handover_reason === 'sale_re-enabled' || Boolean(conv?.phone_number);
        await notifySalesPhoneLead({
          pageId,
          psid,
          customerName: customerName || conv?.customer_name,
          phone,
          latestText: combinedText,
          summary,
          isReorder,
        });
        return;
      }

      // 5. Gọi Dify Chatflow (truyền đúng conversation_id để nhớ 100% ngữ cảnh + ảnh Vision)
      const difyRes = await callDifyChat({
        pageId,
        psid,
        query: combinedText,
        conversationId: conv?.dify_conversation_id,
        imageUrls: images,
        customerName: customerName || conv?.customer_name,
        gender,
      });

      // Lưu/cập nhật conversation_id của Dify ngay lập tức
      await supabase.from('conversations').upsert({
        page_id: pageId,
        psid,
        customer_name: customerName || conv?.customer_name,
        dify_conversation_id: difyRes.conversation_id,
        ai_enabled: true,
        updated_at: new Date().toISOString(),
      });

      // 6. INTERRUPT GUARD: Kiểm tra xem trong lúc Dify đang chạy (~6s),
      //    khách có nhắn bồi thêm câu mới hoặc Sale có vừa nhắn tay không
      const latestVer = await redis.get(verKey);
      if (latestVer !== currentVer) {
        // Khách vừa nhắn bồi -> KHÔNG xóa buffer, KHÔNG gửi câu trả lời cũ;
        // Job mới của tin nhắn mới sẽ tự động gom cả cũ lẫn mới để trả lời 1 lần!
        return;
      }

      const { data: latestConv } = await supabase
        .from('conversations')
        .select('ai_enabled')
        .eq('page_id', pageId)
        .eq('psid', psid)
        .maybeSingle();

      if (latestConv && latestConv.ai_enabled === false) {
        await redis.del(bufKey, firstTsKey);
        return;
      }

      // Xóa đúng số phần tử đã xử lý khỏi buffer (an toàn tuyệt đối)
      await redis.ltrim(bufKey, rawItems.length, -1);
      const remaining = await redis.llen(bufKey);
      if (remaining === 0) await redis.del(firstTsKey);

      // 7. Kiểm tra SĐT Lớp 2 (khách viết bằng chữ hoặc gửi ảnh QR -> AI gắn thẻ ẩn)
      const { phone: aiPhone, cleanText } = extractAiHandoverPhone(difyRes.answer);
      const bubbles = parseBubbles(cleanText);

      // 8. Gửi lần lượt từng bong bóng chữ / hình ảnh với độ trễ tự nhiên
      for (let i = 0; i < bubbles.length; i++) {
        if (i > 0) {
          const prev = bubbles[i - 1];
          const delayMs =
            prev.type === 'text'
              ? Math.min(Math.max(prev.content.length * 25, 1000), 2500)
              : 1500;
          await sleep(delayMs);
        }

        const item = bubbles[i];
        if (item.type === 'text') {
          await sendPancakeText(pageId, psid, item.content);
        } else {
          await sendPancakeImageBySku(pageId, psid, item.sku);
        }
      }

      // Nếu AI phát hiện SĐT bằng chữ/QR -> khóa AI & báo Sale luôn
      if (aiPhone) {
        await supabase
          .from('conversations')
          .update({
            ai_enabled: false,
            handover_reason: 'phone_detected',
            phone_number: aiPhone,
            updated_at: new Date().toISOString(),
          })
          .eq('page_id', pageId)
          .eq('psid', psid);

        const isReorder = conv?.handover_reason === 'sale_re-enabled' || Boolean(conv?.phone_number);
        await notifySalesPhoneLead({
          pageId,
          psid,
          customerName: customerName || conv?.customer_name,
          phone: aiPhone,
          latestText: combinedText,
          isReorder,
        });
      }
    },
    {
      connection: { url: config.redisUrl },
      concurrency: 10,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[Worker Failed] job=${job?.id}`, err);
  });

  return worker;
}
