const VN_PHONE_REGEX = /(?<!\d)(?:\+?84|0)(?:3|5|7|8|9)(?:[\s.\-]*\d){8}(?!\d)/g;

export function extractPhoneNumber(text: string): string | null {
  const matches = text.match(VN_PHONE_REGEX);
  if (!matches || matches.length === 0) return null;
  const cleaned = matches[0].replace(/[\s.\-]/g, '');
  if (cleaned.startsWith('+84')) return '0' + cleaned.slice(3);
  if (cleaned.startsWith('84')) return '0' + cleaned.slice(2);
  return cleaned;
}

export function extractAiHandoverPhone(aiText: string): {
  phone: string | null;
  cleanText: string;
} {
  const match = aiText.match(/\[HANDOVER_PHONE:\s*([0-9+\s.-]+)\]/i);
  const cleanText = aiText.replace(/\[HANDOVER_PHONE:[^\]]*\]/gi, '').trim();
  const phone = match ? extractPhoneNumber(match[1]) : null;
  return { phone, cleanText };
}

// Kiểm tra xem tin nhắn gom được có phải mới là câu mào đầu chưa đủ ý không
const INCOMPLETE_OPENERS = [
  /^(shop|ad|em|bạn|anh|chị)?\s*(ơi|oi|ạ|a|nhé|nha)?[.!?]*$/i,
  /^(alo|hello|hi|chào|chao)(\s+(shop|em|bạn|ad))?[.!?]*$/i,
  /^(cho\s+(anh|chị|mình|em)\s+hỏi|tư\s+vấn(\s+giúp)?|hỏi\s+chút)[.!?]*$/i,
];

export function isLikelyIncomplete(texts: string[], imageUrls: string[]): boolean {
  const joined = texts.join(' ').trim();
  // Khách mới gửi mỗi ảnh mà chưa nhắn câu hỏi nào -> chờ thêm ít giây xem có gõ tiếp không
  if (!joined && imageUrls.length > 0) return true;
  if (!joined) return true;
  if (joined.length <= 18 && INCOMPLETE_OPENERS.some((rx) => rx.test(joined))) {
    return true;
  }
  return false;
}

export type BubbleItem =
  | { type: 'text'; content: string }
  | { type: 'image'; sku: string };

export function parseBubbles(rawAnswer: string): BubbleItem[] {
  const parts = rawAnswer
    .split('|||')
    .map((p) => p.trim())
    .filter(Boolean);

  const items: BubbleItem[] = [];
  for (const part of parts) {
    const imgMatch = part.match(/^\[SEND_IMAGE:\s*([A-Z0-9_-]+)\]$/i);
    if (imgMatch) {
      items.push({ type: 'image', sku: imgMatch[1].toUpperCase() });
      continue;
    }
    // Trường hợp LLM lỡ để lẫn thẻ ảnh chung dòng với chữ
    const inlineImg = part.match(/\[SEND_IMAGE:\s*([A-Z0-9_-]+)\]/i);
    if (inlineImg) {
      const textOnly = part.replace(/\[SEND_IMAGE:[^\]]*\]/gi, '').trim();
      if (textOnly) items.push({ type: 'text', content: textOnly });
      items.push({ type: 'image', sku: inlineImg[1].toUpperCase() });
    } else {
      items.push({ type: 'text', content: part });
    }
  }
  return items;
}
