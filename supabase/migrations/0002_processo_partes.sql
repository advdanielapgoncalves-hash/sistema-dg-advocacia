-- Campos adicionais de processo pedidos pela Daniela: autor, réu e valor da
-- causa, pra deixar a ficha do processo mais completa e aparecer no detalhe
-- clicável de um prazo.
--
-- IMPORTANTE (registrado aqui pra não se perder o motivo): pesquisei se dava
-- pra puxar esses três campos automaticamente via DataJud (CNJ), a mesma
-- API pública já usada pra sincronizar andamentos. Confirmei, na própria
-- documentação oficial do CNJ (tutorial da API Pública do DataJud, Anexo I —
-- Glossário de Dados), que "dados de partes" (autor/réu) e "valor da causa"
-- NÃO fazem parte dos campos expostos pela API pública — só tribunais/
-- fornecedores privados (Escavador, Judit etc.) têm esse dado, mediante
-- contrato pago. Por isso estes três campos aqui são de preenchimento
-- manual, não automático.
alter table processos
  add column autor text,
  add column reu text,
  add column valor_causa numeric(14, 2);

comment on column processos.autor is 'Preenchimento manual — não disponível na API pública do DataJud.';
comment on column processos.reu is 'Preenchimento manual — não disponível na API pública do DataJud.';
comment on column processos.valor_causa is 'Preenchimento manual — não disponível na API pública do DataJud.';
