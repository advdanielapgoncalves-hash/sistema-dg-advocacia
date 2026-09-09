-- Pedido da Daniela (09/09): relatório quinzenal por e-mail pro cliente,
-- com base no DJEN (Diário de Justiça Eletrônico Nacional), mostrando só
-- movimentações "relevantes" (decisões/sentenças, petição inicial e
-- contestação, réplica/manifestações, acórdãos) — não cada andamento
-- burocrático do processo.
--
-- IMPORTANTE, registrado aqui pra não se perder o motivo (mesma disciplina
-- já usada pro DataJud, ver 0002_processo_partes.sql): pesquisei a API
-- pública do DJEN (comunicaapi.pje.jus.br) mas não consegui confirmar
-- direto na documentação oficial do CNJ/PJe porque o domínio bloqueia
-- acesso de fora do Brasil (mesmo bloqueio já visto em cnj.jus.br e
-- esaj.tjsp.jus.br) — usei fontes de terceiros que descrevem a API oficial.
-- Essas fontes descrevem o DJEN como cobrindo o que o TRIBUNAL comunica às
-- partes (despachos, decisões, sentenças, acórdãos) — não necessariamente a
-- petição inicial ou a contestação, que são peças que as PARTES protocolam.
-- Por isso o relatório combina duas fontes: DJEN (para decisões/sentenças/
-- acórdãos, com o teor completo do ato) e os MOVIMENTOS do DataJud (que já
-- estão sincronizados nesta tabela desde a Fase 5, e cobrem oficialmente a
-- juntada de inicial/contestação/réplica pela Tabela Processual Unificada
-- do CNJ). Ver src/lib/djen.ts e src/lib/classificacaoAndamento.ts.

-- Permite a nova origem 'djen' nos andamentos (a constraint de check não
-- tem nome fixo garantido, por isso busca dinamicamente antes de trocar —
-- mais seguro do que arriscar um nome errado contra o banco real).
do $$
declare
  nome_constraint text;
begin
  select con.conname into nome_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
  where rel.relname = 'andamentos_processuais'
    and con.contype = 'c'
    and att.attname = 'origem';

  if nome_constraint is not null then
    execute format('alter table andamentos_processuais drop constraint %I', nome_constraint);
  end if;
end $$;

alter table andamentos_processuais
  add constraint andamentos_processuais_origem_check check (origem in ('manual', 'datajud', 'djen'));

alter table andamentos_processuais
  -- id da comunicação no DJEN, só preenchido pra origem='djen' — usado pra
  -- deduplicar (a API não garante que uma nova consulta não repita algo já
  -- visto antes).
  add column djen_id text,
  -- Classificação por palavra-chave (NÃO é uma classificação oficial do
  -- CNJ) usada só pra decidir o que entra no relatório quinzenal do
  -- cliente. Ver src/lib/classificacaoAndamento.ts pras categorias e a
  -- lógica — e pro aviso de que isso é uma aproximação, não uma garantia.
  add column categoria_relatorio text check (
    categoria_relatorio in (
      'peticao_inicial', 'contestacao', 'replica_manifestacao', 'decisao', 'sentenca', 'acordao', 'outro'
    )
  ),
  add column relevante_relatorio boolean not null default false;

create unique index andamentos_djen_id_idx on andamentos_processuais (djen_id) where djen_id is not null;
create index andamentos_relevante_relatorio_idx on andamentos_processuais (relevante_relatorio, data_andamento)
  where relevante_relatorio;

-- Um rascunho/relatório quinzenal por cliente e por período. Pedido dela:
-- ela REVISA antes de enviar (não é automático) — por isso o status
-- começa em 'rascunho', ela pode complementar com "conteudo_adicional"
-- (ex: tratativas internas que ela queira incluir) e só vira 'enviado'
-- quando ela mesma clicar em enviar.
create table relatorios_clientes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado')),
  -- Texto montado automaticamente a partir dos andamentos relevantes do
  -- período (ver src/lib/relatorioCliente.ts) — nunca reescrito/resumido
  -- por interpretação livre, só a descrição/teor tal como capturado, pra
  -- não correr o risco de alterar o sentido de uma decisão.
  conteudo_gerado text not null default '',
  -- Texto que a Daniela adiciona na revisão (ex: tratativas internas,
  -- observações) — entra no e-mail junto com o conteúdo gerado.
  conteudo_adicional text,
  enviado_em timestamptz,
  enviado_por uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (cliente_id, periodo_inicio, periodo_fim)
);

alter table relatorios_clientes enable row level security;

-- Mesma trava de 'clientes' (é dado de relacionamento com o cliente, não
-- financeiro nem operacional puro) — cliente do portal não tem policy de
-- leitura aqui, então não vê os próprios relatórios dentro do sistema (só
-- recebe por e-mail).
create policy "relatorios_clientes_rw" on relatorios_clientes for all using (
  has_permission('clientes')
) with check (has_permission('clientes'));
