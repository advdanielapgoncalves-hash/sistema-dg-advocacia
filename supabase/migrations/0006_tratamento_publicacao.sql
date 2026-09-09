-- Pedido 09/09: a aba "Publicações" (intimações) deve funcionar como no Astrea
-- — ao abrir uma publicação não tratada, a pessoa escolhe entre "agendar
-- prazo" (cria o prazo direto a partir da intimação) ou "descartar" (marca
-- como andamento irrelevante, sem gerar prazo). Depois de qualquer uma das
-- duas opções, a publicação some da lista de pendentes.
--
-- revisado_por/revisado_em (já existentes, migração 0001) continuam sendo o
-- carimbo de "isso já foi tratado" — usado nas duas colunas novas abaixo pra
-- registrar QUAL das duas ações foi tomada e, se foi prazo, qual prazo.

alter table andamentos_processuais
  add column tratamento text check (tratamento in ('prazo_agendado', 'descartado')),
  add column prazo_id uuid references prazos (id) on delete set null,
  -- motivo opcional digitado ao descartar (ex: "já constava, duplicado") —
  -- não sobrescreve a descrição original da publicação (essa vem do DJEN/
  -- DataJud e não deve ser alterada).
  add column descricao_tratamento text;

comment on column andamentos_processuais.tratamento is
  'Ação escolhida ao tratar a publicação: prazo_agendado (gerou um prazo, ver prazo_id) ou descartado (marcada como irrelevante, sem prazo). Nulo = ainda não tratada.';
comment on column andamentos_processuais.prazo_id is
  'Prazo criado a partir desta publicação, quando tratamento = prazo_agendado.';
comment on column andamentos_processuais.descricao_tratamento is
  'Motivo/observação opcional informado ao descartar a publicação como irrelevante.';
