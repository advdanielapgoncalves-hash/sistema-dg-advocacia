-- ============================================================================
-- Daniela Gonçalves Advocacia — schema inicial
-- ============================================================================
-- Este arquivo é pensado para ser colado no SQL Editor do painel do Supabase
-- (ou rodado via `supabase db push` se ela vier a usar a CLI). Cria as tabelas,
-- os papéis de acesso e as políticas de Row Level Security (RLS) que garantem
-- que funcionário não vê Financeiro e cliente só vê o próprio processo — a
-- trava fica no banco, não só escondida na tela.

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PERFIS DE USUÁRIO (estende auth.users do Supabase)
-- ----------------------------------------------------------------------------

create type user_role as enum ('admin', 'funcionario', 'cliente');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null default 'funcionario',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Cria automaticamente uma linha em profiles sempre que alguém é criado em
-- auth.users (ex: quando a Daniela cadastra um funcionário na tela de
-- Configurações, que por trás chama a Admin API do Supabase para criar o
-- login e passa full_name/role em user_metadata).
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'funcionario')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Permissões por módulo, configuráveis por usuário na tela de Configurações.
-- Uma linha ausente cai no padrão do papel (ver função has_permission abaixo).
create table profile_permissions (
  profile_id uuid not null references profiles (id) on delete cascade,
  module text not null check (module in ('clientes', 'processos', 'prazos', 'tarefas', 'financeiro', 'configuracoes')),
  can_access boolean not null default true,
  primary key (profile_id, module)
);

-- ----------------------------------------------------------------------------
-- 2. CLIENTES
-- ----------------------------------------------------------------------------

create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome_completo text not null,
  cpf_cnpj text,
  telefone text,
  email text,
  endereco text,
  -- se preenchido, é o login do portal do cliente (auth.users/profiles com role='cliente')
  portal_profile_id uuid references profiles (id) on delete set null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. PROCESSOS E ANDAMENTOS
-- ----------------------------------------------------------------------------

create table processos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  numero_processo text not null,
  -- descrição livre do processo (ex: "Ação de cobrança — honorários em aberto"),
  -- pedida pela Daniela como coluna própria na tela Operacional, separada de
  -- tipo_acao (que serve de matéria/classificação e não aparece nessa tabela).
  descricao text,
  tipo_acao text,
  vara_comarca text,
  status text not null default 'ativo' check (status in ('ativo', 'suspenso', 'concluido', 'arquivado')),
  responsavel_id uuid references profiles (id),
  monitoramento_diario_oficial boolean not null default false,
  -- processo em segredo de justiça: publicação pública (DataJud/Escavador/
  -- Judit/qualquer Diário Oficial) NÃO alcança esses processos — só quem é
  -- advogado(a) habilitado(a) no processo, autenticado no portal do próprio
  -- tribunal, consegue ver. Esse flag marca que o andamento desse processo
  -- precisa vir de lá (ver tabela credenciais_tribunal), não do Diário.
  segredo_justica boolean not null default false,
  tribunal_sistema text check (tribunal_sistema in ('esaj', 'pje', 'eproc', 'projudi')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- Credenciais de acesso ao portal do tribunal (ex: e-SAJ), guardadas só pra
-- consultar processos em segredo de justiça em nome da própria pessoa
-- (cada advogado(a) só enxerga o que o tribunal já libera pra ela/ele —
-- isso não contorna sigilo de ninguém, só automatiza o que a pessoa já
-- poderia ver manualmente logando ela mesma).
--
-- A senha NUNCA fica em texto puro aqui — vem cifrada (AES-256-GCM) pelo
-- código da aplicação antes de chegar no banco, com a chave de
-- criptografia guardada só na variável de ambiente do servidor
-- (CREDENTIALS_ENCRYPTION_KEY), nunca no banco nem enviada ao navegador.
-- A própria pessoa pode ver que TEM uma credencial cadastrada (e quando foi
-- salva), mas isso só devolve o texto cifrado, ilegível sem a chave do
-- servidor — a tela nunca chama a função de decifrar.
create table credenciais_tribunal (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  tribunal_sistema text not null check (tribunal_sistema in ('esaj', 'pje', 'eproc', 'projudi')),
  identificador text not null, -- CPF/CNPJ ou usuário de login no portal
  segredo_cifrado text not null, -- senha cifrada (ver src/lib/crypto.ts)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, tribunal_sistema)
);

