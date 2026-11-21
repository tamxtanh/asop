import { config } from '../config';
import { supabase } from '../clients';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function notifySalesPhoneLead(params: {
  pageId: string;
  psid: string;
  customerName?: string;
  phone: string;
  latestText: string;
  summary?: string;
  isReorder?: boolean;
}) {
  const { data: page } = await supabase
    .from('pages')
    .select('page_name')
    .eq('page_id', params.pageId)
    .maybeSingle();

  const pageName = page?.page_name || `Page ${params.pageId}`;
  const inboxLink = `https://business.facebook.com/latest/inbox/all?asset_id=${params.pageId}`;
  const title = params.isReorder
    ? `🔥 <b>KHÁCH CŨ LIÊN HỆ LẠI - VÀO CHỐT TIẾP</b>`
    : `🔥 <b>KHÁCH ĐỂ LẠI SĐT - VÀO CHỐT ĐƠN</b>`;

  const text = [
    title,
    `• <b>Fanpage:</b> ${escapeHtml(pageName)}`,
    `• <b>Khách hàng:</b> ${escapeHtml(params.customerName || 'Khách Facebook')}`,
    `• <b>SĐT:</b> <code>${escapeHtml(params.phone)}</code>`,
    params.summary ? `• <b>Tóm tắt nhu cầu:</b> ${escapeHtml(params.summary)}` : '',
    `• <b>Tin mới nhất:</b> "${escapeHtml(params.latestText)}"`,
  ]
    .filter(Boolean)
    .join('\n');

  const reply_markup = {
    inline_keyboard: [
      [
        {
          text: '👉 Mở Inbox Facebook',
          url: inboxLink,
        },
      ],
      [
        {
          text: '✅ Đã chốt sale (Bật lại AI)',
          callback_data: `enable_ai:${params.pageId}:${params.psid}`,
        },
      ],
    ],
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup,
      }),
    });
    const result = (await res.json()) as any;
    if (!result?.ok) {
      console.error('[Telegram Notify Error]', result);
    } else {
      console.log(`[Telegram Notify Success] message_id=${result?.result?.message_id}`);
    }
  } catch (err) {
    console.error('[Telegram Send Error]', err);
  }
}

// Lắng nghe sự kiện bấm nút từ Telegram (Long Polling tự động, chạy 24/7 không phụ thuộc webhook tunnel)
let isPolling = false;
let offset = 0;

export async function startTelegramPolling() {
  if (isPolling) return;
  isPolling = true;
  console.log('[Telegram Poller] Đã khởi động lắng nghe nút bấm Telegram...');

  while (isPolling) {
    try {
      const url = `https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?offset=${offset}&timeout=25`;
      const res = await fetch(url);
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      const data = (await res.json()) as any;
      if (!data.ok || !Array.isArray(data.result)) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      for (const update of data.result) {
        offset = update.update_id + 1;

        if (update.callback_query) {
          await handleTelegramCallback(update.callback_query);
        }
      }
    } catch (err) {
      console.error('[Telegram Poller Error]', err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

async function handleTelegramCallback(query: any) {
  const data = String(query.data || '');
  const callbackId = query.id;
  const user = query.from;
  const userName = user?.first_name || user?.username || 'Sale';
  const message = query.message;

  if (data.startsWith('enable_ai:')) {
    const parts = data.split(':');
    const pageId = parts[1];
    const psid = parts[2];

    // 1. Cập nhật Supabase bật lại AI cho khách
    await supabase
      .from('conversations')
      .update({
        ai_enabled: true,
        handover_reason: 'sale_re-enabled',
        updated_at: new Date().toISOString(),
      })
      .eq('page_id', pageId)
      .eq('psid', psid);

    console.log(`[Telegram Action] Sale ${userName} đã bấm BẬT LẠI AI cho ${pageId}_${psid}`);

    // 2. Phản hồi thông báo Toast trên màn hình Telegram của Sale
    await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text: '✅ Đã chốt đơn & Bật lại AI cho khách thành công!',
        show_alert: false,
      }),
    });

    // 3. Cập nhật giao diện nút bấm thành trạng thái khóa (Disable nút chốt đơn)
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const originalKeyboard = message?.reply_markup?.inline_keyboard || [];
    const inboxRow = originalKeyboard[0] || [];

    const updatedKeyboard = {
      inline_keyboard: [
        inboxRow,
        [
          {
            text: `🔒 Đã chốt đơn & Bật lại AI (${userName} lúc ${timeStr})`,
            callback_data: 'already_done',
          },
        ],
      ],
    };

    if (message?.chat?.id && message?.message_id) {
      await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/editMessageReplyMarkup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: message.chat.id,
          message_id: message.message_id,
          reply_markup: updatedKeyboard,
        }),
      });
    }
  } else if (data === 'already_done') {
    await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text: 'ℹ️ Đơn này đã được xác nhận chốt và AI đã trực trở lại rồi.',
        show_alert: true,
      }),
    });
  }
}
