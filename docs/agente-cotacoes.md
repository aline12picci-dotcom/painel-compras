# Agente de Cotações — primeira entrega

A nova aba **Agente de Cotações** usa os dados importados da Pharmabag e cria processos na tabela `panel_entities` que já sustenta o painel. O tipo adicional `quote` guarda os processos; não há outro banco. O comprador seleciona SCs/itens, ajusta a mensagem, copia a cotação, registra cinco fornecedores, preenche preços e condições recebidas e imprime cotação/mapa em PDF.

## Ativação (nessa ordem)

1. Revisar e aplicar `supabase/migrations/20260925180000_allow_quote_entities.sql` na mesma base atual. A migração apenas permite `quote` no tipo de entidade existente; não apaga dados.
2. Implantar `supabase/functions/quote-sync/index.ts` como função `quote-sync` com verificação JWT desabilitada **somente porque a própria função revalida as credenciais Basic no `panel-sync`**; conferir essa configuração antes de liberar acesso. A chave de serviço permanece no ambiente Supabase e nunca no navegador.
3. Publicar a versão do painel no Vercel. `api/quotes.js` faz a ponte para a função protegida. Conferir que o proxy responda 401 sem credenciais e que o usuário autenticado consiga listar/salvar.
4. Importar novamente o Excel para preencher `codigoProduto`, `quantidade` e `um` das SCs já existentes, escolher dois itens de teste e verificar criação, reabertura em outra sessão, edição concorrente, totais, PDF e conclusão com PC.

## Comportamento e limites desta fase

- Somente a Pharmabag está habilitada; cada cotação possui ID único, lista própria de SCs/itens e controle de versão. O salvamento automático tenta persistir 2,2 s após a edição; conflitos impedem sobrescrever o trabalho de outro comprador.
- **Copiar a cotação não envia o e-mail e não registra envio.** O disparo no Outlook, confirmação de envio, monitoramento de retornos e follow-up serão conectados em fase própria, após autorização da integração Microsoft 365.
- Os PDFs dos fornecedores continuam sendo conferidos e lançados pelo comprador; não há extração automática nesta fase.
- O logo na mensagem utiliza URL pública do próprio painel. Clientes de e-mail podem bloquear imagens externas até o destinatário permitir o carregamento.
- Salvar PDF abre a janela de impressão. O comprador escolhe *Salvar como PDF* e anexa ao pedido no Protheus.
