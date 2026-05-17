import React, { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetOpenaiConversationQueryKey, getListOpenaiMessagesQueryKey, getListOpenaiConversationsQueryKey } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/api";

export function useChatStream(conversationId: number | null) {
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const queryClient = useQueryClient();

  const streamMessage = async (content: string) => {
    if (!conversationId) return;

    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/openai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        
        for (const line of lines) {
          if (line.trim() === "") continue;
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") continue; // Openai might send this
            
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                setStreamingContent((prev) => prev + data.content);
              }
              if (data.done) {
                // finished
              }
            } catch (e) {
              console.error("Error parsing stream JSON", e, dataStr);
            }
          }
        }
      }
    } catch (err) {
      console.error("Stream error", err);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      // Invalidate to fetch the final messages
      queryClient.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(conversationId) });
      queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(conversationId) });
      queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
    }
  };

  return { streamingContent, isStreaming, streamMessage };
}
