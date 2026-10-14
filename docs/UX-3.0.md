# MindFlow 3.0 — primeira experiência e espaço pessoal

## Intenção da versão

A 3.0 melhora a chegada ao MindFlow sem transformar o sistema em uma rede social, jogo ou serviço de coleta de dados. A experiência continua local, privada e sem conta: a pessoa escolhe como quer ser chamada, um avatar, uma atmosfera visual e qual será seu primeiro passo.

## O que mudou

| Área | Decisão | Resultado esperado |
| --- | --- | --- |
| Primeira abertura | Perfil simples, avatar, cenário e intenção inicial em um fluxo curto | A tela inicial deixa de parecer vazia ou genérica |
| Home | Cenário pixel art opcional com a próxima ação e contexto do dia | Direção visual sem esconder a ação mais importante |
| Guia | Passos baseados no estado real do uso, dispensáveis e reabríveis | Ajuda no momento certo, sem tutorial obrigatório |
| Personalizar | Estúdio com cenário da Home, densidade, tipografia, cor e prévias | A pessoa pode adaptar o espaço sem fragmentar o produto |
| Tarefas | Descrição separada da próxima ação | Contexto suficiente para retomar uma tarefa, mantendo o Kanban leve |
| Dados existentes | Migração conservadora: perfis já configurados não veem onboarding de novo | Atualização não interrompe o hábito de quem já usa o sistema |

## Regras de produto preservadas

- Não há pontuação, sequência obrigatória, ranking ou punição por não usar o sistema.
- O guia usa somente os registros locais já feitos pela pessoa.
- Alterar a aparência não modifica hábitos, tarefas, finanças ou documentos.
- A descrição da tarefa é opcional; a **próxima ação** continua curta e operacional.
- O cenário pode ser desligado para uma Home mais compacta e menos visual.

## Verificação realizada

- `npm.cmd run check` aprovado.
- `npm.cmd test` aprovado com 44 testes, incluindo migração de perfil, descrição de tarefa e guia contextual.
- Fluxo no navegador com dados isolados: perfil inicial, boas-vindas, criação e edição de tarefa, persistência após recarregar, escolha de cenário e Home compacta.
- As 13 rotas foram abertas em largura de 390 px sem transbordamento horizontal.

## Limites conhecidos da publicação

- A atualização automática só funciona para o app Windows instalado pelo instalador Squirrel e após uma release conter `Setup.exe`, `.nupkg` e `RELEASES`.
- O build local produziu o aplicativo empacotado, mas a geração do instalador depende do NuGet do Windows. Caso a conta/ambiente bloqueie o arquivo de configuração do NuGet, a criação do instalador deve ser executada em um terminal com acesso normal ao perfil do Windows.
- O instalador não é assinado; o Windows pode mostrar um aviso até que seja configurado um certificado de assinatura.
