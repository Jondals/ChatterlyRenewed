# Putting Chatterly-Renewed on a free server (Oracle Cloud)

1. **The machine.** In Oracle Cloud create an *Always Free* instance: shape `VM.Standard.A1.Flex` (ARM, up to 4 cores and 24 GB), image Ubuntu 24.04, and download the SSH key.
2. **Open the ports.** In the VCN of the instance (Networking > Security List) add *ingress* rules for TCP 80 and 443. Ubuntu images of Oracle also block them with iptables:
   `sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT && sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT && sudo netfilter-persistent save`
3. **A domain.** The browser only allows microphone, camera and encryption on HTTPS, so you need a name: a free one from [duckdns.org](https://www.duckdns.org) pointing to the public IP of the instance.
4. **Software.**
   `sudo apt update && sudo apt install -y git caddy` · Node 22 (`curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`) · `sudo corepack enable`.
5. **The app.** `git clone <your repository> ~/ChatterlyRenewed && cd ~/ChatterlyRenewed && pnpm run install:all && pnpm build`.
6. **Run it always.** Copy `deploy/chatterly.service` to `/etc/systemd/system/` (change the domain and the user), then `sudo systemctl enable --now chatterly`. The database and the keys of the server are kept in `DATA_DIR`: make copies of that folder.
7. **HTTPS.** Copy `deploy/Caddyfile` to `/etc/caddy/Caddyfile` (change the domain) and `sudo systemctl reload caddy`. Caddy gets and renews the certificate by itself.
8. **Updates after every commit.** Let the user run `deploy/update.sh` without a password (`echo 'ubuntu ALL=NOPASSWD: /bin/systemctl restart chatterly' | sudo tee /etc/sudoers.d/chatterly`) and add the three secrets that `.github/workflows/deploy.yml` mentions. From then on, every push to `main` updates the server.
9. **Your own STUN and TURN servers, free, in the same machine** (see "Calls" below).

## Calls: STUN, TURN and the signalling

- **Signalling** is the WebSocket `/ws` of the backend. Caddy passes it on by itself (`reverse_proxy` understands WebSockets), so nothing else is needed. What travels through it is sealed: the messages are encrypted in the browser and the offers and answers of a call are signed and encrypted between the two people, so the server only forwards them.
- **STUN** tells a browser its public address. The app uses Google's by default; you can use your own (coturn does STUN too).
- **TURN** relays the media when a direct path is impossible (phones on mobile data, strict offices). The media is encrypted frame by frame in the browsers before it reaches TURN, so the relay cannot read it.

Install and start coturn on the machine:

1. `sudo apt install -y coturn` and set `TURNSERVER_ENABLED=1` in `/etc/default/coturn`.
2. Copy `deploy/turnserver.conf` to `/etc/turnserver.conf`, and change `static-auth-secret`, `realm` and `external-ip` (the public IP and the private one of the instance, `ip a` shows it).
3. Open **UDP and TCP 3478** and **UDP 49152-49252**, in the VCN (Security List) *and* in iptables: `sudo iptables -I INPUT 6 -p udp --dport 3478 -j ACCEPT && sudo iptables -I INPUT 6 -p tcp --dport 3478 -j ACCEPT && sudo iptables -I INPUT 6 -p udp --dport 49152:49252 -j ACCEPT && sudo netfilter-persistent save`.
4. `sudo systemctl enable --now coturn`.
5. Tell the backend, in `chatterly.service`: `Environment=STUN_URLS=stun:chatterly.example.com:3478`, `Environment=TURN_URLS=turn:chatterly.example.com:3478?transport=udp,turn:chatterly.example.com:3478?transport=tcp` and `Environment=TURN_SECRET=<the same secret>`. Then `sudo systemctl daemon-reload && sudo systemctl restart chatterly`. The backend gives every user short-lived TURN credentials (one hour) made from that secret; nobody receives the secret.

## When something fails

| Symptom | Cause and cure |
| --- | --- |
| The page loads but nothing works, the console says *CORS* | `CORS_ORIGINS` has to be exactly the address in the browser, with `https://` and without a final slash (`https://chatterly.example.com`). Several addresses go separated by commas. The WebSocket checks the same list. After changing it: `sudo systemctl restart chatterly`. |
| The WebSocket closes at once (code 1008, "origin not allowed") | The same: the origin is not in `CORS_ORIGINS`. |
| Login says the session expired all the time, or every user seems to have the same IP | `TRUST_PROXY=1` is missing: the backend sees Caddy as the only client and the rate limits hit everybody. |
| The microphone or the camera never asks | The page is not on HTTPS (or you opened it by IP). Use the domain. |
| Calls connect only between people on the same network | STUN works but there is no TURN, or its ports are closed. Check with `https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/`: add `turn:chatterly.example.com:3478` with a username and a password taken from `/api/rtc/config` (open it signed in) and look for a `relay` candidate. |
| *Frames rejected* or "Securing…" for ever | The two browsers could not agree on the keys: reload both. If it repeats, look at the console of both browsers and at `journalctl -u chatterly -e`. |
| `502` from Caddy | The backend or the web server is down: `sudo systemctl status chatterly` and `journalctl -u chatterly -e`. |
| After an update nothing changes | The browser keeps the old files: hard reload (Ctrl+Shift+R). |

## Other servers inside the same machine

Everything above runs in one Always Free instance (the ARM one has 4 cores and 24 GB, enough for the app, Caddy and coturn). Keep it healthy: `sudo apt install -y unattended-upgrades`, copy the folder `DATA_DIR` now and then (`rsync` to your computer) and keep an eye on the disk with `df -h`.
