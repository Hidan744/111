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

Сначала бот просит выбрать тему (категорию) — дальше отвечает только по
базе знаний этой темы, а не по всей базе сразу. Команда /menu меняет
тему в любой момент (и сбрасывает историю диалога).

История диалога хранится в памяти процесса отдельно по каждому чату —
при перезапуске бота она сбрасывается.
"""

import asyncio
import logging

from maxapi import Bot, Dispatcher, F
from maxapi.filters.command import Command, CommandStart
from maxapi.types import BotStarted, MessageCreated

from core import Assistant, CATEGORY_BY_ID, format_category_menu

logging.basicConfig(level=logging.INFO)

bot = Bot()  # токен берётся из переменной окружения MAX_BOT_TOKEN
dp = Dispatcher()

# chat_id -> {"assistant": Assistant | None, "history": [...]}
# assistant=None значит "ждём выбора темы от пользователя"
sessions: dict[int, dict] = {}


def start_menu(chat_id: int) -> None:
    sessions[chat_id] = {"assistant": None, "history": []}


@dp.bot_started()
async def on_bot_started(event: BotStarted):
    start_menu(event.chat_id)
    await bot.send_message(chat_id=event.chat_id, text=format_category_menu())


@dp.message_created(CommandStart())
@dp.message_created(Command("menu"))
async def on_start(event: MessageCreated):
    chat_id, _ = event.get_ids()
    start_menu(chat_id)
    await event.message.answer(format_category_menu())


@dp.message_created(F.message.body.text)
async def on_message(event: MessageCreated):
    chat_id, _ = event.get_ids()
    session = sessions.get(chat_id)

    if session is None or session["assistant"] is None:
        choice = event.message.body.text.strip()
        if choice not in CATEGORY_BY_ID:
            start_menu(chat_id)
            await event.message.answer("Не понял номер темы. " + format_category_menu())
            return
        assistant = Assistant(choice)
        sessions[chat_id] = {"assistant": assistant, "history": []}
        await event.message.answer(
            f"Тема: {assistant.category_name}\n"
            "Пиши вопрос. Команда /menu — сменить тему."
        )
        return

    assistant = session["assistant"]
    history = session["history"]
    history.append({"role": "user", "content": event.message.body.text})

    try:
        answer = assistant.ask(history)
    except Exception:
        logging.exception("Ошибка обращения к модели")
        history.pop()
        await event.message.answer(
            "Не получилось получить ответ от модели, попробуй ещё раз чуть позже."
        )
        return

    history.append({"role": "assistant", "content": answer})
    await event.message.answer(answer)


async def main():
    import core
    logging.info(
        "Бот запущен [версия: меню тем, категорий: %d]. core.py загружен из: %s",
        len(CATEGORY_BY_ID), core.__file__,
    )
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
