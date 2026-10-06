var SEED = {
  npcs: [
    {
      code: 'FAQ_ANSWER',
      type: 'AGENT',
      usedFor: 'customer_service',
      displayName: '客服問答助手',
      avatar: '🧙',
      chatModel: { key: 'openai:gpt-5.5', version: 3, params: { temperature: 0.7, max_tokens: 1024 } },
      vectorModel: { key: 'text-embedding-3-small', version: 1, params: { dimensions: 1536 } },
      retrieval: { topK: 5, scoreThreshold: 0.7, maxContext: 4000 },
      publishedVersion: 2,
      variants: [
        { code: 'STANDARD', name: '一般版', publishedVersion: 2 },
        { code: 'PREMIUM', name: '豪華版', publishedVersion: 1 }
      ]
    },
    {
      code: 'ORDER_ASSIST',
      type: 'AGENT',
      usedFor: 'order_support',
      displayName: '訂單助手',
      avatar: '🧝',
      chatModel: null,
      vectorModel: null,
      retrieval: null,
      publishedVersion: null,
      variants: []
    },
    {
      code: 'INTENT_SWITCH',
      type: 'SWITCH',
      usedFor: 'routing',
      displayName: '意圖分流',
      avatar: '🧑‍💻',
      chatModel: null,
      vectorModel: null,
      retrieval: null,
      publishedVersion: null,
      variants: []
    }
  ],
  modelTemplates: {
    'openai:gpt-5.5': {
      type: 'chat',
      label: 'GPT-5.5 (OpenAI)',
      supportsTools: true,
      params: [
        { key: 'temperature', label: 'Temperature', kind: 'number', min: 0, max: 2, default: 0.7 },
        { key: 'max_tokens', label: 'Max Tokens', kind: 'number', min: 1, max: 8192, default: 1024 }
      ]
    },
    'bedrock:claude-sonnet-5.5': {
      type: 'chat',
      label: 'Claude Sonnet 5.5 (Bedrock)',
      supportsTools: true,
      params: [
        { key: 'temperature', label: 'Temperature', kind: 'number', min: 0, max: 1, default: 0.5 },
        { key: 'max_tokens', label: 'Max Tokens', kind: 'number', min: 1, max: 4096, default: 2048 }
      ]
    },
    'demo:chat-lite': {
      type: 'chat',
      label: 'Chat Lite（示範用，不支援工具呼叫）',
      supportsTools: false,
      params: [
        { key: 'temperature', label: 'Temperature', kind: 'number', min: 0, max: 1, default: 0.3 }
      ]
    },
    'text-embedding-3-small': {
      type: 'vector',
      label: 'text-embedding-3-small',
      params: [
        { key: 'dimensions', label: 'Dimensions', kind: 'enum', enumValues: [512, 1536], default: 1536 }
      ]
    }
  }
};

function cloneSeed() {
  return JSON.parse(JSON.stringify(SEED));
}
