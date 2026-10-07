# MindFlow

<p align="center"><img src="assets/mindflow-icon.png" width="96" alt="Ícone do MindFlow"></p>

> Menos ruído. Mais presença.

Um espaço pessoal para organizar hábitos, tarefas, finanças e foco. Funciona no Windows ou no navegador, com dados guardados localmente e sem conta.

## Começar

- **Windows:** baixe o instalador na [última versão](https://github.com/wmarquesbdev/MindFlow/releases/latest), instale e abra **MindFlow** pelo menu Iniciar. Não é preciso instalar Node.js. O Windows pode alertar que o instalador ainda não é assinado.
- **Navegador:** instale [Node.js 22.13+](https://nodejs.org/), clone o projeto e execute:

```powershell
git clone https://github.com/wmarquesbdev/MindFlow.git
cd MindFlow
npm.cmd install
npm.cmd start
```

Abra `http://127.0.0.1:3177`. No PowerShell, use `npm.cmd` se a execução de scripts estiver bloqueada.

## O que tem

Hábitos por mês com capas, tarefas em lista ou Kanban, notas, estudos com progresso, histórico em gráfico, Pomodoro com mini timer na área de trabalho e notícias atualizadas a cada 5 minutos enquanto a página está em uso. Personalize cores, leitura e página inicial. Inclui autocuidado e controle simples de conta, Pix, boletos e cartão. Comprovantes podem ser anexados; a leitura local apenas sugere valores e vencimentos — confirme sempre com o original.

## Atualizar

A partir da **2.8.0 instalada no Windows**, o app verifica e baixa novas versões em segundo plano. Em **Personalizar**, consulte o estado e reinicie para aplicar. Quem usa 2.7 ou anterior precisa instalar a 2.8 uma vez. Durante o foco, minimize o app para manter o timer ativo; fechar o aplicativo encerra o timer.

## Seus dados

O app e o site no mesmo PC usam `%APPDATA%\MindFlow\data\`. Atualizações não apagam essa pasta. Não há sincronização automática entre computadores nem conexão bancária. Em **Personalizar → Seus dados**, exporte regularmente o **ZIP completo**; ele inclui os anexos, ao contrário do backup JSON. Guarde backups em local privado: não são criptografados.

## Desenvolver

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run desktop
npm.cmd run make
```

O instalador gerado fica em `out/make/squirrel.windows/x64/`. Artes: [pixel art](assets/pixel/ART.md). Licença [MIT](LICENSE).

Para publicar, use `powershell -ExecutionPolicy Bypass -File scripts/release.ps1` após o build e o push. O script publica juntos instalador, pacote `.nupkg` e `RELEASES`, necessários para atualizar automaticamente. Requer GitHub CLI autenticado; veja o script antes de executar.

Os retratos de personagens são fan art gerada para o projeto, não imagens oficiais. Personagens e marcas pertencem a seus respectivos titulares; o MindFlow não é afiliado a eles.
