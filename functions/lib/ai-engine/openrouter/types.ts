export interface OpenRouterChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterChatRequest {
  model: string;
  messages: OpenRouterChatMessage[];
  response_format?: { type: "json_object" };
  temperature?: number;
  max_tokens?: number;
}

export interface OpenRouterChatResponse {
  id?: string;
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  error?: {
    message: string;
    code?: number | string;
  };
}
