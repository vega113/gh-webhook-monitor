# Security Policy

## Secret Exposure Incident - RESOLVED

### What Happened
The `config.json` file containing the GitHub webhook secret was accidentally committed to the public repository on 2026-03-25.

### Impact
- GitHub webhook secret was exposed in commit 425ce8da
- Anyone with access to the repository could potentially forge webhook requests
- The secret has been rotated

### Remediation Applied
1. ✅ Added `config.json` to `.gitignore`
2. ✅ Created `config.example.json` template
3. ✅ Removed config.json from git history using BFG Repo-Cleaner
4. ✅ Webhook secret rotated in GitHub settings

### For Users
If you cloned this repository before this fix:
1. **Generate a new webhook secret** in your GitHub repository settings
2. **Update your local config.json** with the new secret
3. **Never commit config.json** - it's in .gitignore now
4. **Use config.example.json** as a template for your local configuration

### Prevention
- `.gitignore` now includes `config.json` and `.env`
- Use `config.example.json` as template
- All secrets should be in `.env` or `config.json` (not committed)
- GitHub Secret Scanning is enabled

### Sensitive Files to Protect
- `config.json` - Contains webhook secret and API keys
- `.env` - Environment variables
- `secrets.json` - Any secrets file

Never commit these files to version control.