create table andamentos_processuais (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references processos (id) on delete cascade,
  data_andamento date not null,
  descricao text not null,
  origem text not null default 'manual' check (origem in ('manual', 'datajud')),
  -- 'intimacao' é o andamento que exige atenção/ação (prazo a cumprir); 'andamento'
  -- é só um registro informativo do processo. Separado para a tela poder filtrar
  -- só o que precisa ser revisado/delegado na semana.
  tipo text not null default 'andamento' check (tipo in ('andamento', 'intimacao')),
  -- data em que o ESTE SISTEMA recebeu/capturou o registro (diferente de
  -- data_andamento, que é a data do evento no processo em si). Para origem
  -- 'datajud' será preenchida automaticamente pela integração (Fase 5, ainda não
  -- construída); para origem 'manual' é preenchida por quem cadastra. É o campo
  -- que permite listar "as intimações que chegaram esta semana".
  data_push timestamptz not null default now(),
  -- controle de revisão/delegação: permite Daniela marcar que já olhou a
  -- intimação e, se for o caso, apontar pra tarefa criada a partir dela.
  revisado_por uuid references profiles (id),
  revisado_em timestamptz,
  created_at timestamptz not null default now()
);

create index andamentos_data_push_idx on andamentos_processuais (data_push) where tipo = 'intimacao';

-- ----------------------------------------------------------------------------
-- 4. PRAZOS E TAREFAS
-- ----------------------------------------------------------------------------

