import { SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MarketNavbar } from "@/components/localloop/MarketNavbar";
import { PageShell } from "@/components/localloop/PageShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { type ChatMessage, createChatMessage, listChatMessages } from "@/lib/api";

type UiMessage = {
  id: string;
  fromMe: boolean;
  text: string;
  time: string;
};

type TokenPayload = {
  sub?: string;
};

type Conversation = {
  chatId: string;
  counterpartUserId: string;
  title: string;
  subtitle: string;
  updatedAt: string;
};

const decodeTokenPayload = (token: string): TokenPayload | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded) as TokenPayload;
  } catch {
    return null;
  }
};

const makeDirectChatId = (productId: string, userA: string, userB: string): string => {
  const [first, second] = [userA, userB].sort();
  const source = `${productId}|${first}|${second}`;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  const productPart = productId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toLowerCase();
  const hashPart = hash.toString(36);
  return `chat-${productPart}-${hashPart}`;
};

const formatTime = (isoDate: string): string => new Date(isoDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const toUiMessage = (msg: ChatMessage, myUserId: string): UiMessage => ({
  id: msg.message_id,
  fromMe: msg.sender_user_id === myUserId,
  text: msg.message,
  time: formatTime(msg.created_at),
});

const Chat = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("productId") || "";
  const sellerId = searchParams.get("sellerId") || "";
  const buyerId = searchParams.get("buyerId") || "";
  const sellerName = searchParams.get("sellerName") || "Seller";
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChatId, setSelectedChatId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [lastError, setLastError] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

  const myUserId = useMemo(() => {
    const token = localStorage.getItem("localloop_id_token");
    if (!token) {
      return "";
    }
    const payload = decodeTokenPayload(token);
    return payload?.sub || "";
  }, []);

  const counterpartUserId = useMemo(() => {
    if (!myUserId) {
      return "";
    }
    if (sellerId && myUserId !== sellerId) {
      return sellerId;
    }
    if (buyerId && myUserId !== buyerId) {
      return buyerId;
    }
    return "";
  }, [buyerId, myUserId, sellerId]);

  const deepLinkedChatId = useMemo(() => {
    if (!productId || !myUserId || !counterpartUserId) {
      return "";
    }
    return makeDirectChatId(productId, myUserId, counterpartUserId);
  }, [counterpartUserId, myUserId, productId]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.chatId === selectedChatId) ?? null,
    [conversations, selectedChatId],
  );

  const canUseChat = Boolean(selectedConversation?.counterpartUserId && selectedConversation.chatId);

  const refreshInbox = useCallback(async () => {
    if (!myUserId) {
      setLastError("Please login to access chat.");
      setConversations([]);
      setMessages([]);
      setIsLoading(false);
      return;
    }

    try {
      const [sent, received] = await Promise.all([
        listChatMessages({ senderUserId: myUserId }),
        listChatMessages({ recipientUserId: myUserId }),
      ]);

      const deduped = new Map<string, ChatMessage>();
      [...sent, ...received].forEach((msg) => {
        deduped.set(msg.message_id, msg);
      });

      const grouped = new Map<string, ChatMessage[]>();
      deduped.forEach((msg) => {
        const bucket = grouped.get(msg.chat_id) || [];
        bucket.push(msg);
        grouped.set(msg.chat_id, bucket);
      });

      let nextConversations: Conversation[] = Array.from(grouped.entries()).map(([chatId, chatMessages]) => {
        const sorted = [...chatMessages].sort((a, b) => a.created_at.localeCompare(b.created_at));
        const latest = sorted[sorted.length - 1];
        const sample = sorted.find((m) => m.sender_user_id !== myUserId || m.recipient_user_id !== myUserId) || latest;
        const counterpart = sample.sender_user_id === myUserId ? sample.recipient_user_id : sample.sender_user_id;

        return {
          chatId,
          counterpartUserId: counterpart,
          title: counterpart ? `User ${counterpart.slice(0, 8)}` : "Unknown user",
          subtitle: latest.message,
          updatedAt: latest.created_at,
        };
      });

      if (deepLinkedChatId && counterpartUserId) {
        const exists = nextConversations.some((conversation) => conversation.chatId === deepLinkedChatId);
        if (!exists) {
          nextConversations = [
            {
              chatId: deepLinkedChatId,
              counterpartUserId,
              title: sellerName,
              subtitle: "Start conversation",
              updatedAt: new Date().toISOString(),
            },
            ...nextConversations,
          ];
        } else {
          nextConversations = nextConversations.map((conversation) =>
            conversation.chatId === deepLinkedChatId
              ? {
                  ...conversation,
                  title: sellerName,
                }
              : conversation,
          );
        }
      }

      nextConversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setConversations(nextConversations);

      const hasSelection = nextConversations.some((conversation) => conversation.chatId === selectedChatId);
      if (!hasSelection) {
        setSelectedChatId(deepLinkedChatId || nextConversations[0]?.chatId || "");
      }

      setLastError("");
    } catch (error: unknown) {
      setLastError(error instanceof Error ? error.message : "Unable to load conversations.");
      setConversations([]);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [counterpartUserId, deepLinkedChatId, myUserId, selectedChatId, sellerName]);

  const refreshMessages = useCallback(async () => {
    if (!selectedChatId) {
      setMessages([]);
      return;
    }

    try {
      const apiMessages = await listChatMessages({ chatId: selectedChatId });
      setMessages(apiMessages.map((msg) => toUiMessage(msg, myUserId)));
      setLastError("");
    } catch (error: unknown) {
      setLastError(error instanceof Error ? error.message : "Unable to load messages.");
      setMessages([]);
    }
  }, [myUserId, selectedChatId]);

  useEffect(() => {
    void refreshInbox();
  }, [refreshInbox]);

  useEffect(() => {
    void refreshMessages();
  }, [refreshMessages]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshInbox();
      void refreshMessages();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [refreshInbox, refreshMessages]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text) {
      return;
    }

    if (!canUseChat) {
      toast({
        title: "Conversation unavailable",
        description: "Open chat from a listing to message the other user.",
        variant: "destructive",
      });
      return;
    }

    if (!myUserId) {
      toast({
        title: "Login required",
        description: "Please login to send chat messages.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSending(true);
      await createChatMessage({
        chat_id: selectedConversation.chatId,
        recipient_user_id: selectedConversation.counterpartUserId,
        message: text,
      });
      setMessage("");
      await refreshInbox();
      await refreshMessages();
    } catch (error: unknown) {
      toast({
        title: "Unable to send",
        description: error instanceof Error ? error.message : "Please login and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen">
      <MarketNavbar />
      <PageShell>
        <div className="glass grid min-h-[72vh] rounded-2xl md:grid-cols-[280px_1fr]">
          <aside className="border-b border-border/70 p-4 md:border-b-0 md:border-r">
            <h2 className="mb-4 text-lg font-semibold">Chats</h2>
            <div className="space-y-2">
              {!isLoading && conversations.length === 0 ? <p className="text-sm text-muted-foreground">No conversations yet.</p> : null}
              {conversations.map((conversation) => (
                <button
                  key={conversation.chatId}
                  className={`w-full rounded-xl p-3 text-left transition-smooth ${
                    conversation.chatId === selectedChatId ? "bg-secondary" : "hover:bg-secondary/70"
                  }`}
                  onClick={() => setSelectedChatId(conversation.chatId)}
                >
                  <p className="font-medium">{conversation.title}</p>
                  <p className="truncate text-sm text-muted-foreground">{conversation.subtitle}</p>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex flex-col">
            <div className="border-b border-border/70 p-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src="https://i.pravatar.cc/100?img=12" alt={selectedConversation?.title || "Chat"} />
                  <AvatarFallback>{(selectedConversation?.title || "CH").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedConversation?.title || "Select conversation"}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation ? "Direct buyer-seller chat" : "Choose a conversation from the left"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {isLoading ? <p className="text-sm text-muted-foreground">Loading messages...</p> : null}
              {!isLoading && lastError ? <p className="text-sm text-destructive">{lastError}</p> : null}
              {!isLoading && !lastError && messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
              ) : null}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-2 ${msg.fromMe ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                    <p className="text-sm">{msg.text}</p>
                    <p className={`mt-1 text-[11px] ${msg.fromMe ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{msg.time}</p>
                  </div>
                </div>
              ))}
              <div ref={endOfMessagesRef} />
            </div>

            <form className="flex gap-2 border-t border-border/70 p-3" onSubmit={onSendMessage}>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="rounded-full"
                disabled={isSending || !canUseChat}
              />
              <Button
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isSending || !message.trim() || !canUseChat}
              >
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </form>
          </section>
        </div>
      </PageShell>
    </div>
  );
};

export default Chat;
