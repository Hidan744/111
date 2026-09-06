"""
Прогоняет тестовые кейсы из cases.py через реального ассистента (core.Assistant)
и сохраняет отчёт с ответами модели рядом с эталонным расчётом/чек-листом —
для ручной сверки глазами (сама методология требует показывать ход
рассуждения, а не просто верить итоговому числу).

Нужен настоящий доступ к Yandex AI Studio: скопируй .env.example в .env
и впиши свои YANDEX_API_KEY/YANDEX_FOLDER_ID перед запуском.

Как запустить:
    python tests/run_cases.py
"""

import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cases import CASES  # noqa: E402
from core import Assistant  # noqa: E402

RESULTS_DIR = os.path.join(os.path.dirname(__file__), "results")


def run() -> str:
    assistant = Assistant()
    os.makedirs(RESULTS_DIR, exist_ok=True)

    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    report_path = os.path.join(RESULTS_DIR, f"{timestamp}.md")

    lines = [f"# Результаты прогона тестовых кейсов — {timestamp}\n"]

    for case in CASES:
        print(f"[{case['id']}] запрашиваю ответ модели...")
        lines.append(f"## {case['id']} — {case['category']}\n")
        lines.append("**Вопрос:**\n")
        lines.append(f"```\n{case['prompt']}\n```\n")
        lines.append("**Эталон/чек-лист (посчитан вручную по kb/):**\n")
        lines.append(f"{case['reference']}\n")

        try:
            answer = assistant.ask([{"role": "user", "content": case["prompt"]}])
        except Exception as exc:
            answer = f"ОШИБКА при обращении к модели: {exc}"
            print(f"[{case['id']}] ошибка: {exc}")

        lines.append("**Ответ модели:**\n")
        lines.append(f"{answer}\n")
        lines.append("---\n")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\nГотово. Отчёт сохранён в {report_path}")
    return report_path


if __name__ == "__main__":
    run()
