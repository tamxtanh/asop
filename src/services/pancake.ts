import crypto from 'crypto';
import { config } from '../config';
import { redis, supabase } from '../clients';

function hashText(text: string): string {
  return crypto.createHash('md5').update(text.trim()).digest('hex');
}

export async function getPageAccessToken(pageId: string): Promise<string> {
  const cacheKey = `pancake:token:${pageId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  // 1. Kiểm tra trong bảng pages trên Supabase trước
  const { data: pageRow } = await supabase
    .from('pages')
    .select('pancake_page_token')
    .eq('page_id', pageId)
    .maybeSingle();

  if (pageRow?.pancake_page_token) {
    await redis.set(cacheKey, pageRow.pancake_page_token, 'EX', 3600);
    return pageRow.pancake_page_token;
  }

  // 2. Tự động generate token từ User Access Token của Pancake
  if (!config.pancakeUserToken) {
    throw new Error(`Pancake page token for page ${pageId} not found in Supabase and PANCAKE_USER_ACCESS_TOKEN not set.`);
  }

  const url = `https://pages.fm/api/v1/pages/${pageId}/generate_page_access_token?access_token=${config.pancakeUserToken}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = (await res.json()) as { page_access_token?: string };

  if (!data.page_access_token) {
    throw new Error(`Cannot get Pancake page_access_token for page ${pageId}`);
  }

  await redis.set(cacheKey, data.page_access_token, 'EX', 3600);
  return data.page_access_token;
}

// Đánh dấu tin nhắn AI vừa gửi để Webhook phân biệt với tin Sale gõ tay trên Facebook
async function markAiSent(pageId: string, psid: string, msgId?: string, text?: string) {
  if (msgId) {
    await redis.set(`ai_sent_id:${pageId}:${msgId}`, '1', 'EX', 180);
  }
  if (text) {
    await redis.set(`ai_sent_hash:${pageId}:${psid}:${hashText(text)}`, '1', 'EX', 120);
  }
}

export async function isAiSentMessage(
  pageId: string,
  psid: string,
  msgId?: string,
  text?: string
): Promise<boolean> {
  if (msgId) {
    const byId = await redis.get(`ai_sent_id:${pageId}:${msgId}`);
    if (byId) return true;
  }
  if (text) {
    const byHash = await redis.get(`ai_sent_hash:${pageId}:${psid}:${hashText(text)}`);
    if (byHash) return true;
  }
  return false;
}

export async function sendPancakeText(pageId: string, psid: string, message: string) {
  const token = await getPageAccessToken(pageId);
  const conversationId = `${pageId}_${psid}`;

  // Đánh dấu trước bằng hash để chống race condition nếu Webhook về nhanh hơn API response
  await markAiSent(pageId, psid, undefined, message);

  const url = `https://pages.fm/api/public_api/v1/pages/${pageId}/conversations/${conversationId}/messages?access_token=${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'reply_inbox',
      message,
    }),
  });

  const data = (await res.json()) as { data?: { id?: string }; id?: string };
  const sentId = data?.data?.id || data?.id;
  if (sentId) await markAiSent(pageId, psid, String(sentId));
}

export async function sendPancakeImageBySku(pageId: string, psid: string, sku: string) {
  const { data: product } = await supabase
    .from('products')
    .select('image_url, name')
    .eq('sku', sku)
    .maybeSingle();

  if (!product?.image_url) return;

  const token = await getPageAccessToken(pageId);
  const conversationId = `${pageId}_${psid}`;

  // Kiểm tra cache content_id trong Redis trước (TTL 24h) để tránh upload lại nhiều lần
  const cacheKey = `pancake:content_id:${pageId}:${sku}`;
  let contentId = await redis.get(cacheKey);

  if (!contentId) {
    try {
      // 1. Tải binary ảnh từ Supabase Storage
      const imgRes = await fetch(product.image_url);
      if (!imgRes.ok) throw new Error(`Fetch image failed: ${imgRes.status}`);
      const arrayBuffer = await imgRes.arrayBuffer();

      // 2. Upload dạng multipart/form-data lên Pancake API
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([arrayBuffer], { type: 'image/png' }),
        `${sku}.png`
      );

      const uploadUrl = `https://pages.fm/api/public_api/v1/pages/${pageId}/upload_contents?access_token=${token}`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
      });

      const uploadData = (await uploadRes.json()) as { id?: string; content_id?: string; success?: boolean };
      contentId = uploadData.content_id || uploadData.id || null;

      if (contentId) {
        await redis.set(cacheKey, contentId, 'EX', 86400);
      }
    } catch (err) {
      console.error(`[Upload Image Failed] sku=${sku}`, err);
    }
  }

  const msgUrl = `https://pages.fm/api/public_api/v1/pages/${pageId}/conversations/${conversationId}/messages?access_token=${token}`;

  // Đánh dấu khóa ảnh AI vừa gửi (TTL 30s) để webhook chiều đi không nhận nhầm là Sale gửi ảnh tay
  await redis.set(`ai_sending_media:${pageId}:${psid}`, '1', 'EX', 30);

  const payload = contentId
    ? { action: 'reply_inbox', content_ids: [contentId] }
    : { action: 'reply_inbox', message: product.image_url };

  const res = await fetch(msgUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { data?: { id?: string }; id?: string };
  const sentId = data?.data?.id || data?.id;
  if (sentId) await markAiSent(pageId, psid, String(sentId));
}