create table prazos (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos (id) on delete cascade,
  cliente_id uuid references clientes (id),
  tipo text not null,
  descricao text,
  data_vencimento date not null,
  responsavel_id uuid references profiles (id),
  status text not null default 'pendente' check (status in ('pendente', 'concluido')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  prazo_id uuid references prazos (id) on delete set null,
  responsavel_id uuid not null references profiles (id),
  atribuido_por uuid references profiles (id),
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida')),
  data_limite date,
  created_at timestamptz not null default now()
);

-- liga a intimação/andamento à tarefa criada a partir dela (delegação). Vem
-- depois da criação de "tarefas" porque a referência só existe a partir daqui.
alter table andamentos_processuais
  add column tarefa_id uuid references tarefas (id) on delete set null;

-- Apontamento de horas (timesheet): pedido pela Daniela de duas formas —
-- (1) tempo lançado dentro de uma tarefa específica (tarefa_id preenchido),
-- (2) lançamento avulso, só descrição + tempo, opcionalmente vinculado a um
-- prazo (prazo_id) sem precisar de uma tarefa. Os dois casos são a mesma
-- tabela; tarefa_id e prazo_id são independentes e ambos opcionais.
create table apontamentos_tempo (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  minutos int not null check (minutos > 0),
  data date not null default current_date,
  tarefa_id uuid references tarefas (id) on delete set null,
  prazo_id uuid references prazos (id) on delete set null,
  profile_id uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

-- Relatório de atendimento por cliente: todo contato com o cliente (ligação,
-- e-mail, reunião, WhatsApp etc.) fica registrado aqui, pra qualquer pessoa da
-- equipe conseguir assumir o caso e ver o histórico — não é visível no portal
-- do cliente (é uso interno do escritório).
create table atendimentos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  data timestamptz not null default now(),
  tipo text,
  descricao text not null,
  registrado_por uuid references profiles (id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. FINANCEIRO
-- ----------------------------------------------------------------------------

create table financeiro_lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrada', 'saida')),
  descricao text not null,
  cliente_id uuid references clientes (id),
  categoria text,
  valor numeric(12, 2) not null,
  data date not null,
  criado_por uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table financeiro_parcelas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes (id) on delete cascade,
  processo_id uuid references processos (id),
  descricao text not null,
  numero_parcela int not null default 1,
  total_parcelas int not null default 1,
  valor numeric(12, 2) not null,
  forma_recebimento text,
  data_vencimento date not null,
  status text not null default 'a_vencer' check (status in ('a_vencer', 'atrasado', 'pago')),
  data_pagamento date,
  created_at timestamptz not null default now()
);

create table metas_financeiras (
  id uuid primary key default gen_random_uuid(),
  mes date not null unique,
  valor_meta numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. FUNÇÕES AUXILIARES PARA AS POLÍTICAS DE RLS
-- ----------------------------------------------------------------------------

create function my_role()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- Resolve a permissão efetiva de um módulo: usa a linha em profile_permissions
-- se existir; senão cai no padrão do papel (admin sempre true, cliente sempre
-- false para módulos internos, funcionário true em tudo menos financeiro).
create function has_permission(p_module text)
returns boolean as $$
  select coalesce(
    (select can_access from profile_permissions where profile_id = auth.uid() and module = p_module),
    case
      when my_role() = 'admin' then true
      when my_role() = 'cliente' then false
      when my_role() = 'funcionario' and p_module = 'financeiro' then false
      when my_role() = 'funcionario' and p_module = 'configuracoes' then false
      else true
    end
  );
$$ language sql stable security definer set search_path = public;

create function my_cliente_id()
returns uuid as $$
  select id from clientes where portal_profile_id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table profiles enable row level security;
alter table profile_permissions enable row level security;
alter table clientes enable row level security;
alter table processos enable row level security;
alter table andamentos_processuais enable row level security;
alter table prazos enable row level security;
alter table tarefas enable row level security;
alter table financeiro_lancamentos enable row level security;
alter table financeiro_parcelas enable row level security;
alter table metas_financeiras enable row level security;
alter table atendimentos_cliente enable row level security;
alter table apontamentos_tempo enable row level security;
alter table credenciais_tribunal enable row level security;

-- profiles: todo mundo autenticado enxerga a própria linha; admin enxerga
-- todas; funcionário enxerga as outras contas de STAFF (admin/funcionario,
-- nunca as de cliente do portal) — precisa disso pra listar "responsável"
-- nos seletores de processo/prazo/tarefa (delegação).
create policy "profiles_select" on profiles for select using (
  id = auth.uid()
  or my_role() = 'admin'
  or (my_role() = 'funcionario' and role in ('admin', 'funcionario'))
);
create policy "profiles_admin_write" on profiles for all using (my_role() = 'admin');

-- profile_permissions: só admin mexe; usuário pode ler as próprias
create policy "permissions_select_own" on profile_permissions for select using (
  profile_id = auth.uid() or my_role() = 'admin'
);
create policy "permissions_admin_write" on profile_permissions for insert with check (my_role() = 'admin');
create policy "permissions_admin_update" on profile_permissions for update using (my_role() = 'admin');
create policy "permissions_admin_delete" on profile_permissions for delete using (my_role() = 'admin');

-- clientes: admin/funcionário com permissão 'clientes'; cliente vê só a si mesmo
create policy "clientes_staff" on clientes for all using (
  has_permission('clientes')
) with check (has_permission('clientes'));
create policy "clientes_self" on clientes for select using (
  portal_profile_id = auth.uid()
);

-- processos: mesma regra, cliente vê só os processos ligados a ele
create policy "processos_staff" on processos for all using (
  has_permission('processos')
) with check (has_permission('processos'));
create policy "processos_self" on processos for select using (
  cliente_id = my_cliente_id()
);

-- andamentos: staff com permissão 'processos'; cliente vê os do próprio processo
create policy "andamentos_staff" on andamentos_processuais for all using (
  has_permission('processos')
) with check (has_permission('processos'));
create policy "andamentos_self" on andamentos_processuais for select using (
  processo_id in (select id from processos where cliente_id = my_cliente_id())
);

-- prazos: staff com permissão 'prazos' vê tudo; funcionário sem a permissão
-- ainda vê os prazos em que é responsável (pra conseguir trabalhar as próprias
-- tarefas mesmo que a Daniela restrinja o módulo geral pra ele)
create policy "prazos_staff" on prazos for all using (
  has_permission('prazos') or responsavel_id = auth.uid()
) with check (has_permission('prazos') or responsavel_id = auth.uid());

-- tarefas: cada um vê as que atribuiu ou as que recebeu; admin vê todas
create policy "tarefas_select" on tarefas for select using (
  my_role() = 'admin' or responsavel_id = auth.uid() or atribuido_por = auth.uid()
);
create policy "tarefas_write" on tarefas for insert with check (
  my_role() = 'admin' or has_permission('tarefas')
);
create policy "tarefas_update" on tarefas for update using (
  my_role() = 'admin' or responsavel_id = auth.uid() or atribuido_por = auth.uid()
);

-- atendimentos: uso interno do escritório, mesma trava de 'clientes'. Não tem
-- policy de "self" — o cliente do portal não vê o próprio histórico de
-- atendimento (são anotações internas da equipe, não um canal com o cliente).
create policy "atendimentos_staff" on atendimentos_cliente for all using (
  has_permission('clientes')
) with check (has_permission('clientes'));

-- apontamentos de tempo: cada um vê/edita os próprios; quem tem a permissão
-- 'tarefas' (ex: a Daniela) vê o timesheet de todo mundo, pra acompanhar a
-- equipe.
create policy "apontamentos_select" on apontamentos_tempo for select using (
  profile_id = auth.uid() or my_role() = 'admin' or has_permission('tarefas')
);
create policy "apontamentos_write" on apontamentos_tempo for insert with check (
  profile_id = auth.uid()
);
create policy "apontamentos_update_own" on apontamentos_tempo for update using (
  profile_id = auth.uid() or my_role() = 'admin'
);
create policy "apontamentos_delete_own" on apontamentos_tempo for delete using (
  profile_id = auth.uid() or my_role() = 'admin'
);

-- credenciais_tribunal: cada um só vê/grava/atualiza/apaga a própria linha —
-- o "ver" aqui devolve só o texto cifrado (inútil sem a chave do servidor),
-- nunca a senha em texto puro.
create policy "credenciais_select_own" on credenciais_tribunal for select using (
  profile_id = auth.uid()
);
create policy "credenciais_insert_own" on credenciais_tribunal for insert with check (
  profile_id = auth.uid()
);
create policy "credenciais_update_own" on credenciais_tribunal for update using (
  profile_id = auth.uid()
) with check (profile_id = auth.uid());
create policy "credenciais_delete_own" on credenciais_tribunal for delete using (
  profile_id = auth.uid()
);

-- financeiro: só quem tem a permissão 'financeiro' (funcionário fica de fora
-- por padrão — ver has_permission acima)
create policy "financeiro_lancamentos_rw" on financeiro_lancamentos for all using (
  has_permission('financeiro')
) with check (has_permission('financeiro'));
create policy "financeiro_parcelas_rw" on financeiro_parcelas for all using (
  has_permission('financeiro')
) with check (has_permission('financeiro'));
create policy "metas_rw" on metas_financeiras for all using (
  has_permission('financeiro')
) with check (has_permission('financeiro'));

-- ----------------------------------------------------------------------------
-- Fim da migration inicial. Próximas fases (Prazos/Tarefas, Financeiro,
-- Andamento Processual) podem adicionar colunas/tabelas em migrations novas —
-- evite editar esta depois de já ter rodado em produção.
-- ----------------------------------------------------------------------------
