"""
Нефтегазовый ИИ-ассистент поверх Yandex AI Studio (YandexGPT) — консольная версия.

Это самый быстрый способ проверить, что ассистент вообще ведёт себя
правильно, прежде чем подключать его к MAX (bot_max.py) или веб-интерфейсу
(app_web.py) — вся логика и база знаний общие, см. core.py.

Сначала выбираешь тему (категорию) из меню — дальше ассистент работает
только с базой знаний этой темы, не со всей базой сразу. Команда "меню"
в любой момент открывает выбор темы заново (и сбрасывает историю диалога).

Как запустить:
    1. pip install -r requirements.txt
    2. Скопировать .env.example в .env и вписать свои значения
    3. python bot.py
"""

from core import Assistant, CATEGORY_BY_ID, format_category_menu


def choose_category() -> str:
    print(format_category_menu())
    while True:
        choice = input("Номер темы: ").strip()
        if choice in CATEGORY_BY_ID:
            return choice
        print("Не понял номер, попробуй ещё раз.")


def main():
    print("Нефтегазовый ассистент готов.\n")

    category_id = choose_category()
    assistant = Assistant(category_id)
    history = []
    print(f"\nТема: {assistant.category_name}. Пиши вопрос (или 'exit' для выхода, 'меню' — сменить тему).\n")

    while True:
        user_input = input("Ты: ").strip()
        if user_input.lower() in ("exit", "quit", "выход"):
            break
        if user_input.lower() == "меню":
            category_id = choose_category()
            assistant = Assistant(category_id)
            history = []
            print(f"\nТема: {assistant.category_name}. Пиши вопрос.\n")
            continue
        if not user_input:
            continue

        history.append({"role": "user", "content": user_input})

        answer = assistant.ask(history)
        print(f"\nАссистент: {answer}\n")

        history.append({"role": "assistant", "content": answer})


if __name__ == "__main__":
    main()
