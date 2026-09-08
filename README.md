# Sistema — Daniela Gonçalves Advocacia e Assessoria

Já cobre: login individual, permissões por usuário, Configurações, Clientes
(cadastro + histórico de atendimento), Operacional (Processos + Prazos +
Tarefas + Publicações) e Financeiro (faturamento/despesas/margem por
período) — com a identidade visual aprovada aplicada. O que ainda falta está
listado em "Pendências conhecidas" no fim deste arquivo.

## O que já funciona

- Login individual (e-mail/senha) via Supabase Auth.
- Três papéis: **admin** (Daniela, acesso total), **funcionário** (acesso
  configurável, sem Financeiro por padrão) e **cliente** (login separado,
  cai direto num portal enxuto — ainda vazio, é a próxima etapa do Portal).
- Tela **Configurações**: cadastrar funcionário/administrador e ligar/desligar
  o acesso de cada um aos módulos (Clientes, Andamento Processual, Prazos,
  Tarefas, Financeiro).
- **Clientes**: cadastro (dados básicos), ficha do cliente com processos
  vinculados e **histórico de atendimento** — todo contato registrado ali
  fica visível pra qualquer pessoa da equipe que precisar assumir o caso.
- **Operacional**: uma tela só com abas Processos / Prazos / Tarefas /
  Timesheet / Publicações (a antiga "Andamento Processual", "Prazos" e
  "Tarefas" viraram uma coisa só, seguindo o modelo que a Daniela mandou).
  Processos mostram número, descrição, responsável, status e prazo fatal.
  Prazos e tarefas têm criação e delegação por pessoa. Publicações mostra a
  "data de push" das intimações — processos públicos marcados pra
  monitoramento são sincronizados automaticamente 1x por dia com o DataJud
  (CNJ), com botão pra sincronizar na hora também; processos em segredo de
  justiça continuam de fora disso (ver seção própria sobre e-SAJ) e seguem
  cadastrados manualmente.
- **Financeiro**: duas abas separadas. "Fluxo de caixa" tem os cartões de
  faturamento, despesas e margem do período (com filtro por data) e o
  lançamento manual de entradas/saídas — é a tela que já existia. "Recebimentos
  do mês" é o controle novo, pensado pra substituir a planilha que a Daniela
  mantinha à parte: lista os recebimentos esperados no mês (cliente, descrição,
  parcela, forma de recebimento, vencimento, status) com um botão "Dar baixa"
  por item conforme o pagamento chega. Detalhes de como o status é calculado
  estão na seção "Sobre o controle de Recebimentos do mês" abaixo.
- **Painel**: além de prazos e tarefas, agora mostra "Recebimentos desta
  semana" (soma e lista dos recebimentos com vencimento nos próximos 7 dias
  que ainda não foram baixados) e "Clientes em atraso (últimos 10 dias)"
  (recebimentos vencidos e não baixados nos últimos 10 dias) — os dois vêm da
  mesma tabela usada em Financeiro → Recebimentos do mês.
- **Timesheet** (dentro de Operacional): apontar tempo de duas formas — preso
  a uma tarefa específica, ou avulso (só descrição + tempo), com a opção de
  vincular esse avulso a um prazo. Cada um vê os próprios apontamentos;
  quem tem permissão de Tarefas (a Daniela, por padrão) vê o de todo mundo.
- A restrição de acesso vale em duas camadas: a tela esconde o que a pessoa
  não pode ver, **e** o banco de dados (Row Level Security) recusa a consulta
  mesmo que alguém tente burlar pela URL ou por fora do site.

## Passo a passo para colocar no ar (você precisa fazer essas contas — eu não
posso criar contas de terceiros em seu nome)

### 1. Criar o projeto no Supabase (banco de dados + login) — gratuito para começar

1. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto.
2. Vá em **SQL Editor**, cole o conteúdo de `supabase/migrations/0001_init.sql`
   (está nesta pasta) e rode. Isso cria todas as tabelas e as regras de
   permissão.
3. Vá em **Project Settings → API** e copie três valores: `Project URL`,
   `anon public key` e `service_role key`.
4. Copie o arquivo `.env.local.example` para `.env.local` e cole esses três
   valores nele.

### 2. Criar o seu próprio usuário administrador

