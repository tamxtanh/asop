import { config } from '../config';

interface DifyResponse {
  conversation_id: string;
  answer: string;
}

export async function callDifyChat(params: {
  pageId: string;
  psid: string;
  query: string;
  conversationId?: string | null;
  imageUrls?: string[];
}): Promise<DifyResponse> {
  const files = (params.imageUrls || []).slice(0, 4).map((url) => ({
    type: 'image',
    transfer_method: 'remote_url',
    url,
  }));

  const body = {
    inputs: {
      query: params.query || '',
    },
    query: params.query || 'Khách hàng vừa gửi hình ảnh, hãy xem ảnh và tư vấn phù hợp.',
    response_mode: 'blocking',
    conversation_id: params.conversationId || '',
    user: `${params.pageId}_${params.psid}`,
    ...(files.length > 0 ? { files } : {}),
  };

  const res = await fetch(`${config.difyApiUrl}/chat-messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.difyApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Dify API error ${res.status}: ${errText}`);
  }

  return (await res.json()) as DifyResponse;
}
