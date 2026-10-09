#!/usr/bin/env bash
# deploy/turn-setup.sh
# Puts a TURN relay next to the app so the calls (audio, camera, screen) connect between any two networks: it writes the
# TURN_* variables of .env, opens the ports of the machine and starts the relay and the app. Run it once on the server:
#   bash deploy/turn-setup.sh            (calls try a direct path first and use the relay when they must)
#   bash deploy/turn-setup.sh --private  (every call goes through the relay: the most private)
# Afterwards, in Oracle Cloud (Networking > your VCN > Security List > Ingress rules) allow: UDP 3478, TCP 3478 and
# UDP 49152-49252 (source 0.0.0.0/0). That part cannot be done from here.
set -euo pipefail
cd "$(dirname "$0")/.."
touch .env

# Reads a variable of .env (empty when absent) and writes one.
get() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- || true; }
put() { if grep -qE "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi; }

DOMAIN="$(get DOMAIN)"
if [ -z "$DOMAIN" ]; then echo "Write DOMAIN=your.domain in .env first."; exit 1; fi
SECRET="$(get TURN_SECRET)"
[ -n "$SECRET" ] || SECRET="$(openssl rand -hex 24)"
PUBLIC_IP="$(curl -fsS https://api.ipify.org)"
PRIVATE_IP="$(ip -4 route get 1.1.1.1 | grep -oP 'src \K\S+' | head -1)"

put TURN_SECRET "$SECRET"
put TURN_PUBLIC_IP "$PUBLIC_IP"
put TURN_PRIVATE_IP "$PRIVATE_IP"
put TURN_URLS "turn:$DOMAIN:3478?transport=udp,turn:$DOMAIN:3478?transport=tcp"
# With --private every call goes through the relay: the addresses of the people are never shown to each other or to anybody else.
if [ "${1:-}" = "--private" ]; then put RELAY_ONLY 1; fi
echo "Public IP $PUBLIC_IP, private IP $PRIVATE_IP, domain $DOMAIN."

# The images of Oracle block everything with iptables except what is allowed here.
open_port() {
  sudo iptables -C INPUT -p "$1" --dport "$2" -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 6 -p "$1" --dport "$2" -j ACCEPT
}
open_port udp 3478
open_port tcp 3478
open_port udp 49152:49252
sudo netfilter-persistent save >/dev/null 2>&1 || true

if docker compose version >/dev/null 2>&1; then COMPOSE="docker compose"; else COMPOSE="docker-compose"; fi
# Replaced (removed first, then created): recreating a container with docker-compose 1.x fails with 'ContainerConfig'.
$COMPOSE --profile turn rm -sf turn
$COMPOSE --profile turn up -d turn
# The app reads the TURN variables when it starts.
$COMPOSE rm -sf app
$COMPOSE up -d app
echo "Done. Do not forget the rules of the VCN in Oracle Cloud (UDP 3478, TCP 3478, UDP 49152-49252)."
