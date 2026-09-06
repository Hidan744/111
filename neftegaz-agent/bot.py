"""
Нефтегазовый ИИ-ассистент поверх Yandex AI Studio (YandexGPT) — консольная версия.

Это самый быстрый способ проверить, что ассистент вообще ведёт себя
правильно, прежде чем подключать его к MAX (bot_max.py) или веб-интерфейсу
(app_web.py) — вся логика и база знаний общие, см. core.py.

Как запустить:
    1. pip install -r requirements.txt
    2. Скопировать .env.example в .env и вписать свои значения
    3. python bot.py
"""

from core import Assistant


def main():
    assistant = Assistant()
    print("Нефтегазовый ассистент готов. Пиши вопрос (или 'exit' для выхода).\n")

    # Храним историю диалога, чтобы модель помнила контекст в рамках сессии
    history = []

    while True:
        user_input = input("Ты: ").strip()
        if user_input.lower() in ("exit", "quit", "выход"):
            break
        if not user_input:
            continue

        history.append({"role": "user", "content": user_input})

        answer = assistant.ask(history)
        print(f"\nАссистент: {answer}\n")

        history.append({"role": "assistant", "content": answer})


if __name__ == "__main__":
    main()
