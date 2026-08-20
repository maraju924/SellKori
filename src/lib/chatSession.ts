import type { Message } from '../types';
import type { CollectedOrderInfo } from './chatOrder';

const MAX_STORED_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 4_000;

export interface ChatSession {
  messages: Message[];
  summary: string;
  collected: CollectedOrderInfo;
  orderPlacedId: string;
}

const EMPTY_SESSION: ChatSession = {
  messages: [],
  summary: '',
  collected: {},
  orderPlacedId: '',
};

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Message>;
  return (
    typeof candidate.id === 'string'
    && (candidate.role === 'user' || candidate.role === 'assistant')
    && typeof candidate.content === 'string'
    && candidate.content.length > 0
    && candidate.content.length <= MAX_MESSAGE_LENGTH
    && typeof candidate.timestamp === 'number'
    && Number.isFinite(candidate.timestamp)
  );
}

export function chatSessionKey(businessId: string) {
  return `sellkori_chat_${businessId}`;
}

export function loadChatSession(storage: Pick<Storage, 'getItem'>, businessId: string): ChatSession {
  try {
    const raw = storage.getItem(chatSessionKey(businessId));
    if (!raw) return { ...EMPTY_SESSION, collected: {} };

    const parsed = JSON.parse(raw) as Partial<ChatSession>;
    const messages = Array.isArray(parsed.messages)
      ? parsed.messages.filter(isMessage).slice(-MAX_STORED_MESSAGES)
      : [];

    return {
      messages,
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, MAX_MESSAGE_LENGTH) : '',
      collected: parsed.collected && typeof parsed.collected === 'object' ? parsed.collected : {},
      orderPlacedId: typeof parsed.orderPlacedId === 'string' ? parsed.orderPlacedId.slice(0, 120) : '',
    };
  } catch {
    return { ...EMPTY_SESSION, collected: {} };
  }
}

export function saveChatSession(
  storage: Pick<Storage, 'setItem'>,
  businessId: string,
  session: ChatSession,
) {
  const messages = session.messages
    .filter(isMessage)
    .slice(-MAX_STORED_MESSAGES)
    .map(({ id, role, content, timestamp, aiMetadata }) => ({
      id,
      role,
      content,
      timestamp,
      ...(aiMetadata ? { aiMetadata } : {}),
    }));

  storage.setItem(chatSessionKey(businessId), JSON.stringify({
    ...session,
    messages,
  }));
}

export function clearChatSession(storage: Pick<Storage, 'removeItem'>, businessId: string) {
  storage.removeItem(chatSessionKey(businessId));
  // Remove the legacy memory entry so a reset is complete.
  storage.removeItem(`sellkori_mem_${businessId}`);
}