Como o cadastro de usuários só acontece pela tela de Configurações (que exige
login de admin — ou seja, é um problema do ovo e da galinha no primeiríssimo
usuário), crie o seu login direto no painel do Supabase:

1. No painel do Supabase, vá em **Authentication → Users → Add user**, crie
   com seu e-mail e uma senha.
2. Vá em **Table Editor → profiles**, ache a linha criada automaticamente com
   seu e-mail, e mude a coluna `role` para `admin` (por padrão ela entra como
   `funcionario`).
3. Pronto — a partir daí você faz login normalmente pelo sistema e cadastra
   os demais funcionários pela tela de Configurações.

### 3. Rodar localmente para conferir

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` — deve cair na tela de login.

### 4. Publicar (Vercel) e configurar o subdomínio

1. Crie uma conta em [vercel.com](https://vercel.com) (pode entrar com GitHub).
2. Suba este código para um repositório no GitHub (posso te ajudar nisso
   quando chegarmos aqui) e importe o repositório na Vercel.
3. Na Vercel, em **Environment Variables**, cole **todas** as variáveis do
   seu `.env.local` — inclui as três do Supabase, a `CREDENTIALS_ENCRYPTION_KEY`,
   e agora também `DATAJUD_API_KEY` e `CRON_SECRET` (ver `.env.local.example`
   pra instruções de cada uma). Sem `CRON_SECRET` configurado lá, a
   sincronização automática com o DataJud não funciona.
4. O Cron Job da sincronização diária com o DataJud (arquivo `vercel.json`
   já incluso no projeto) é ativado sozinho no primeiro deploy — não precisa
   configurar nada manualmente na Vercel pra isso, só confirmar que as duas
   variáveis do passo 3 estão lá.
5. Em **Settings → Domains**, adicione `sistema.danielagoncalvesadvocacia.com.br`
   (ou o nome que você preferir) — a Vercel mostra um registro CNAME para
   você criar no DNS onde o domínio está configurado hoje.
6. Isso é independente de o site institucional continuar no Netlify — um
   subdomínio pode apontar para um provedor diferente do domínio principal.

**Vamos fazer os passos 1 e 2 juntos quando você estiver pronta** — eu aviso
exatamente o que clicar, mas as contas (Supabase e Vercel) precisam ser seus
logins, não os meus.

## Sobre o Diário Oficial / DataJud — agora construído (processos públicos)

Você pediu pra eu priorizar isso depois de dizer que, sem essa automação,
não fazia sentido pra você ter o sistema no ar. Constrói agora a integração
automática com o **DataJud (API pública e gratuita do CNJ)** pra processos
**públicos** (não sigilosos). Processos em segredo de justiça continuam de
fora disso — nenhuma API pública alcança eles, ver a seção própria abaixo
sobre e-SAJ.

**Importante saber antes de mais nada** (você respondeu que a *maioria* dos
seus processos ativos está em segredo de justiça): isso significa que essa
automação resolve a *minoria* do seu volume real hoje — a maior parte vai
continuar dependendo da checagem manual ou, mais pra frente, do fluxo
assistido do e-SAJ (ainda não construído). Não quero deixar a impressão de
que isso já elimina a maior parte do seu trabalho manual — elimina uma
parte real, mas não a maior.

**Como funciona:**

- Todo dia, uma vez por dia, o sistema consulta automaticamente o DataJud
  pra cada processo marcado como "Monitorar automaticamente via DataJud" no
  cadastro (Operacional → Processos) — e que não esteja em segredo de
  justiça. Isso roda como um **Cron Job da própria Vercel** (recurso nativo
  deles, incluso até no plano gratuito) — você não precisa contratar nada
  além do que já estava no plano.
- Não existe aviso instantâneo (webhook) no DataJud — só consulta sob
  demanda —, então "uma vez por dia" é o modelo real possível de graça; o
  plano gratuito (Hobby) da Vercel também só permite cron 1x por dia, então
  os dois limites combinam bem. Fonte:
  [documentação oficial da Vercel sobre limites de Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing)
  (Hobby: 1x por dia, com até ~1h de variação no horário exato).
- Além do horário automático, tem um botão **"Sincronizar DataJud agora"**
  na aba Publicações (Operacional), pra rodar na hora sem esperar o horário
  agendado.
- Andamentos novos entram na mesma lista de "Publicações" que já existia,
  com `origem = 'datajud'` (pra diferenciar do que foi cadastrado à mão) e
  a `data_push` marcando quando o sistema capturou.
- **Limitação atual: só cobre o TJSP.** O endpoint usado
  (`api_publica_tjsp`) é específico desse tribunal — se você tiver processo
  em outro tribunal (Justiça Federal, Trabalhista, TJ de outro estado),
  esse processo não vai ser encontrado até eu ajustar o código pra
  considerar o tribunal certo.
- Classificação "andamento" vs. "intimação" nos resultados do DataJud é uma
  **aproximação minha** (procuro a palavra "intima" no nome do movimento) —
  não é uma classificação oficial do CNJ. Recomendo você conferir os
  primeiros resultados reais antes de confiar 100% nisso pra delegação.

**O que eu NÃO consegui testar, e por quê**: não rodei essa integração
contra a API real do DataJud de dentro do ambiente onde escrevi o código —
a rede de lá bloqueia acesso automatizado a `*.cnj.jus.br` (o mesmo bloqueio
já registrado antes neste README pro site do CNJ e do e-SAJ). O endpoint,
autenticação e formato de campos abaixo vêm de fontes que pesquisei e citei
no código (`src/lib/datajud.ts`), não de um teste ao vivo. **O primeiro
disparo em produção (manual, pelo botão "Sincronizar DataJud agora", com
um processo seu de teste) é a validação real** — se algo vier diferente do
esperado, me mostra o erro que aparece na tela ou nos logs da Vercel
(Project → Logs) que eu ajusto.

**Detalhes técnicos** (documentados, com fonte, em `src/lib/datajud.ts`):
endpoint `https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search`,
autenticação por uma chave pública (a mesma publicada pelo CNJ pra todo
mundo, não é uma senha sua), consulta por `numeroProcesso`, resposta trazendo
uma lista de `movimentos` (nome, data/hora, código). Fontes: [TJDFT — endpoint e autenticação](https://www.tjdft.jus.br/transparencia/tecnologia-da-informacao-e-comunicacao/dados-abertos/datajud-tjdft), [exemplo de requisição citando a documentação do CNJ](https://www.tabnews.com.br/leonardomv/projeto-php-para-utilizacao-da-api-do-cnj), [alias do TJSP e observação sobre rate limit](https://chatjuridico.com.br/como-consultar-datajud-cnj/), [tutorial oficial do CNJ (PDF) — nomes dos campos de "movimentos"](https://www.cnj.jus.br/wp-content/uploads/2023/05/tutorial-api-publica-datajud-beta.pdf), [documentação da Vercel sobre Cron Jobs e `CRON_SECRET`](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

Fornecedores comerciais com webhook de verdade (tempo real, não 1x por dia)
continuam sendo Escavador ou Judit, com custo mensal — decisão em aberto,
sem bloquear o que já está pronto.

## Sobre a API da ADVBOX

Você pediu pra incluir as APIs disponíveis da ADVBOX neste sistema. Pesquisei
na documentação oficial deles antes de prometer qualquer coisa. O que
confirmei (fontes abaixo):

- É uma API REST (`https://app.advbox.com.br/api/v1`), autenticação por
  Bearer token, com 7 grupos de recursos e 22 endpoints: **Customers**
  (clientes), **Lawsuits** (processos), **Posts** (tarefas/anotações),
  **Publications** (publicações do Diário — isso é interessante pro seu
  problema de Diário Oficial, se você já usa ADVBOX), **Transactions**
  (financeiro), **Documents** e **Settings**. Suporta GET, POST e PUT nos
  principais recursos. Limite de 30 requisições/minuto em GET e 500/dia em
  POST/PUT.
