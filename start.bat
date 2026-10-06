@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 18 ou superior em https://nodejs.org e tente novamente.
  pause
  exit /b 1
)
echo Abra http://127.0.0.1:3000 no navegador.
echo Se usa o Live Server, mantenha este terminal aberto e atualize as noticias na pagina atual.
node server.js
pause
