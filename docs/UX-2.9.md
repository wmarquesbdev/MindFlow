# UX 2.9 — decisões e escopo

O foco é reduzir procura, repetição e esforço; não aumentar o tempo de tela. Nenhum serviço externo, rastreamento ou sincronização em nuvem foi adicionado. O formato de armazenamento e os registros existentes são preservados.

| Área | Problema observado | Mudança |
| --- | --- | --- |
| Início | Saudação e tarefa repetidas; notícias dominavam a página | Indicadores clicáveis, próxima ação única, estudos, vencimentos e resumo semanal; notícias secundárias |
| Hoje | Hábitos isolados das ações do dia | Tarefas para hoje, criação com data, filtro de hábitos pendentes e foco de teclado preservado |
| Meus meses | Criar/editar exigia voltar ao topo | Barra de ações fixa, criação junto aos cartões, busca por nome/ano e calendário aberto preservado |
| Tarefas | Colunas vazias muito altas e criação distante | Busca sem depender de acentos, adicionar em cada coluna, concluídas compactas e desfazer conclusão |
| Finanças | Muitas listas sem busca | Busca contextual com aviso explícito de que totais não são filtrados; espaçamentos e valores legíveis |
| Foco | Preset, campo e relógio podiam divergir | Estado real da sessão, progresso de tempo, configuração secundária, presets coerentes e próxima pausa após conclusão |
| Autocuidado | Registros sem leitura dos padrões | Gatilho mais registrado na semana (contagem, não diagnóstico), encerrar pausa e escrever nota diretamente |
| Estudos | Progresso exigia abrir formulário; cartão excessivamente largo | Barra nativa arrastável com teclado, unidades, prévia, salvamento ao soltar, valor exato e desfazer |
| Notas / Notícias | Ação primária longe após rolar | Ação fixa, prévia limitada das notas sem perder conteúdo; notícias completas mantidas na página própria |
| Histórico / Objetivos / Personalizar | Precisavam compartilhar padrões básicos | Tipografia, focos visíveis, espaçamento e controles consistentes; funções existentes preservadas |
| Navegação | Procurar módulo no menu interrompia o fluxo | Ctrl+K para filtrar páginas, Tab/Enter/Esc, pular para conteúdo |

## Regras dos resumos

- Tarefas para agora: em andamento, próximas ou com data até hoje, excluindo concluídas. Em andamento primeiro, depois atrasadas, próximas e demais tarefas de hoje.
- Semana: últimos sete dias; percentual ponderado pela quantidade de hábitos nos dias com registro. Dias vazios não contam como falha. O resumo explica essa regra.
- Finanças: dados manuais estimados. Busca altera somente as listas, nunca os totais. As regras de centavos, parcelas e pagamento vinculado permanecem.
- Estudos: prévia no movimento, persistência no evento `change`, sem reconstruir o controle durante o arrasto. Setas/Home/End nativos, alternativa numérica. Horas permitem décimos.
- Os registros locais continuam na pasta de dados, fora do código e do instalador. Testes usam diretórios separados.

## Referências de projeto

- [Nielsen Norman Group: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) — ações frequentes visíveis, opções ocasionais em segundo plano.
- [W3C: slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/) — teclado, rótulos e valores compreensíveis. Preferência por `input type="range"` nativo.
- [Todoist: Quick Add](https://www.todoist.com/help/todoist/features/use-task-quick-add-in-todoist-va4Lhpzz) — criação próxima ao contexto da tarefa.

## Verificação realizada

- `npm run check` e 41 testes automatizados aprovados: persistência, conflitos, backups, finanças, notícias, foco e regras novas de UX.
- Navegação das 13 páginas conferida no navegador, incluindo largura de 390 px sem transbordamento horizontal do documento.
- Fluxos exercitados com dados fictícios isolados: hábitos pendentes, tarefas e desfazer, criação de mês, pagamento manual de conta e filtros, autocuidado, gráfico do histórico e progresso de estudos por arrasto/teclado com persistência após recarregar.
- Executável Windows 2.9.0 gerado e aberto em perfil isolado. Teste desktop aprovado, incluindo mini janela independente, relógio compartilhado e pausa pela mini janela.
- Instalação sobre uma versão anterior e atualização automática a partir de uma release 2.9 publicada não foram executadas. A validação não representa cobertura de todas as combinações possíveis de dados e dispositivos.

## Limites

Não há IA, recomendação médica/financeira, notificações invasivas ou gamificação punitiva nesta atualização. A leitura de padrões é feita somente sobre registros informados. O mini timer continua dependendo do aplicativo aberto e a atualização automática depende de instalação Windows e de uma release completa no GitHub.
