import { config } from '../config';
import { supabase } from '../clients';

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
    `• <b>Fanpage:</b> ${pageName}`,
    `• <b>Khách hàng:</b> ${params.customerName || 'Khách Facebook'}`,
    `• <b>SĐT:</b> <code>${params.phone}</code>`,
    params.summary ? `• <b>Tóm tắt nhu cầu:</b> ${params.summary}` : '',
    `• <b>Tin mới nhất:</b> "${params.latestText}"`,
    `👉 <a href="${inboxLink}">Mở hộp thư Facebook Page này ngay</a>`,
  ]
    .filter(Boolean)
    .join('\n');

  await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
}
