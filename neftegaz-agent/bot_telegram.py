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

Сначала бот просит выбрать тему (категорию) — дальше отвечает только по
базе знаний этой темы, а не по всей базе сразу (быстрее, дешевле, без
"каши" из несвязанных разделов). Команда /menu меняет тему в любой
момент (и сбрасывает историю диалога).

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

from core import Assistant, CATEGORY_BY_ID, format_category_menu

logging.basicConfig(level=logging.INFO)

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")

ALLOWED_USER_IDS = {
    int(uid) for uid in os.environ.get("TELEGRAM_ALLOWED_USER_IDS", "").split(",") if uid.strip()
}

bot = Bot(token=TELEGRAM_BOT_TOKEN)
dp = Dispatcher()

# chat_id -> {"assistant": Assistant | None, "history": [...]}
# assistant=None значит "ждём выбора темы от пользователя"
sessions: dict[int, dict] = {}


def is_allowed(user_id: int) -> bool:
    return not ALLOWED_USER_IDS or user_id in ALLOWED_USER_IDS


def start_menu(chat_id: int) -> None:
    sessions[chat_id] = {"assistant": None, "history": []}


@dp.message(Command("myid"))
async def on_myid(message: Message):
    await message.answer(
        f"Твой Telegram ID: {message.from_user.id}\n"
        "Отправь его владельцу бота, чтобы получить доступ."
    )


@dp.message(CommandStart())
@dp.message(Command("menu"))
async def on_start(message: Message):
    if not is_allowed(message.from_user.id):
        await message.answer(
            "У тебя нет доступа к этому боту. Напиши /myid, узнай свой ID "
            "и попроси владельца добавить его в список допущенных."
        )
        return
    start_menu(message.chat.id)
    await message.answer(format_category_menu())


@dp.message(F.text)
async def on_message(message: Message):
    if not is_allowed(message.from_user.id):
        await message.answer(
            "У тебя нет доступа к этому боту. Напиши /myid, узнай свой ID "
            "и попроси владельца добавить его в список допущенных."
        )
        return

    chat_id = message.chat.id
    session = sessions.get(chat_id)

    if session is None or session["assistant"] is None:
        choice = message.text.strip()
        if choice not in CATEGORY_BY_ID:
            start_menu(chat_id)
            await message.answer(
                "Не понял номер темы. " + format_category_menu()
            )
            return
        assistant = Assistant(choice)
        sessions[chat_id] = {"assistant": assistant, "history": []}
        await message.answer(
            f"Тема: {assistant.category_name}\n"
            "Пиши вопрос. Команда /menu — сменить тему."
        )
        return

    assistant = session["assistant"]
    history = session["history"]
    history.append({"role": "user", "content": message.text})

    try:
        answer = assistant.ask(history)
    except Exception:
        logging.exception("Ошибка обращения к модели")
        history.pop()
        await message.answer(
            "Не получилось получить ответ от модели, попробуй ещё раз чуть позже."
        )
        return

    history.append({"role": "assistant", "content": answer})
    await message.answer(answer)


async def main():
    import core
    logging.info(
        "Бот запущен [версия: меню тем, категорий: %d]. core.py загружен из: %s",
        len(CATEGORY_BY_ID), core.__file__,
    )
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
