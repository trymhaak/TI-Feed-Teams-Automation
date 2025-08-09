# Emergency Workflow Control

## To Immediately Stop Teams Spam

### Option 1: Disable via GitHub Web Interface
1. Go to https://github.com/trymhaak/TI-Feed-Teams-Automation/actions
2. Click on "Threat Feed Bot" workflow
3. Click the "..." menu in the top right
4. Select "Disable workflow"

### Option 2: Via Command Line (if you have GitHub CLI)
```bash
gh workflow disable "Threat Feed Bot" --repo trymhaak/TI-Feed-Teams-Automation
```

### Option 3: Manual Edit
Edit `.github/workflows/rss-to-teams.yml` and comment out the schedule:
```yaml
on:
  # schedule:
  #   - cron: '0 */4 * * *'  # Every 4 hours
  workflow_dispatch:        # Manual trigger only
```

## What Was Fixed

1. **Reduced frequency**: Changed from every 30 minutes to every 4 hours
2. **Limited items per feed**: Reduced from 10 to 1 item per feed per run
3. **Improved duplicate detection**: Added timestamp-based checking
4. **Enhanced state tracking**: Better handling of processed items

## Testing the Fix

Run a dry-run to verify the fix:
```bash
cd /path/to/project
node fetch-and-post.js --dry-run
```

This should show only 1 item per feed maximum.
