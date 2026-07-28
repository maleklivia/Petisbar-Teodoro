import { createHash } from 'node:crypto';
import { config } from '../config.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function outputText(response) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text.trim();
  return (response.output || [])
    .flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text' && typeof item.text === 'string')
    .map(item => item.text)
    .join('\n')
    .trim();
}

function privacySafeIdentifier(userId) {
  return createHash('sha256').update(`petisbar:${userId}`).digest('hex');
}

export async function askOpenAI({ question, snapshot, userId }) {
  if (!config.AI_ENABLED || !config.OPENAI_API_KEY) throw new Error('ai_not_configured');

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.OPENAI_MODEL,
      store: false,
      safety_identifier: privacySafeIdentifier(userId),
      reasoning: { effort: 'low' },
      text: { verbosity: 'medium' },
      instructions: [
        'Você é a Central de IA operacional do restaurante Petisbar Teodoro.',
        'Responda em português do Brasil, de forma direta, prática e curta.',
        'Use somente os dados agregados fornecidos. Não invente vendas, preços, estoque ou clientes.',
        'Diferencie fatos, cálculos e recomendações. Explique brevemente a evidência.',
        'Nunca afirme ter realizado uma compra, alterado preço, cancelado pedido, enviado mensagem ou mudado estoque.',
        'Toda ação externa, financeira ou que altere dados exige aprovação humana.',
        'Se faltarem dados, diga exatamente quais dados precisam ser cadastrados.',
        'Não inclua dados pessoais nem peça senhas, chaves ou informações bancárias.',
      ].join(' '),
      input: `DADOS OPERACIONAIS:\n${JSON.stringify(snapshot)}\n\nPERGUNTA:\n${question}`,
      max_output_tokens: 900,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const error = new Error(`openai_${response.status}`);
    error.statusCode = response.status === 429 ? 429 : 502;
    throw error;
  }
  const data = await response.json();
  const answer = outputText(data);
  if (!answer) throw new Error('openai_empty_response');
  return { answer, responseId: data.id || null, model: data.model || config.OPENAI_MODEL };
}
