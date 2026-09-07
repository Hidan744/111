"""
Нефтегазовый ИИ-ассистент — бот для Telegram.

Использует ту же базу знаний и ту же логику обращения к YandexGPT, что и
консольная версия (bot.py), бот для MAX (bot_max.py) и веб-приложение
(app_web.py) — см. core.py.

Как запустить:
    1. pip install -r requirements.txt
    2. В Telegram найти @BotFather, отправить /newbot, задать имя и ник
       (ник должен заканчиваться на "bot") и получить токен доступа
    3. Скопировать .env.example в .env, вписать YANDEX_API_KEY,
       YANDEX_FOLDER_ID и полученный токен в TELEGRAM_BOT_TOKEN
    4. python bot_telegram.py

Работает через long polling — этого достаточно для теста и небольшой
нагрузки; для прода Telegram Bot API поддерживает и вебхуки, но polling
проще в настройке и для одного бота хватает с запасом.

История диалога хранится в памяти процесса отдельно по каждому чату —
при перезапуске бота она сбрасывается.

Доступ ограничен списком Telegram ID в TELEGRAM_ALLOWED_USER_IDS (через
запятую) — каждый вопрос платно расходует баланс Yandex Cloud, поэтому
отвечать всем подряд по умолчанию нельзя. Чтобы узнать свой ID, напиши
боту команду /myid — она отвечает всем, независимо от списка допуска.
Изменения в TELEGRAM_ALLOWED_USER_IDS применяются только после
перезапуска бота (Ctrl+C, затем снова python bot_telegram.py).
"""

import asyncio
import logging
import os

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandStart
from aiogram.types import Message

from core import Assistant

logging.basicConfig(level=logging.INFO)

GREETING = "Нефтегазовый ассистент готов. Напиши вопрос, например про дебит скважины."

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")

ALLOWED_USER_IDS = {
    int(uid) for uid in os.environ.get("TELEGRAM_ALLOWED_USER_IDS", "").split(",") if uid.strip()
}

bot = Bot(token=TELEGRAM_BOT_TOKEN)
dp = Dispatcher()
assistant = Assistant()

sessions: dict[int, list[dict]] = {}


def is_allowed(user_id: int) -> bool:
    return not ALLOWED_USER_IDS or user_id in ALLOWED_USER_IDS


@dp.message(Command("myid"))
async def on_myid(message: Message):
    await message.answer(
        f"Твой Telegram ID: {message.from_user.id}\n"
        "Отправь его владельцу бота, чтобы получить доступ."
    )


@dp.message(CommandStart())
async def on_start(message: Message):
    if not is_allowed(message.from_user.id):
        await message.answer(
            "У тебя нет доступа к этому боту. Напиши /myid, узнай свой ID "
            "и попроси владельца добавить его в список допущенных."
        )
        return
    sessions[message.chat.id] = []
    await message.answer(GREETING)


@dp.message(F.text)
async def on_message(message: Message):
    if not is_allowed(message.from_user.id):
        await message.answer(
            "У тебя нет доступа к этому боту. Напиши /myid, узнай свой ID "
            "и попроси владельца добавить его в список допущенных."
        )
        return

    chat_id = message.chat.id
    history = sessions.setdefault(chat_id, [])
    history.append({"role": "user", "content": message.text})

    try:
        answer = assistant.ask(history)
    except Exception:
        logging.exception("Ошибка обращения к YandexGPT")
        history.pop()
        await message.answer(
            "Не получилось получить ответ от модели, попробуй ещё раз чуть позже."
        )
        return

    history.append({"role": "assistant", "content": answer})
    await message.answer(answer)


async def main():
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
