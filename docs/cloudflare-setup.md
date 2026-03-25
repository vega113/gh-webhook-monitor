# Cloudflare Tunnel Setup

GitHub webhooks need a public URL to reach your local server. Cloudflare Tunnel creates a secure connection from the internet to your localhost without opening firewall ports.

## Install cloudflared

**macOS:**
```bash
brew install cloudflare/cloudflare/cloudflared
```

**Linux (Debian/Ubuntu):**
```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared
```

**Verify:**
```bash
cloudflared --version
```

## Option A: Temporary URL (quick test)

No account needed. URL changes each time you restart.

```bash
cloudflared tunnel --url http://localhost:3847
```

Look for a line like:
```
Your quick Tunnel has been created! Visit it at:
https://random-words-here.trycloudflare.com
```

Use `https://random-words-here.trycloudflare.com/webhook` as your GitHub webhook URL.

## Option B: Permanent named tunnel (recommended)

Requires a free Cloudflare account and a domain managed by Cloudflare.

### 1. Authenticate

```bash
cloudflared tunnel login
```

This opens a browser. Select the domain you want to use (e.g., `yourdomain.com`). A certificate is saved to `~/.cloudflared/cert.pem`.

### 2. Create the tunnel

```bash
cloudflared tunnel create gh-webhook
```

This creates credentials at `~/.cloudflared/<tunnel-id>.json`. Note the tunnel ID.

### 3. Create DNS route

```bash
cloudflared tunnel route dns gh-webhook gh-webhook.yourdomain.com
```

This adds a CNAME record in Cloudflare DNS pointing `gh-webhook.yourdomain.com` to your tunnel.

### 4. Create tunnel config

Create `tunnel-config.yml` in the gh-webhook-monitor directory:

```yaml
tunnel: <your-tunnel-id>
credentials-file: /path/to/.cloudflared/<your-tunnel-id>.json

ingress:
  - hostname: gh-webhook.yourdomain.com
    service: http://localhost:3847
  - service: http_status:404
```

Replace `<your-tunnel-id>` with the ID from step 2, and update the credentials path.

### 5. Test the tunnel

```bash
# Start the server
node server.js &

# Start the tunnel
cloudflared tunnel --config tunnel-config.yml run gh-webhook

# Test from another terminal
curl https://gh-webhook.yourdomain.com/api/health
```

### 6. Use start.sh

The included `start.sh` script starts both the server and tunnel together:

```bash
./start.sh
```

Edit `start.sh` to point to your `tunnel-config.yml` if needed.

## Verifying the setup

```bash
# Local health check
curl http://localhost:3847/api/health

# Remote health check (through tunnel)
curl https://gh-webhook.yourdomain.com/api/health

# Both should return: {"status":"ok","activeJobs":0,...}
```

## Common issues

**"failed to fetch origin certificate":**
Run `cloudflared tunnel login` again and select your domain.

**DNS not resolving:**
Wait 1-2 minutes after `cloudflared tunnel route dns` for DNS propagation. Check with `nslookup gh-webhook.yourdomain.com`.

**"connection refused" through tunnel:**
Make sure the server is running on the correct port (default 3847). Check with `curl http://localhost:3847/api/health`.

**Tunnel disconnects frequently:**
Use a named tunnel (Option B) instead of a quick tunnel (Option A). Named tunnels are more stable and reconnect automatically.
