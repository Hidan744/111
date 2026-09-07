"""
Нефтегазовый ИИ-ассистент — отдельное веб-приложение с чатом в браузере.

Использует ту же базу знаний и ту же логику обращения к YandexGPT, что и
консольная версия (bot.py) и бот для MAX (bot_max.py) — см. core.py.

Как запустить:
    1. pip install -r requirements.txt
    2. Скопировать .env.example в .env и вписать свои значения
    3. streamlit run app_web.py

Откроется страница в браузере (по умолчанию http://localhost:8501) —
её можно открывать с любого устройства в той же сети, а при деплое на
хостинг (Streamlit Community Cloud и т.п.) — дать клиентам прямую ссылку.

Сверху — выбор темы (категории): ассистент отвечает только по базе
знаний выбранной темы, а не по всей базе сразу. При смене темы история
чата сбрасывается (правила/формулы разных тем не должны смешиваться).
"""

import hmac
import os

import streamlit as st

from core import Assistant, CATEGORIES

st.set_page_config(page_title="Нефтегазовый ассистент", page_icon="🛢️")
st.title("🛢️ Нефтегазовый ИИ-ассистент")


def check_password() -> bool:
    """Простая защита паролем — чтобы по ссылке чужими руками не тратили
    баланс Yandex Cloud, привязанный к API-ключу."""

    def password_entered():
        entered = st.session_state.get("password", "")
        expected = os.environ.get("APP_PASSWORD", "")
        if expected and hmac.compare_digest(entered, expected):
            st.session_state["password_correct"] = True
            del st.session_state["password"]
        else:
            st.session_state["password_correct"] = False

    if st.session_state.get("password_correct"):
        return True

    st.text_input("Пароль", type="password", on_change=password_entered, key="password")
    if "password_correct" in st.session_state:
        st.error("Неверный пароль")
    return False


if not check_password():
    st.stop()


@st.cache_resource
def get_assistant(category_id: str) -> Assistant:
    return Assistant(category_id)


category_names = {c["id"]: c["name"] for c in CATEGORIES}

selected_id = st.selectbox(
    "Тема",
    options=list(category_names.keys()),
    format_func=lambda cid: category_names[cid],
)

if st.session_state.get("current_category") != selected_id:
    st.session_state.current_category = selected_id
    st.session_state.history = []

assistant = get_assistant(selected_id)

if "history" not in st.session_state:
    st.session_state.history = []

for message in st.session_state.history:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

question = st.chat_input("Напиши вопрос по выбранной теме...")

if question:
    st.session_state.history.append({"role": "user", "content": question})
    with st.chat_message("user"):
        st.markdown(question)

    with st.chat_message("assistant"):
        with st.spinner("Думаю..."):
            try:
                answer = assistant.ask(st.session_state.history)
            except Exception as exc:
                answer = f"Не получилось получить ответ от модели: {exc}"
        st.markdown(answer)

    st.session_state.history.append({"role": "assistant", "content": answer})
