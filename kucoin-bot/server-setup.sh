#!/usr/bin/env bash
# Установка бота на сервер Ubuntu/Debian как службы systemd.
# Запуск из папки бота под root:   bash server-setup.sh
# По умолчанию запускается режим auto на виртуальных деньгах.
# Другая команда:                  bash server-setup.sh "auto --live --confirm"
set -euo pipefail
cd "$(dirname "$0")"
DIR="$(pwd)"
CMD="${1:-auto}"
SERVICE=kucoin-bot

sed -i 's/\r$//' .env 2>/dev/null || true   # .env, отредактированный в Windows
echo ">> Устанавливаю Python..."
apt-get update -qq
apt-get install -y -qq python3 python3-venv >/dev/null
echo ">> Создаю окружение и ставлю зависимости..."
python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
[ -f .env ] || cp .env.example .env

echo ">> Создаю службу $SERVICE ($CMD)..."
cat > /etc/systemd/system/$SERVICE.service <<UNIT
[Unit]
Description=KuCoin bot ($CMD)
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$DIR
ExecStart=$DIR/.venv/bin/python main.py $CMD
Restart=on-failure
RestartSec=60
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
UNIT

cat > /usr/local/bin/bot <<CLI
#!/usr/bin/env bash
# Короткие команды: bot stats | bot log | bot status | bot restart | bot stop | bot start
cd "$DIR"
case "\${1:-status}" in
  log)     journalctl -u $SERVICE -n 50 -f ;;
  status)  systemctl status $SERVICE --no-pager -l | head -15 ;;
  restart|stop|start) systemctl \$1 $SERVICE && systemctl status $SERVICE --no-pager | head -3 ;;
  *)       .venv/bin/python main.py "\$@" ;;
esac
CLI
chmod +x /usr/local/bin/bot

systemctl daemon-reload
systemctl enable --now $SERVICE >/dev/null 2>&1
systemctl restart $SERVICE
sleep 5
echo
systemctl status $SERVICE --no-pager | head -5
echo
echo "Готово. Бот работает как служба и сам стартует после перезагрузки сервера."
echo "  bot stats    — статистика"
echo "  bot log      — лог в реальном времени (выход: Ctrl+C, бот продолжит работать)"
echo "  bot status   — работает ли бот"
echo "  bot restart  — перезапуск (например, после правки .env)"
