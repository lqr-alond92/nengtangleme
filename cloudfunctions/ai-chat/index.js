const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  };
}

function parseBody(event) {
  if (!event?.body) return {};
  if (typeof event.body === 'object') return event.body;
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

function parseJsonContent(content = '') {
  const text = String(content || '').trim();
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : text;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildAnalysisMessages(analysisInput) {
  return [
    {
      role: 'system',
      content: [
        '你是「能躺了吗」的家庭财务分析助手。你的任务不是输出复杂财务报表，而是把用户的家庭财务画像翻译成一份能看懂、能行动、能穿越时间的判断。',
        '',
        '核心术语：不要使用“净现值”“折现法”这类专业词。统一把未来结余折回今天的结果称为“未来收入的今天价值”。',
        '',
        '请严格基于用户画像和系统计算结果完成分析：',
        '1. 重构用户的真实可用资产：不要直接把固定资产算作可用资产。先展示“合起来能规划的钱 = 当前灵活资产 + 未来收入的今天价值”。再展示“扣掉已有负债后，真正能用于目标的钱 = 合起来能规划的钱 - 当前总负债”。',
        '2. 判断当前赚钱能力能否支撑未来目标：重点看债务后可规划资产、全部目标按今天算、必须目标和想要目标的缺口或余量。',
        '3. 明确长期规划风险和后续 Action：风险必须来自用户数据，Action 必须包含明确后续步骤和具体行动点。',
        '',
        '表达要求：',
        '- 用普通人能听懂的话。',
        '- 必须引用用户的关键数字。',
        '- headline 必须一针见血地回答两件事：当前赚钱能力能否支撑目标；长期规划风险大不大。',
        '- 不要使用“能不能躺”“不是不能躺”“马上能不能躺”这类话术。',
        '- 必须区分“账面资产”和“重构后真实可用资产”。',
        '- 必须说明全部目标是宽松、紧张还是有缺口。如果全部目标不能覆盖，要继续判断必要目标能否守住、想要目标还差多少。',
        '- 行动建议必须按“原因 / 目标 / 操作”分层，不要把月度、周度、预计时间拆成散落标签。',
        '- 行动建议必须使用月度或周度执行，不要只写年度动作。',
        '- followUpQuestions 必须根据用户实际情况动态生成，不要使用固定问题。',
        '- 不要输出七大比率长表，不要输出泛泛理财常识，不要承诺投资收益。',
        '- 不要制造恐慌，结尾要让用户知道下一步怎么做。',
        '',
        '只返回合法 JSON，不要 Markdown，不要解释 JSON。JSON 字段必须包括：',
        '{',
        '  "headline": "全部目标暂时达不成，先保必要目标，再重排想要目标。",',
        '  "intro": "我会把你未来每年能留下的钱，换算成未来收入的今天价值，再和现在手里的钱放在一起判断。",',
        '  "reconstructedAssets": {',
        '    "title": "重构后的真实资产",',
        '    "narrative": "这里不让你看复杂公式，只直接给两个关键结果。",',
        '    "planningPool": {',
        '      "label": "合起来能规划的钱",',
        '      "value": 10560000,',
        '      "description": "由现在手里的钱 15 万，加上未来收入的今天价值 1041 万组成。",',
        '      "parts": [{ "label": "现在手里的钱", "value": 150000 }, { "label": "未来收入的今天价值", "value": 10410000 }]',
        '    },',
        '    "debtAdjusted": {',
        '      "label": "扣掉已有负债后，真正能用于目标的钱",',
        '      "value": 6060000,',
        '      "debtDeducted": 4500000,',
        '      "description": "这个数才是后面判断未来目标够不够用的核心。"',
        '    }',
        '  },',
        '  "coreConclusion": {',
        '    "headline": "你的处境不是完全失控，而是目标池太满。",',
        '    "insight": "债务后可规划资产只有 606 万，而全部目标按今天算约 1022 万。",',
        '    "coverage": { "available": 6060000, "totalGoal": 10220000, "gapOrSurplus": -4160000, "status": "gap" },',
        '    "needGoal": { "label": "必要目标", "value": 5800000, "status": "covered", "description": "必要目标可以守住，但缓冲很薄。" },',
        '    "wantGoal": { "label": "想要目标", "value": 4420000, "status": "gap", "description": "想要目标需要延期、降配或重新排序。" }',
        '  },',
        '  "risks": [{ "title": "...", "reason": "...", "impact": "...", "action": "..." }],',
        '  "actions": {',
        '    "actionPoints": [{',
        '      "title": "补足应急资金",',
        '      "type": "setPlan",',
        '      "reason": "灵活资产不足，突发支出会直接打断长期规划。",',
        '      "goal": "从 15 万补到 25 万；按月结余的 10% 自动转入高流动性账户，现金流波动时改为每周小额转入。",',
        '      "buttonLabel": "设置计划",',
        '      "plan": {',
        '        "current": "15 万",',
        '        "target": "25 万",',
        '        "monthlyAction": "每月发薪后转入月结余的 10%",',
        '        "weeklyAction": "现金流波动时，每周固定小额转入",',
        '        "estimatedTime": "12-18 个月",',
        '        "checklist": ["本周开一个单独的应急资金账户", "下个发薪日开始自动转入", "每月底复核一次余额"]',
        '      }',
        '    }]',
        '  },',
        '  "followUpQuestions": ["...", "...", "..."]',
        '}',
        '',
        '字段约束：金额字段优先返回数字，单位为元；risks 最多 3 个；actions.actionPoints 最多 4 个；followUpQuestions 最多 3 个。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `这是用户的家庭财务画像和折现计算结果，请输出结构化分析：\n${JSON.stringify(analysisInput, null, 2)}`,
    },
  ];
}

exports.main = async (event = {}) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'POST';
  if (method === 'OPTIONS') return json(204, {});
  if (method !== 'POST') return json(405, { message: '只支持 POST 请求' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return json(500, { message: '服务端未配置 DEEPSEEK_API_KEY' });
  }

  const body = parseBody(event);
  const isAnalysis = body.type === 'analysis';
  const messages = isAnalysis ? buildAnalysisMessages(body.analysisInput || {}) : Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) {
    return json(400, { message: '缺少 messages' });
  }

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: isAnalysis ? 0.35 : 0.45,
    }),
  });

  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    return json(response.status, {
      message: data?.error?.message || data?.message || rawText || 'DeepSeek 调用失败',
    });
  }

  const content = data?.choices?.[0]?.message?.content || '';
  return json(200, {
    ...(isAnalysis ? { analysis: parseJsonContent(content) } : {}),
    content,
    usage: data?.usage || null,
    provider: 'DeepSeek',
    model: DEEPSEEK_MODEL,
  });
};