- **Não encontrei webhook nem apontamento de horas/timesheet na API deles.**
- O acesso não é self-service: o token é emitido pela ADVBOX só pra
  "parceiros e integradores aprovados" — você precisaria pedir esse acesso
  direto com eles. Uma página comercial deles (não a documentação técnica)
  menciona a partir de R$ 280/mês pro escritório ter acesso às rotas de
  consulta — não confirmei isso como preço atual, é o que está publicado na
  página de marketing.

**O que eu preciso de você pra seguir com isso**: você já usa a ADVBOX hoje?
Se sim, é ela que guarda os processos/clientes/financeiro de verdade e você
quer que ESTE sistema puxe os dados de lá (por exemplo, usar o endpoint de
Publications como fonte do Diário Oficial em vez do DataJud)? Ou é outra
ideia? Preciso entender o objetivo antes de programar a integração, porque
sem um token da ADVBOX (que só ela emite, mediante aprovação) eu não
consigo nem testar nada — não vou simular uma integração que eu não posso
verificar que funciona.

Fontes: [Visão geral da API — ADVBOX](https://api.softwareadvbox.com.br/docs), [Referência de recursos — ADVBOX](https://api.softwareadvbox.com.br/docs/referencia), [Autenticação — ADVBOX](https://api.softwareadvbox.com.br/docs/autenticacao), [Página comercial da API — ADVBOX](https://advbox.com.br/api)

## Sobre o controle de Recebimentos do mês

Você pediu pra eu não misturar isso com a aba de fluxo de caixa que já
existia, e explicou que hoje faz esse controle numa planilha à parte: uma
lista dos recebimentos esperados no mês, com baixa manual conforme cada um
é pago. Isso já usava uma tabela do banco que eu tinha criado desde a Fase 1
mas nunca tinha ligado a nenhuma tela (`financeiro_parcelas`) — não foi
preciso mudar o banco de dados, só construir a tela e as ações em cima do
que já existia.

Como funciona:

- Cada recebimento tem cliente, descrição, valor, forma de recebimento,
  data de vencimento, e (se for parcelado) número da parcela e total de
  parcelas.
- **Status "A vencer" e "Atrasado" são calculados na hora, comparando a data
  de vencimento com a data de hoje** — não existe uma tarefa automática
  rodando todo dia pra "virar" o status no banco. Isso é uma escolha
  deliberada: como não há confirmação automática de pagamento (isso viria de
  um webhook de banco/gateway, que você não pediu e que é um projeto à
  parte), calcular na hora é mais simples e sempre correto, sem depender de
  um robô rodando em segundo plano. Só o status **"Pago" é gravado de
  verdade no banco**, e só muda quando alguém aperta "Dar baixa" (ou
  "Desfazer baixa", pra corrigir um clique errado).
- O seletor de mês na aba "Recebimentos do mês" é independente do filtro de
  data da aba "Fluxo de caixa" — são duas visões diferentes por propósito,
  como você pediu.
- No Painel: "Recebimentos desta semana" é a soma e a lista dos recebimentos
  com vencimento nos próximos 7 dias que ainda não foram baixados.
  "Clientes em atraso (últimos 10 dias)" é a lista dos que venceram e não
  foram baixados nos últimos 10 dias — o "10 dias" foi o número que você
  usou no pedido; se quiser outra janela (por exemplo 15 ou 30 dias) é só
  falar que eu ajusto.

O que isso ainda não faz (pra você saber onde estão os limites): não há
conciliação automática com banco/Pix/cartão (a baixa é sempre manual, por
enquanto), não há lembrete automático por e-mail/WhatsApp pro cliente
inadimplente, e não há geração automática de parcelas futuras a partir de um
contrato (cada parcela ainda é cadastrada uma a uma, ou em lote se você
cadastrar todas de uma vez ao fechar um contrato parcelado).

## Sobre processos em segredo de justiça (e-SAJ)

Você percebeu certo: DataJud, Escavador, Judit e a Publications da ADVBOX só
replicam o que os tribunais já publicaram publicamente — processo em
segredo de justiça nunca aparece ali, por definição. Confirmei isso direto
no [blog do Escavador](https://www.escavador.com/blog/processos-em-segredo-de-justica/):
eles são explícitos que não mostram sigiloso.

Você perguntou especificamente pelo **DJEN** (Diário de Justiça Eletrônico
Nacional, o diário unificado do CNJ que centralizou as publicações de
praticamente todos os tribunais desde 2022/2023) — vale registrar que a
mesma regra vale pra ele: é um diário **público**, e processos em segredo de
justiça não saem lá. Tentei confirmar isso direto na página oficial do CNJ
sobre Comunicações Processuais, mas o acesso automatizado a cnj.jus.br
retornou erro 403 (mesma limitação técnica já registrada antes neste
README). Como fonte alternativa, o [blog da Projuris sobre o DJEN](https://www.projuris.com.br/blog/djen/)
confirma o mecanismo: a consulta ao DJEN é pública para as publicações
disponíveis, mas processos com sigilo/citação ficam fora dele — quem precisa
acompanhar um sigiloso tem que acessar o sistema próprio do tribunal (no seu
caso, o e-SAJ) com credencial autorizada. Ou seja: isso reforça, com uma
fonte específica sobre o DJEN, a mesma conclusão que eu já tinha chegado
olhando pro Diário Oficial de forma mais genérica.

A forma real de resolver isso (é o que sistemas como
[Projuris ADV](https://www.projuris.com.br/blog/novidades-projuris-adv-processos-em-segredo-de-justica/)
e [Astrea/Aurum](https://astrea.aurum.com.br/pt-BR/articles/1000540-como-fazer-busca-automatica-de-processos-em-segredo-de-justica)
fazem) é logar automaticamente no **portal do próprio tribunal** com o
login da advogada — confirmei no
[manual oficial do TJSP](https://www.tjsp.jus.br/Download/PeticionamentoEletronico/Consulta-dos-processos-sigilosos-no-Portal-e-SAJ.pdf)
que o e-SAJ aceita CPF/CNPJ + senha (ou certificado digital), mas só mostra
o processo se a advogada já estiver cadastrada como representante E o juiz
tiver liberado o acesso — não existe atalho que contorne isso, é o próprio
tribunal decidindo quem vê o quê.

**O que já constrói (feito nesta atualização):**

- Tabela `credenciais_tribunal`: guarda login/CPF-CNPJ + senha **cifrada**
  (AES-256-GCM, `src/lib/crypto.ts`) de cada pessoa pro portal do tribunal.
  A chave de criptografia mora só na variável de ambiente do servidor
  (`CREDENTIALS_ENCRYPTION_KEY`), nunca no banco — testei o cifra/decifra e
  funciona.
- Tela **Credenciais de Tribunal** (menu lateral): cada pessoa cadastra a
  própria credencial — tribunal (e-SAJ/PJe/Eproc/Projudi), **CPF/CNPJ ou
  usuário**, e senha. Ninguém lê a senha de volta pela tela, só confirma que
  está cadastrada. **Não é a OAB**: pelo manual oficial do TJSP que já citei
  antes, o e-SAJ autentica por CPF/CNPJ (ou certificado digital), não pelo
  número de inscrição na OAB — a OAB entra em outro momento, quando o
  tribunal confere se você está habilitada como advogada naquele processo
  específico (isso é decisão do juízo, não um cadastro que dá pra fazer no
  nosso sistema).
- Campo **"Processo em segredo de justiça"** no cadastro de processo
  (Operacional → Processos), com um selo "Sigiloso" na tabela. Marcar esse
  campo só serve pra **excluir** o processo da sincronização automática com
  o DataJud (que nunca encontraria nada nele mesmo, ver seção acima) — não
  aciona nenhuma busca no e-SAJ, porque essa automação ainda não existe (ver
  abaixo).
- **Registro manual de andamento/intimação** (Operacional → Publicações →
  "+ Registrar manualmente"): é o único jeito, hoje, de um processo em
  segredo de justiça ter um andamento aparecendo no sistema — você digita
  processo, data, tipo (andamento ou intimação) e descrição. Antes desta
  atualização essa opção não existia de verdade na tela, apesar de eu já ter
  mencionado ela no README — construí agora, junto com o resto, porque
  fazia parte de responder à sua pergunta "cadastrando o processo sigiloso,
  ele vai puxar ou não" (resposta: não puxa nada sozinho; até a automação do
  e-SAJ existir, é este formulário manual que registra).

**O que ainda falta, e por quê**: a automação de verdade (logar no e-SAJ e
puxar o andamento) ainda não existe. Duas coisas me impedem de fazer isso
com confiança agora:

1. **Não consigo testar contra o e-SAJ de dentro do ambiente onde eu
   trabalho** (a rede daqui bloqueia o domínio deles pra automação — só
   uma leitura pontual de página funcionou). Escrever um robô que eu nunca
   vi rodar contra o site real seria arriscar prometer algo que pode não
   funcionar — e você me pediu explicitamente pra nunca fazer isso.
2. **A tela de login do e-SAJ tem uma etapa de "validação de identificação"
   com um código enviado por e-mail.** Se isso acontecer toda vez (ainda
   não sei — só descobri que a etapa existe, não com que frequência ela é
   exigida), um robô sozinho, sem alguém pra digitar esse código, não
   consegue completar o login sozinho. Isso pode significar que a
   sincronização 100% automática e silenciosa não é possível, e o caminho
   realista é "assistido": você clica em "Sincronizar" quando quiser, e se
   o e-SAJ pedir o código do e-mail, o sistema pede pra você digitá-lo na
   hora.

Também vale registrar o risco de novo, com mais clareza agora que
pesquisei: automatizar login num portal de tribunal não é algo com API
oficial — é usar o próprio site como fizesse um humano. Não achei os
termos de uso do e-SAJ pra confirmar se isso é permitido; e-SAJ mudando a
tela quebra o robô até eu corrigir. Você decidiu seguir mesmo assim, ciente
disso — só quero deixar registrado que a decisão foi seguindo essa
compreensão de risco, não que eu tenha garantido que isso vai funcionar
sem problemas.

Fontes: [Blog Escavador — segredo de justiça](https://www.escavador.com/blog/processos-em-segredo-de-justica/), [Projuris ADV — captura de sigiloso](https://www.projuris.com.br/blog/novidades-projuris-adv-processos-em-segredo-de-justica/), [Astrea/Aurum — busca automática de sigiloso](https://astrea.aurum.com.br/pt-BR/articles/1000540-como-fazer-busca-automatica-de-processos-em-segredo-de-justica), [Manual oficial TJSP — consulta de sigilosos no e-SAJ (PDF)](https://www.tjsp.jus.br/Download/PeticionamentoEletronico/Consulta-dos-processos-sigilosos-no-Portal-e-SAJ.pdf)

## Pendências conhecidas (o que ainda falta)

- Integração com o DataJud está pronta **só pra processos públicos do
  TJSP** (ver seção própria acima) — não testada ao vivo ainda (bloqueio de
  rede do ambiente onde foi escrita), e não cobre outros tribunais nem
  segredo de justiça (que é a maioria dos seus processos hoje, segundo você
  mesma). Validar com um processo de teste assim que estiver no ar é o
  próximo passo.
- Cálculo de dias úteis para prazo fatal ainda **não desconta feriados**
  nacionais/forenses — só considera segunda a sexta. Isso precisa de um
  calendário de feriados verificado antes de confiar 100% no alerta.
- Financeiro: parcelamento/baixa manual já estão prontos (aba "Recebimentos
  do mês", ver seção própria acima). **Meta do mês continua pendente** — a
  tabela `metas_financeiras` já existe no banco, mas nenhuma tela usa ela
  ainda.
- Recebimentos do mês: a baixa é sempre manual (sem conciliação automática
  com banco/Pix/cartão) e não há lembrete automático pro cliente em atraso —
  ver detalhes na seção própria acima.
- Portal do cliente: ainda é só uma tela de boas-vindas, sem o andamento do
  processo de verdade.
- Deploy (Vercel) e o subdomínio — depende de você criar as contas, ver
  passo a passo acima.
- Integração com a API da ADVBOX — depende de confirmar com você o objetivo
  e de você conseguir o token de acesso junto à ADVBOX (ver seção acima).
- Sincronização automática do e-SAJ pra processos em segredo de justiça —
  a credencial já pode ser cadastrada, mas o robô que loga e busca o
  andamento ainda não foi construído (ver seção acima: preciso testar
  contra o site real, e decidir com você o fluxo pro código de verificação
  por e-mail).

## Estrutura do projeto

```
src/app/login/            tela de login
src/app/portal/           portal do cliente (ainda só a casca, sem conteúdo)
src/app/(app)/            área interna (exige login): painel, clientes,
                           operacional (processos+prazos+tarefas+publicações),
                           financeiro, configuracoes
src/lib/auth.ts           resolve papel + permissões do usuário logado
src/lib/businessDays.ts   cálculo de dias úteis e urgência do prazo
src/lib/supabase/         clientes Supabase (browser, servidor, admin)
src/components/Sidebar.tsx  menu lateral com a identidade visual
supabase/migrations/      schema SQL (tabelas + Row Level Security)
```
