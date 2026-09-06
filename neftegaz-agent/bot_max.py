"""
Нефтегазовый ИИ-ассистент — бот для мессенджера MAX.

Использует ту же базу знаний и ту же логику обращения к YandexGPT, что и
консольная версия (bot.py) и веб-приложение (app_web.py) — см. core.py.

Как запустить:
    1. pip install -r requirements.txt
    2. В MAX найти @MasterBot, отправить ему /create, задать имя бота
       (заканчивается на "_bot") и получить токен доступа
    3. Скопировать .env.example в .env, вписать YANDEX_API_KEY,
       YANDEX_FOLDER_ID и полученный токен в MAX_BOT_TOKEN
    4. python bot_max.py

Работает через long polling — этого достаточно для теста и небольшой
нагрузки. Для продакшена MAX Bot API рекомендует вебхуки с HTTPS
(см. документацию библиотеки maxapi: https://pypi.org/project/maxapi/).

История диалога хранится в памяти процесса отдельно по каждому чату —
при перезапуске бота она сбрасывается.
"""

import asyncio
import logging

from maxapi import Bot, Dispatcher, F
from maxapi.filters.command import CommandStart
from maxapi.types import BotStarted, MessageCreated

from core import Assistant

logging.basicConfig(level=logging.INFO)

GREETING = "Нефтегазовый ассистент готов. Напиши вопрос, например про дебит скважины."

bot = Bot()  # токен берётся из переменной окружения MAX_BOT_TOKEN
dp = Dispatcher()
assistant = Assistant()

sessions: dict[int, list[dict]] = {}


@dp.bot_started()
async def on_bot_started(event: BotStarted):
    sessions[event.chat_id] = []
    await bot.send_message(chat_id=event.chat_id, text=GREETING)


@dp.message_created(CommandStart())
async def on_start(event: MessageCreated):
    chat_id, _ = event.get_ids()
    sessions[chat_id] = []
    await event.message.answer(GREETING)


@dp.message_created(F.message.body.text)
async def on_message(event: MessageCreated):
    chat_id, _ = event.get_ids()
    history = sessions.setdefault(chat_id, [])
    history.append({"role": "user", "content": event.message.body.text})

    try:
        answer = assistant.ask(history)
    except Exception:
        logging.exception("Ошибка обращения к YandexGPT")
        history.pop()
        await event.message.answer(
            "Не получилось получить ответ от модели, попробуй ещё раз чуть позже."
        )
        return

    history.append({"role": "assistant", "content": answer})
    await event.message.answer(answer)


async def main():
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
