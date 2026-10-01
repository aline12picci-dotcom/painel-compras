# Agente de Cotações — primeira entrega

A nova aba **Agente de Cotações** usa os dados importados da Pharmabag e da Phal Ind e cria processos na tabela `panel_entities` que já sustenta o painel. O tipo adicional `quote` guarda os processos; não há outro banco. O comprador seleciona SCs/itens, ajusta a mensagem, copia a cotação, registra cinco fornecedores, preenche preços e condições recebidas e imprime cotação/mapa em PDF.

## Ativação (nessa ordem)

1. Revisar e aplicar `supabase/migrations/20260925180000_allow_quote_entities.sql` na mesma base atual. A migração apenas permite `quote` no tipo de entidade existente; não apaga dados.
2. Implantar `supabase/functions/quote-sync/index.ts` como função `quote-sync` com verificação JWT desabilitada **somente porque a própria função revalida as credenciais Basic no `panel-sync`**; conferir essa configuração antes de liberar acesso. A chave de serviço permanece no ambiente Supabase e nunca no navegador.
3. Publicar a versão do painel no Vercel. `api/quotes.js` faz a ponte para a função protegida. Conferir que o proxy responda 401 sem credenciais e que o usuário autenticado consiga listar/salvar.
4. Importar novamente o Excel para preencher `codigoProduto`, `quantidade` e `um` das SCs já existentes, escolher dois itens de teste e verificar criação, reabertura em outra sessão, edição concorrente, totais, PDF e conclusão com PC.

## Comportamento e limites desta fase

- Pharmabag e Phal Ind estão habilitadas; a seleção de empresa filtra itens e processos salvos, e cada template utiliza os dados corporativos correspondentes; cada cotação possui ID único, lista própria de SCs/itens e controle de versão. O salvamento automático tenta persistir 2,2 s após a edição; conflitos impedem sobrescrever o trabalho de outro comprador.
- **Copiar a cotação não envia o e-mail e não registra envio.** O disparo no Outlook, confirmação de envio, monitoramento de retornos e follow-up serão conectados em fase própria, após autorização da integração Microsoft 365.
- Os PDFs dos fornecedores continuam sendo conferidos e lançados pelo comprador; não há extração automática nesta fase.
- O logo na mensagem utiliza URL pública do próprio painel. Clientes de e-mail podem bloquear imagens externas até o destinatário permitir o carregamento.
- Salvar PDF abre a janela de impressão. O comprador escolhe *Salvar como PDF* e anexa ao pedido no Protheus.

## Expansão em 01/10/2026

Clinutri e Nutriente podem selecionar itens importados, salvar processos, registrar fornecedores e montar mapas. Seus dados fiscais, contatos e logotipos foram informados por Aline e cadastrados; os templates usam os endereços corporativos informados como padrão de entrega (editáveis por processo) e recebimento das 08:30 às 11:30 e das 13:30 às 16:30. A preparação do envio e cópia da cotação exigem os dados corporativos completos para evitar usar o cabeçalho de outra empresa. Nome/e-mail são editáveis na área de envio e sincronizados com os campos do mapa sem recriar o campo durante a digitação.

## HTML, prazos e follow-up — 01/10/2026

O botão copia `text/html` e abre o Outlook com destinatário/assunto, sem corpo em texto simples. O comprador cola com Ctrl+V, revisa, envia e confirma no painel. A confirmação salva destinatário, prazo, data/hora, responsável e itens consultados no histórico do processo; atualiza os itens abertos correspondentes da SC para Em cotação por meio da sincronização existente. Preparar/abrir rascunho não altera a SC.

O acompanhamento por empresa classifica envios confirmados como dentro do prazo, em atraso ou resposta registrada. Respostas são registradas manualmente e têm data/hora de registro, não detecção automática. FUP é preparado em HTML para atrasados sem resposta, enviado no Outlook e confirmado pelo comprador, preservando histórico e contagem. Não há envio automático, leitura da caixa, Microsoft Graph ou novo banco nesta entrega.
