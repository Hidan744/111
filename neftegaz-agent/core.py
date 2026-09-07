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


# Категории для выбора в боте — каждая подключает только своё правило
# (00_metodologiya_yadro.md подключается всегда, отдельно перечислять не
# нужно). "Общий режим" — старое поведение, вся база сразу.
CATEGORIES = [
    {
        "id": "1",
        "name": "Расчёт дебита нефти и эффекта ГТМ",
        "files": ["02_raschety_debit_gtm.md"],
    },
    {
        "id": "2",
        "name": "Нормативная проверка (промбезопасность)",
        "files": ["03_normativka.md"],
    },
    {
        "id": "3",
        "name": "Подбор оборудования механизированной добычи (ШГН/ЭЦН/газлифт)",
        "files": ["04_podbor_oborudovaniya.md"],
    },
    {
        "id": "4",
        "name": "Обучение стажёра",
        "files": ["05_obuchenie_stazhera.md"],
    },
    {
        "id": "5",
        "name": "КРС: категория скважины по степени опасности ГНВП",
        "files": ["06_krs_kategoriya_skvazhiny.md"],
    },
    {
        "id": "6",
        "name": "КРС: глушение скважин",
        "files": ["07_krs_glushenie_skvazhin.md"],
    },
    {
        "id": "7",
        "name": "КРС: безопасный статический уровень (БСУ)",
        "files": ["08_krs_staticheskiy_uroven.md"],
    },
    {
        "id": "8",
        "name": "КРС: монтаж и спуск ЭПУ (УЭЦН)",
        "files": ["09_krs_montazh_epu.md"],
    },
    {
        "id": "9",
        "name": "КРС: определение пластового давления",
        "files": ["10_krs_plastovoe_davlenie.md"],
    },
    {
        "id": "0",
        "name": "Общий режим (вся база сразу, без выбора темы)",
        "files": None,
    },
]

CATEGORY_BY_ID = {c["id"]: c for c in CATEGORIES}

CORE_FILE = "00_metodologiya_yadro.md"


def format_category_menu() -> str:
    """Готовый текст меню выбора категории для любого из ботов."""
    lines = ["Выбери тему (пришли номер):"]
    for c in CATEGORIES:
        lines.append(f"{c['id']}. {c['name']}")
    return "\n".join(lines)


def load_knowledge_base(filenames: list[str] | None = None) -> str:
    """
    Читает .md файлы из папки kb/ и склеивает их в один текст.

    filenames — список конкретных имён файлов (без пути) в нужном
    порядке. Если None — читаются ВСЕ .md файлы в папке по алфавиту
    (старое поведение, "общий режим").
    """
    if filenames is None:
        files = sorted(glob.glob(os.path.join(KB_FOLDER, "*.md")))
    else:
        files = [os.path.join(KB_FOLDER, name) for name in filenames]

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
    """
    Обёртка над LLM с уже встроенной базой знаний.

    category_id — id из CATEGORIES (см. выше). Если задан, в системный
    промпт попадает только ядро методологии (00_...) + файлы этой
    категории — вместо всей базы сразу. Если None или id не найден —
    старое поведение: вся база знаний целиком ("общий режим").
    """

    def __init__(self, category_id: str | None = None):
        category = CATEGORY_BY_ID.get(category_id) if category_id else None

        if category and category["files"] is not None:
            self.category_name = category["name"]
            filenames = [CORE_FILE] + category["files"]
        else:
            self.category_name = (
                category["name"] if category else "Общий режим (вся база сразу)"
            )
            filenames = None

        self.system_prompt = build_system_prompt(load_knowledge_base(filenames))

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
