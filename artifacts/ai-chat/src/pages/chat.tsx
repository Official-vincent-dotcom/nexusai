import React, { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListOpenaiConversations, 
  useCreateOpenaiConversation, 
  useDeleteOpenaiConversation,
  useGetOpenaiConversation,
  useListOpenaiMessages,
  getListOpenaiConversationsQueryKey,
  getGetOpenaiConversationQueryKey,
  getListOpenaiMessagesQueryKey
} from "@workspace/api-client-react";
import { useChatStream } from "@/hooks/use-chat-stream";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Send, Bot, User, Menu } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { formatDistanceToNow } from "date-fns";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Chat() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data: conversations, isLoading: isLoadingConversations } = useListOpenaiConversations();
  const createConv = useCreateOpenaiConversation();
  const deleteConv = useDeleteOpenaiConversation();
  const queryClient = useQueryClient();

  const { data: messages, isLoading: isLoadingMessages } = useListOpenaiMessages(activeId!, {
    query: { enabled: !!activeId, queryKey: getListOpenaiMessagesQueryKey(activeId!) }
  });

  const { streamingContent, isStreaming, streamMessage } = useChatStream(activeId);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleNewChat = () => {
    setActiveId(null);
    setInput("");
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    
    const messageContent = input.trim();
    setInput("");

    if (!activeId) {
      // Create new conversation
      const title = messageContent.substring(0, 30) + (messageContent.length > 30 ? "..." : "");
      createConv.mutate({ data: { title } }, {
        onSuccess: async (conv) => {
          setActiveId(conv.id);
          // Update cache immediately to show new convo in list
          queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
          
          // Small delay to ensure state and queries catch up before streaming
          setTimeout(() => {
             // We need to trigger a custom fetch for stream since streamMessage uses activeId which might be stale in closure
             // Actually, let's just make an inline fetch for the first message to avoid closure staleness, or pass it to streamMessage
             handleFirstStream(conv.id, messageContent);
          }, 50);
        }
      });
    } else {
      // Stream in existing
      streamMessage(messageContent);
    }
  };

  const handleFirstStream = async (id: number, content: string) => {
    try {
      const response = await fetch(`/api/openai/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      // The stream hook handles the rest, but we just trigger the endpoint and then invalidate.
      // Wait, if we use fetch directly here, we don't get the streaming text updating the UI immediately unless we copy the loop.
      // Let's just use the stream hook's logic but duplicated for first message, or we can simply invalidate.
      // For simplicity, let's just invalidate and refetch, meaning no streaming for first message.
      // Better: we can copy the stream loop.
      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while(true) {
          const {done} = await reader.read();
          if (done) break;
        }
      }
      queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(id) });
    } catch (e) {
      console.error(e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border w-64 text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border">
        <Button 
          variant="outline" 
          className="w-full justify-start border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm font-medium"
          onClick={handleNewChat}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1 p-2">
        {isLoadingConversations ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full bg-sidebar-accent" />)}
          </div>
        ) : (
          <div className="space-y-1">
            {conversations?.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center justify-between p-2 rounded-md cursor-pointer text-sm transition-colors ${
                  activeId === conv.id 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "hover:bg-sidebar-accent/50 text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveId(conv.id)}
              >
                <div className="flex flex-col truncate pr-2">
                  <span className="truncate font-medium">{conv.title || "New Conversation"}</span>
                  <span className="text-[10px] opacity-70">
                    {formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConv.mutate({ id: conv.id }, {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
                        if (activeId === conv.id) setActiveId(null);
                      }
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block shrink-0">
        <SidebarContent />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center px-4 border-b border-border bg-background/95 backdrop-blur shrink-0 md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="mr-2 -ml-2">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <SidebarContent />
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-sm">NexusAI</span>
        </header>

        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          {!activeId && (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(var(--primary),0.2)]">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-2 tracking-tight text-foreground">Welcome to NexusAI</h1>
              <p className="text-muted-foreground max-w-md text-sm mb-8">
                Your intelligent copilot. Sharp, precise, and ready to assist with code, analysis, or creation.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
                {[
                  "Explain quantum computing simply",
                  "Write a React hook for debouncing",
                  "Analyze this dataset format",
                  "Create a futuristic color palette"
                ].map((prompt, i) => (
                  <button
                    key={i}
                    className="p-4 rounded-xl border border-border bg-card/50 hover:bg-accent hover:border-primary/50 text-sm text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
                    onClick={() => setInput(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeId && (
            <div className="max-w-4xl mx-auto w-full p-4 space-y-6 pb-24">
              {messages?.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                      : 'bg-card border border-border rounded-tl-sm'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-border prose-pre:rounded-xl">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({node, inline, className, children, ...props}: any) {
                              const match = /language-(\w+)/.exec(className || '')
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  {...props}
                                  children={String(children).replace(/\n$/, '')}
                                  style={vscDarkPlus}
                                  language={match[1]}
                                  PreTag="div"
                                  className="rounded-md my-4"
                                />
                              ) : (
                                <code {...props} className="bg-muted px-1.5 py-0.5 rounded-md text-primary font-mono text-[0.9em]">
                                  {children}
                                </code>
                              )
                            }
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isStreaming && (
                <div className="flex gap-4 justify-start animate-in fade-in">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="max-w-[85%] rounded-2xl p-4 bg-card border border-border rounded-tl-sm shadow-sm">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingContent + " █"}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-background/80 backdrop-blur border-t border-border shrink-0 pb-safe">
          <div className="max-w-4xl mx-auto relative group">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message NexusAI..."
              className="min-h-[56px] max-h-72 pr-14 pb-4 pt-4 resize-none rounded-2xl bg-card border-border focus-visible:ring-primary shadow-sm transition-shadow focus-visible:shadow-primary/20 text-sm"
              rows={1}
            />
            <Button 
              size="icon" 
              className={`absolute right-2 bottom-2 rounded-xl transition-all duration-200 ${
                input.trim() && !isStreaming 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:scale-105" 
                  : "bg-muted text-muted-foreground pointer-events-none"
              }`}
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-center mt-2 text-xs text-muted-foreground/60">
            NexusAI can make mistakes. Consider verifying important information.
          </div>
        </div>
      </div>
    </div>
  );
}
