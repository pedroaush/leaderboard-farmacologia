/**
 * Chat do Professor — inbox com todas as conversas de alunos e monitores.
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  Send, MessageCircle, ArrowLeft, Loader2, Circle, GraduationCap, Shield
} from "lucide-react";

export default function TeacherChat() {
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const teacherToken = localStorage.getItem("teacherSessionToken") || "";

  const { data: conversations = [], isLoading: conversationsLoading, refetch: refetchConversations } =
    trpc.chat.getTeacherConversations.useQuery({ teacherSessionToken: teacherToken }, { enabled: !!teacherToken, refetchInterval: 10000 });

  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = trpc.chat.getMessages.useQuery(
    { sessionToken: teacherToken, conversationId: selectedConversation || 0, limit: 50 },
    { enabled: !!teacherToken && !!selectedConversation }
  );

  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setMessageText("");
      refetchMessages();
      refetchConversations();
    },
    onError: (error: any) => toast.error(`Erro ao enviar: ${error.message}`),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedConversation) return;
    const interval = setInterval(() => refetchMessages(), 3000);
    return () => clearInterval(interval);
  }, [selectedConversation, refetchMessages]);

  const handleSendMessage = async () => {
    if (!selectedConversation || !messageText.trim()) return;
    setIsSending(true);
    try {
      await sendMessageMutation.mutateAsync({ sessionToken: teacherToken, conversationId: selectedConversation, content: messageText.trim() });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) handleSendMessage();
  };

  if (!teacherToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <MessageCircle size={40} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-foreground font-medium mb-2">Faça login como professor</p>
          <Link href="/professor/login" className="text-primary text-sm hover:underline">Ir para o login</Link>
        </div>
      </div>
    );
  }

  const activeConversation = conversations.find((c: any) => c.id === selectedConversation);

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Conversations List */}
      <div className={`w-full lg:w-80 border-r border-border flex flex-col ${selectedConversation ? "hidden lg:flex" : ""}`}>
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Link href="/admin/professor" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 className="font-display font-bold text-lg text-foreground">Conversas</h2>
            <p className="text-xs text-muted-foreground">Chat com alunos e monitores</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="p-4 text-center">
              <Loader2 size={24} className="mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center">
              <MessageCircle size={32} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma conversa iniciada ainda</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {conversations.map((conversation: any) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedConversation === conversation.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-secondary text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {conversation.personType === "monitor" ? <Shield size={13} /> : <GraduationCap size={13} />}
                    <span className="font-medium text-sm truncate">{conversation.personName}</span>
                    {conversation.unreadCount > 0 && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs truncate ${selectedConversation === conversation.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {conversation.lastMessagePreview || "Sem mensagens"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedConversation(null)} className="p-2 hover:bg-secondary rounded-lg transition-colors lg:hidden">
                <ArrowLeft size={20} className="text-muted-foreground" />
              </button>
              <div>
                <h3 className="font-display font-semibold text-foreground">{activeConversation?.personName}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Circle size={6} className="fill-green-500 text-green-500" />
                  {activeConversation?.personType === "monitor" ? "Monitor" : "Aluno"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messagesLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
              </div>
            ) : (
              messages.map((message: any) => {
                const isMine = message.senderType === "teacher";
                return (
                  <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${isMine ? "bg-primary text-primary-foreground rounded-br-none" : "bg-secondary text-foreground rounded-bl-none"}`}>
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {new Date(message.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem... (Ctrl+Enter para enviar)"
                className="min-h-[44px] max-h-[120px] resize-none flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={isSending || sendMessageMutation.isPending || !messageText.trim()}
                className="px-4 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {isSending || sendMessageMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <div className="text-center max-w-sm">
            <MessageCircle size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-display font-semibold text-lg text-foreground mb-2">Selecione uma Conversa</h3>
            <p className="text-sm text-muted-foreground">Escolha uma conversa na lista para ver e responder as mensagens</p>
          </div>
        </div>
      )}
    </div>
  );
}
