/**
 * Chat ao vivo — aluno ou monitor conversando com o professor da sua turma.
 * Detecta sozinho se quem está logado é aluno ou monitor (tenta os dois
 * tokens salvos no navegador) e resolve automaticamente o professor certo —
 * não precisa escolher com quem falar.
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import {
  Send, MessageCircle, ArrowLeft, Loader2, Circle, AlertCircle
} from "lucide-react";

export default function ChatLive() {
  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Aceita sessão de aluno OU de monitor — o que estiver salvo no navegador.
  const sessionToken =
    localStorage.getItem("student_session_token") ||
    localStorage.getItem("monitor_session_token") ||
    "";

  const { data: conversationData, isLoading: conversationLoading, isError: conversationError } =
    trpc.chat.getMyConversation.useQuery({ sessionToken }, { enabled: !!sessionToken });

  const conversationId = conversationData?.conversationId ?? null;

  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = trpc.chat.getMessages.useQuery(
    { sessionToken, conversationId: conversationId || 0, limit: 50 },
    { enabled: !!sessionToken && !!conversationId }
  );

  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setMessageText("");
      refetchMessages();
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar: ${error.message}`);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Atualiza a cada 3s enquanto a conversa estiver aberta
  useEffect(() => {
    if (!conversationId) return;
    const interval = setInterval(() => refetchMessages(), 3000);
    return () => clearInterval(interval);
  }, [conversationId, refetchMessages]);

  const handleSendMessage = async () => {
    if (!conversationId || !messageText.trim()) return;
    setIsSending(true);
    try {
      await sendMessageMutation.mutateAsync({ sessionToken, conversationId, content: messageText.trim() });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) handleSendMessage();
  };

  // Sem sessão nenhuma (nem aluno, nem monitor) — pede pra fazer login
  if (!sessionToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-sm">
          <AlertCircle size={40} className="mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-display font-semibold text-lg text-foreground mb-2">Faça login primeiro</h3>
          <p className="text-sm text-muted-foreground mb-4">Entre como aluno ou monitor para conversar com o professor.</p>
          <Link href="/login-aluno">
            <Button className="w-full">Ir para o login</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (conversationLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (conversationError || (conversationData && !conversationData.conversationId)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-sm">
          <AlertCircle size={40} className="mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-display font-semibold text-lg text-foreground mb-2">Chat indisponível</h3>
          <p className="text-sm text-muted-foreground">
            {conversationData?.message || "Não foi possível encontrar o professor da sua turma."}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <Link href="/leaderboard" className="p-2 hover:bg-secondary rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-muted-foreground" />
        </Link>
        <div>
          <h3 className="font-display font-semibold text-foreground">
            Chat com {conversationData?.teacherName || "o professor"}
          </h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Circle size={6} className="fill-green-500 text-green-500" />
            Mensagens verificadas a cada poucos segundos
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-2xl w-full mx-auto">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Card className="p-6 text-center max-w-sm">
              <MessageCircle size={32} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
              <p className="text-xs text-muted-foreground mt-1">Comece a conversa com uma mensagem</p>
            </Card>
          </div>
        ) : (
          messages.map((message: any) => {
            const isMine = message.senderType === "student" || message.senderType === "monitor";
            return (
              <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-none"
                      : "bg-secondary text-foreground rounded-bl-none"
                  }`}
                >
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

      {/* Message Input */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2 max-w-2xl w-full mx-auto">
          <Textarea
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem... (Ctrl+Enter para enviar)"
            className="min-h-[44px] max-h-[120px] resize-none"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isSending || sendMessageMutation.isPending || !messageText.trim()}
            size="lg"
            className="flex items-center justify-center gap-2"
          >
            {isSending || sendMessageMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}