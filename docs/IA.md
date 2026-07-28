# Central de IA

## O que já funciona

A página `pages/central-ia.html` funciona em dois modos:

- **Diagnóstico local:** disponível no GitHub Pages. Analisa os dados do navegador e responde perguntas básicas sobre estoque, compras, pedidos, fichas e financeiro.
- **IA online:** disponível após a implantação do backend no VPS. O servidor consulta dados agregados do PostgreSQL e envia somente esses indicadores à OpenAI.

A Central é somente consultiva. Ela não compra, não altera preços, não muda estoque, não cancela pedidos e não envia mensagens.

## Privacidade e segurança

- A chave da OpenAI fica somente no `.env` do VPS.
- A chave nunca deve ser colocada no HTML, JavaScript do navegador ou GitHub.
- Nomes, telefones, endereços e dados dos clientes não são enviados ao modelo.
- A API exige usuário autenticado com permissão de relatórios.
- Perguntas são limitadas por usuário e registradas no log de auditoria sem guardar o texto da pergunta.
- As chamadas usam `store: false`.

## Ativação no VPS

No arquivo `.env` privado do servidor:

```env
AI_ENABLED=true
OPENAI_API_KEY=coloque-a-chave-somente-no-vps
OPENAI_MODEL=gpt-5.6-luna
```

Depois:

```bash
docker compose build api
docker compose up -d api caddy
docker compose logs --tail=100 api
```

O modelo padrão foi escolhido para reduzir custo nas perguntas operacionais rotineiras. Antes de trocar o modelo, compare qualidade, tempo de resposta e gasto usando perguntas reais do restaurante.

## Limites da primeira versão

- A IA online depende do PostgreSQL ser a fonte principal das telas.
- A Central ainda não executa ações; futuras ações deverão gerar uma proposta e pedir confirmação.
- Previsão de demanda ficará mais confiável após algumas semanas de vendas reais.
- O custo da API da OpenAI é separado do ChatGPT e varia conforme o uso.

## Próximas evoluções

1. Previsão de compras por dia da semana.
2. Análise de margem por canal: balcão, WhatsApp e iFood.
3. Leitura inteligente de notas fiscais com conferência humana.
4. Sugestão de pausa de produto por falta de ingrediente.
5. Resumo diário automático com problemas, causas e próximos passos.
