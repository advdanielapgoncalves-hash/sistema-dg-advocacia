-- Pedido da Daniela (09/09): tarefas muitas vezes são trabalho
-- pré-processual — feito antes de existir um processo formal — mas mesmo
-- assim precisam ficar vinculadas a um cliente. O vínculo é opcional na
-- criação da tarefa (pode não haver cliente definido ainda), mas passa a
-- ser obrigatório no momento de concluir a tarefa (ver ação
-- concluirTarefa, em operacional/actions.ts).
alter table tarefas
  add column cliente_id uuid references clientes(id);

comment on column tarefas.cliente_id is 'Cliente vinculado à tarefa. Opcional na criação, obrigatório ao concluir.';
