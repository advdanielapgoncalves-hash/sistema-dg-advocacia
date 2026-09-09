-- Pedido da Daniela: ao concluir um prazo (no Painel ou no Operacional), ela
-- quer poder registrar uma observação do que foi feito (ex: "protocolo na
-- pasta, pendente informar o cliente") e, na mesma ação, já lançar o tempo
-- gasto (timesheet) vinculado a esse prazo. Estas colunas guardam esse
-- registro — sem elas a conclusão de um prazo não deixava nenhum rastro do
-- que aconteceu, só o status "concluido".
alter table prazos
  add column observacao_conclusao text,
  add column concluido_em timestamptz,
  add column concluido_por uuid references profiles(id);

comment on column prazos.observacao_conclusao is 'Observação registrada ao concluir o prazo (o que foi feito).';
comment on column prazos.concluido_em is 'Data/hora em que o prazo foi marcado como concluído.';
comment on column prazos.concluido_por is 'Usuário que concluiu o prazo.';
