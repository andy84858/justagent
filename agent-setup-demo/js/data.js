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
        { code: 'STANDARD', name: '一般版', publishedVersion: 2, description: '客服的一般版本，查得到訂單狀態。', baseInstructions: '請用親切的語氣回答客戶問題，優先查詢訂單狀態。', equippedEquipment: [{ name: 'order-lookup', level: 1 }], wornGems: [], publishHistory: [{ version: 2, publishedAt: '2026-09-01T00:00:00.000Z' }, { version: 1, publishedAt: '2026-08-01T00:00:00.000Z' }] },
        { code: 'PREMIUM', name: '豪華版', publishedVersion: 1, description: '豪華版客服，可以直接幫客戶退款。', baseInstructions: '請用親切的語氣回答客戶問題，必要時可直接建立退款單。', equippedEquipment: [], wornGems: [{ name: 'create_refund', level: 1 }] }
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
  },
  gems: [
    {
      name: 'get_order_status', displayName: '查詢訂單狀態', kind: 'API', protocol: 'REST',
      versions: [
        { level: 1, status: 'published', copiedFromLevel: null },
        { level: 2, status: 'published', copiedFromLevel: 1 },
        { level: 3, status: 'published', copiedFromLevel: 2 },
        { level: 4, status: 'draft', copiedFromLevel: 3 }
      ]
    },
    {
      name: 'create_refund', displayName: '建立退款單', kind: 'API', protocol: 'REST',
      versions: [{ level: 1, status: 'published', copiedFromLevel: null }]
    },
    {
      name: 'run_sql_query', displayName: 'SQL 查詢', kind: 'API', protocol: 'REST',
      versions: [{ level: 1, status: 'published', copiedFromLevel: null }, { level: 2, status: 'published', copiedFromLevel: 1 }]
    },
    {
      name: 'render_chart', displayName: '產生圖表', kind: 'API', protocol: 'REST',
      versions: [{ level: 1, status: 'published', copiedFromLevel: null }]
    }
  ],
  equipment: [
    {
      name: 'order-lookup', displayName: '訂單查詢術',
      versions: [
        { level: 1, status: 'published', copiedFromLevel: null, gems: [{ gemName: 'get_order_status', level: 1 }] },
        { level: 2, status: 'published', copiedFromLevel: 1, gems: [{ gemName: 'get_order_status', level: 2 }] }
      ]
    },
    {
      name: 'refund-helper', displayName: '退款小幫手',
      versions: [{ level: 1, status: 'published', copiedFromLevel: null, gems: [{ gemName: 'create_refund', level: 1 }] }]
    },
    {
      name: 'sql-analysis', displayName: 'SQL 分析術',
      versions: [
        { level: 1, status: 'published', copiedFromLevel: null, gems: [{ gemName: 'run_sql_query', level: 1 }] },
        { level: 2, status: 'published', copiedFromLevel: 1, gems: [{ gemName: 'run_sql_query', level: 2 }] }
      ]
    }
  ],
  bundles: [],
  extensions: []
};

function cloneSeed() {
  return JSON.parse(JSON.stringify(SEED));
}
