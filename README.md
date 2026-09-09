# MindFlow

Um espaço pessoal para organizar o dia, manter hábitos e entrar em foco — local, privado e sem conta.

## Inclui

- Saudação personalizada, tema claro/escuro e backup em JSON.
- Hábitos, planejamento diário e kanban pessoal.
- Pomodoro com timer flutuante e mini janela quando suportada.
- Notícias recentes por tema via GDELT.

## Rodar localmente

Requer [Node.js](https://nodejs.org/) 18+.

```bash
git clone https://github.com/SEU-USUARIO/mindflow.git
cd mindflow
npm start
```

Abra `http://127.0.0.1:3000`.

No Windows com política restritiva do PowerShell, use `npm.cmd start` ou abra `start.bat`.

## Privacidade

Tudo fica no armazenamento local do navegador. Apenas o módulo de notícias faz uma consulta pública ao GDELT; suas tarefas, hábitos e diário não são enviados pelo MindFlow.

## Publicar no GitHub

```bash
git init -b main
git add .
git commit -m "feat: first MindFlow release"
git remote add origin https://github.com/SEU-USUARIO/mindflow.git
git push -u origin main
```

Antes do `push`, crie um repositório vazio chamado `mindflow` no GitHub. Não inclua backups ou dados pessoais.

## Desenvolvimento

```bash
npm run check
```

MIT © 2026 MindFlow contributors
