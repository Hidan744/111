"""
Общая логика нефтегазового ассистента: загрузка базы знаний из kb/,
сборка системного промпта и обращение к модели через OpenAI-совместимый
API — по умолчанию Yandex AI Studio, либо российский агрегатор AITunnel
(переключается через LLM_PROVIDER в .env, см. .env.example).

Используется всеми интерфейсами проекта, чтобы логика и база знаний
не расходились между ними:
    - bot.py           — консольная версия (быстрый тест)
    - bot_max.py        — бот для мессенджера MAX
    - bot_telegram.py   — бот для Telegram
    - app_web.py         — отдельное веб-приложение (браузер)
"""

import glob
import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()  # подхватывает переменные из файла .env, если он есть рядом

KB_FOLDER = os.path.join(os.path.dirname(__file__), "kb")

# Какого провайдера использовать: "yandex" (по умолчанию) или "aitunnel".
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "yandex").strip().lower()

# Данные для подключения к Yandex AI Studio. Проще всего задать их через
# переменные окружения (см. .env.example), но можно и напрямую вписать
# сюда для быстрого теста.
YANDEX_API_KEY = os.environ.get("YANDEX_API_KEY", "<ВСТАВЬ_СВОЙ_API_KEY>")
YANDEX_FOLDER_ID = os.environ.get("YANDEX_FOLDER_ID", "<ВСТАВЬ_СВОЙ_FOLDER_ID>")
YANDEX_MODEL = os.environ.get("YANDEX_MODEL", "yandexgpt/latest")

# Данные для подключения к AITunnel (agregator с оплатой в рублях,
# доступ к DeepSeek/GPT/Claude через OpenAI-совместимый API).
AITUNNEL_API_KEY = os.environ.get("AITUNNEL_API_KEY", "")
AITUNNEL_MODEL = os.environ.get("AITUNNEL_MODEL", "deepseek-r1")

# Необязательно: сколько максимум токенов модель может сгенерировать за
# один ответ. DeepSeek-R1 тратит часть токенов на скрытые "рассуждения",
# поэтому для него AITunnel рекомендует ставить не меньше 50000.
LLM_MAX_TOKENS = os.environ.get("LLM_MAX_TOKENS")


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


class Assistant:
    """Обёртка над YandexGPT с уже встроенной базой знаний."""

    def __init__(self):
        self.system_prompt = build_system_prompt(load_knowledge_base())

        if LLM_PROVIDER == "aitunnel":
            self.client = OpenAI(
                api_key=AITUNNEL_API_KEY,
                base_url="https://api.aitunnel.ru/v1/",
            )
            self.model = AITUNNEL_MODEL
        else:
            self.client = OpenAI(
                api_key=YANDEX_API_KEY,
                base_url="https://ai.api.cloud.yandex.net/v1",
                project=YANDEX_FOLDER_ID,
            )
            self.model = f"gpt://{YANDEX_FOLDER_ID}/{YANDEX_MODEL}"

    def ask(self, history: list[dict]) -> str:
        """
        Отправляет диалог модели и возвращает текст ответа.

        history — список сообщений диалога (роли "user"/"assistant"),
        без системного промпта — он подставляется автоматически.
        """
        messages = [{"role": "system", "content": self.system_prompt}, *history]
        extra = {}
        if LLM_MAX_TOKENS:
            extra["max_tokens"] = int(LLM_MAX_TOKENS)

        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.2,
            **extra,
        )
        return response.choices[0].message.content
