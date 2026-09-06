"""
Нефтегазовый ИИ-ассистент поверх Yandex AI Studio (YandexGPT).

Что делает этот скрипт:
1. Собирает все файлы базы знаний из папки kb/ в одну системную инструкцию.
2. Подключается к Yandex AI Studio через OpenAI-совместимый API.
3. Запускает простой диалог в консоли: ты пишешь вопрос — модель отвечает,
   опираясь на базу знаний из kb/.

Это MVP-версия (Уровень 2 из нашего плана): без векторной базы/поиска,
вся база знаний передаётся моделью как контекст. Для небольшой библиотеки
(наши 6 файлов) этого достаточно и не требует настройки поискового индекса.

Как запустить:
    1. pip install -r requirements.txt
    2. Скопировать .env.example в .env и вписать свои значения
    3. python bot.py
"""

import os
import glob

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()  # подхватывает переменные из файла .env, если он есть рядом

# --- Настройки ---------------------------------------------------------

KB_FOLDER = os.path.join(os.path.dirname(__file__), "kb")

# Данные для подключения. Проще всего задать их через переменные окружения
# (см. .env.example), но можно и напрямую вписать сюда для быстрого теста.
YANDEX_API_KEY = os.environ.get("YANDEX_API_KEY", "<ВСТАВЬ_СВОЙ_API_KEY>")
YANDEX_FOLDER_ID = os.environ.get("YANDEX_FOLDER_ID", "<ВСТАВЬ_СВОЙ_FOLDER_ID>")
YANDEX_MODEL = os.environ.get("YANDEX_MODEL", "yandexgpt/latest")


def load_knowledge_base() -> str:
    """Читает все .md файлы из папки kb/ и склеивает их в один текст."""
    files = sorted(glob.glob(os.path.join(KB_FOLDER, "*.md")))
    if not files:
        raise FileNotFoundError(
            f"Не найдено ни одного .md файла в {KB_FOLDER}. "
            "Проверь, что папка kb/ на месте рядом со скриптом."
        )

    parts = []
    for path in files:
        with open(path, "r", encoding="utf-8") as f:
            parts.append(f.read())

    return "\n\n---\n\n".join(parts)


def build_system_prompt(knowledge_base: str) -> str:
    """Оборачивает базу знаний в системную инструкцию для модели."""
    return (
        "Ты — специализированный ИИ-ассистент для нефтегазовой отрасли. "
        "Твоя база знаний (методология, расчётные формулы, нормативные "
        "ориентиры, подбор оборудования, стиль обучения новичков) приведена "
        "ниже. Строго следуй методологии из раздела 'Ядро методологии' при "
        "формировании ЛЮБОГО ответа — определяй тип задачи, проверяй "
        "полноту вводных данных, показывай ход расчёта, разделяй факт и "
        "рекомендацию, добавляй нужные дисклеймеры.\n\n"
        "=== БАЗА ЗНАНИЙ ===\n\n"
        f"{knowledge_base}\n\n"
        "=== КОНЕЦ БАЗЫ ЗНАНИЙ ==="
    )


def main():
    knowledge_base = load_knowledge_base()
    system_prompt = build_system_prompt(knowledge_base)

    client = OpenAI(
        api_key=YANDEX_API_KEY,
        base_url="https://ai.api.cloud.yandex.net/v1",
        project=YANDEX_FOLDER_ID,
    )

    print("Нефтегазовый ассистент готов. Пиши вопрос (или 'exit' для выхода).\n")

    # Храним историю диалога, чтобы модель помнила контекст в рамках сессии
    messages = [{"role": "system", "content": system_prompt}]

    while True:
        user_input = input("Ты: ").strip()
        if user_input.lower() in ("exit", "quit", "выход"):
            break
        if not user_input:
            continue

        messages.append({"role": "user", "content": user_input})

        response = client.chat.completions.create(
            model=f"gpt://{YANDEX_FOLDER_ID}/{YANDEX_MODEL}",
            messages=messages,
            temperature=0.2,
        )

        answer = response.choices[0].message.content
        print(f"\nАссистент: {answer}\n")

        messages.append({"role": "assistant", "content": answer})


if __name__ == "__main__":
    main()
