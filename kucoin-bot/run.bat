@echo off
rem Запуск бота в Windows: run.bat compare --days 730
rem Первый запуск сам ставит зависимости и создаёт .env из .env.example.
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>nul && (set PY=py) || (set PY=python)
if not exist .env copy .env.example .env >nul
%PY% -c "import requests" 2>nul || %PY% -m pip install -r requirements.txt
%PY% main.py %*
