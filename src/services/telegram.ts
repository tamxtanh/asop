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
}) {
  const { data: page } = await supabase
    .from('pages')
    .select('page_name')
    .eq('page_id', params.pageId)
    .maybeSingle();

  const pageName = page?.page_name || `Page ${params.pageId}`;
  const inboxLink = `https://business.facebook.com/latest/inbox/all?asset_id=${params.pageId}`;

  const text = [
    `🔥 <b>KHÁCH ĐỂ LẠI SĐT - VÀO CHỐT ĐƠN</b>`,
    `• <b>Fanpage:</b> ${escapeHtml(pageName)}`,
    `• <b>Khách hàng:</b> ${escapeHtml(params.customerName || 'Khách Facebook')}`,
    `• <b>SĐT:</b> <code>${escapeHtml(params.phone)}</code>`,
    params.summary ? `• <b>Tóm tắt nhu cầu:</b> ${escapeHtml(params.summary)}` : '',
    `• <b>Tin mới nhất:</b> "${escapeHtml(params.latestText)}"`,
    `👉 <a href="${inboxLink}">Mở hộp thư Facebook Page này ngay</a>`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
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
