# Threat Feed Bot

An automated threat intelligence RSS feed collector that posts new alerts to Microsoft Teams.

## Overview

This bot automatically monitors threat intelligence RSS feeds and posts new entries to a Microsoft Teams channel using webhooks. It runs every 30 minutes via GitHub Actions and uses simple file-based state tracking to avoid duplicate postings.

## Features

- 🔄 **Automated Processing**: Runs every 30 minutes via GitHub Actions
- 🚫 **Duplicate Prevention**: Tracks processed items to avoid spam
- 📢 **Teams Integration**: Posts formatted adaptive cards to Microsoft Teams
- 🛡️ **Reliable**: Graceful error handling - one broken feed won't stop others
- ⚙️ **Configurable**: Easy to add/remove RSS feeds via JSON configuration

## Quick Start

### 1. Fork this repository

Click the "Fork" button to create your own copy of this repository.

### 2. Configure RSS Feeds

Edit `feeds.json` to customize which threat intelligence sources you want to monitor:

```json
[
  {
    "name": "CISA",
    "url": "https://www.cisa.gov/cybersecurity-advisories/all.xml"
  },
  {
    "name": "US-CERT", 
    "url": "https://www.cisa.gov/uscert/ncas/alerts.xml"
  }
]
```

### 3. Set up Microsoft Teams Webhook

1. In Microsoft Teams, go to the channel where you want to receive alerts
2. Click the three dots (⋯) next to the channel name
3. Select "Connectors" → "Incoming Webhook"
4. Configure the webhook and copy the URL

### 4. Configure GitHub Secrets

In your GitHub repository, go to Settings → Secrets and variables → Actions, then add:

- **TEAMS_WEBHOOK_URL**: Your Microsoft Teams webhook URL

### 5. Enable GitHub Actions

The workflow will automatically start running every 30 minutes. You can also trigger it manually from the Actions tab.

## Project Structure

```
threat-feed-bot/
├── fetch-and-post.js       # Main logic - RSS polling and processing
├── post-to-teams.js        # Teams webhook integration
├── feeds.json              # RSS feed configurations
├── state.json              # Tracks last processed items (auto-updated)
├── package.json            # Node.js dependencies
├── .github/workflows/
│   └── rss-to-teams.yml    # GitHub Actions workflow
└── README.md               # This file
```

## Configuration Files

### feeds.json
```json
[
  {
    "name": "Unique Feed Name",
    "url": "https://example.com/rss-feed.xml"
  }
]
```

### state.json (auto-managed)
```json
{
  "CISA": "https://www.cisa.gov/news/2024/01/15/cisa-releases-advisory",
  "US-CERT": "https://www.cisa.gov/uscert/ncas/alerts/AA24-015A"
}
```

## Local Development

### Prerequisites
- Node.js 18 or later
- npm or yarn

### Setup
```bash
# Install dependencies
npm install

# Set environment variable
export TEAMS_WEBHOOK_URL="your-webhook-url-here"

# Run the bot
npm start
```

### Testing
```bash
# Test a single run
node fetch-and-post.js
```

## How It Works

1. **RSS Parsing**: Uses `rss-parser` to fetch and parse RSS feeds
2. **State Tracking**: Compares new items against `state.json` to identify unseen content
3. **Teams Posting**: Sends formatted adaptive cards to Teams via webhook
4. **State Updates**: Updates `state.json` with latest processed items
5. **Automation**: GitHub Actions runs the process every 30 minutes

## Customization

### Adding New Feeds
Add entries to `feeds.json`:
```json
{
  "name": "Your Feed Name",
  "url": "https://example.com/feed.xml"
}
```

### Modifying the Schedule
Edit `.github/workflows/rss-to-teams.yml`:
```yaml
schedule:
  - cron: '0 */2 * * *'  # Every 2 hours instead of 30 minutes
```

### Customizing Teams Messages
Modify the `payload` object in `post-to-teams.js` to change the message format.

## Troubleshooting

### Common Issues

**GitHub Actions not running:**
- Check that you've enabled GitHub Actions in your repository settings
- Verify the TEAMS_WEBHOOK_URL secret is set correctly

**No messages appearing in Teams:**
- Verify your webhook URL is correct and active
- Check the GitHub Actions logs for error messages
- Test the webhook manually using a tool like curl

**Duplicate messages:**
- The `state.json` file tracks processed items
- If you're getting duplicates, check if the state file is being committed properly

### Logs
Check the GitHub Actions logs under the "Actions" tab in your repository for detailed execution information.

## Security Considerations

- Webhook URLs should be kept secret (stored as GitHub Secrets)
- RSS feeds are accessed over HTTPS when possible
- No sensitive data is stored in the repository
- State file only contains public RSS item URLs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the GitHub Actions logs
2. Review this README
3. Open an issue in the GitHub repository
