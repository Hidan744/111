# Деплой ботов на сервер (автономная работа 24/7)

Инструкция разворачивает Telegram- и MAX-бота на облачном сервере
(например, RUVDS) так, чтобы они работали постоянно — не зависели от
твоего компьютера, сами перезапускались при сбое и после перезагрузки
сервера.

Понадобится: сервер с Linux (Ubuntu/Debian) и SSH-доступ к нему.
Отдельный хостинг под MAX/Telegram не нужен — боты сами инициируют
соединение наружу (long polling), входящие порты открывать не требуется.

## 1. Подключение к серверу

```
ssh root@адрес_сервера
```

(логин/пароль или ключ — то, что выдал RUVDS при заказе сервера)

## 2. Системные зависимости

```
apt update
apt install -y python3 python3-venv git
```

## 3. Скачать проект

```
cd ~
git clone https://github.com/Hidan744/111.git
cd 111/neftegaz-agent
```

Если проект уже лежит на сервере и просто нужно обновить — см. раздел
"Обновление кода" ниже.

## 4. Виртуальное окружение и зависимости

```
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

## 5. Настроить .env

```
cp .env.example .env
nano .env
```

Впиши реальные значения (те же, что использовались локально):
`YANDEX_API_KEY`, `YANDEX_FOLDER_ID` можно оставить пустыми, если
работаем через AITunnel — главное, чтобы было:

```
LLM_PROVIDER=aitunnel
AITUNNEL_API_KEY=sk-aitunnel-...
AITUNNEL_MODEL=gemini-2.5-flash-lite
LLM_MAX_TOKENS=50000
MAX_BOT_TOKEN=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_USER_IDS=...
```

Сохранить в nano: `Ctrl+O`, `Enter`, выйти — `Ctrl+X`.

## 6. Проверить руками перед автозапуском

```
venv/bin/python bot_telegram.py
```

Должна появиться строка `Бот запущен [версия: меню тем, категорий: ...]`.
Напиши боту `/start` в Telegram, убедись что меню приходит. Останови —
`Ctrl+C`. Так же проверь `venv/bin/python bot_max.py`.

## 7. Автозапуск через systemd

В папке `deploy/` уже готовы юниты для обоих ботов. Перед установкой
открой их и поправь `WorkingDirectory` и `ExecStart`, если склонировал
проект не в `/root/neftegaz-agent` (например, если работаешь не под
root, а под отдельным пользователем — поменяй и `User=`).

```
sudo cp deploy/neftegaz-bot-telegram.service /etc/systemd/system/
sudo cp deploy/neftegaz-bot-max.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now neftegaz-bot-telegram
sudo systemctl enable --now neftegaz-bot-max
```

`enable` — чтобы боты сами поднимались после перезагрузки сервера,
`--now` — сразу запустить.

## 8. Проверка статуса и логов

```
sudo systemctl status neftegaz-bot-telegram
sudo systemctl status neftegaz-bot-max

sudo journalctl -u neftegaz-bot-telegram -f
sudo journalctl -u neftegaz-bot-max -f
```
(`-f` — смотреть логи в реальном времени, `Ctrl+C` чтобы выйти)

## Обновление кода (после того как база знаний доработана)

```
cd ~/111
git pull
cd neftegaz-agent
venv/bin/pip install -r requirements.txt   # если requirements.txt менялся
sudo systemctl restart neftegaz-bot-telegram
sudo systemctl restart neftegaz-bot-max
```

## Остановка ботов

```
sudo systemctl stop neftegaz-bot-telegram
sudo systemctl stop neftegaz-bot-max
```

(автозапуск при этом остаётся включённым — при следующей перезагрузке
сервера боты снова поднимутся; чтобы отключить совсем — `disable`
вместо `stop`)
