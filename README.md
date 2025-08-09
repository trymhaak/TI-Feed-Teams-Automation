# Threat Feed Bot

A professional, modular threat intelligence RSS feed collector that posts enhanced security alerts to Microsoft Teams with intelligent classification and formatting.

## Overview

This bot automatically monitors multiple threat intelligence RSS feeds and posts classified security alerts to Microsoft Teams. Built with a clean, modular architecture, it features intelligent threat classification, severity detection, modular feed parsers, and comprehensive validation. The bot runs on a 5-minute schedule in production (GitHub Actions) with robust state tracking to prevent duplicates and logic to handle API rate-limits.

## Features

### Core Functionality
- 🔄 **Automated Processing**: Runs every 30 minutes via GitHub Actions
- 🚫 **Duplicate Prevention**: Sophisticated state tracking prevents spam
- 📢 **Teams Integration**: Rich adaptive cards with threat intelligence context
- 🛡️ **Reliable**: Comprehensive error handling and graceful fallbacks
- ⚙️ **Configurable**: JSON-based feed configuration with validation

### Intelligence Features
- 🎯 **Threat Classification**: Automatic categorization (Malware, Vulnerability, Phishing, APT, Data Breach)
- 🚨 **Severity Detection**: Critical, High, Medium, Info priority levels
- 📊 **Content Filtering**: Intelligent filtering for relevant threat intelligence
- 🏷️ **Feed Metadata**: Enhanced context with source, region, and category information
- ⚡ **Priority-Based Processing**: Configurable delays based on feed importance

### Architecture
- 🏗️ **Modular Design**: Clean separation of parsers, validation, and formatting
- 🔧 **Custom Parsers**: Support for feed-specific parsing logic
- ✅ **Input Validation**: Comprehensive feed configuration validation
- 🎨 **Consistent Formatting**: Standardized message formatting across all feeds
- 🧪 **Comprehensive Testing**: Full unit and integration test coverage

## Quick Start

### 1. Fork this repository

Click the "Fork" button to create your own copy of this repository.

### 2. Configure RSS Feeds

Edit `data/feeds.json` to customize which threat intelligence sources you want to monitor. The new format supports enhanced metadata and optional custom parsers:

```json
[
  {
    "name": "NSM-NCSC",
    "url": "https://nsm.no/fagomrader/digital-sikkerhet/nasjonalt-cybersikkerhetssenter/varsler-fra-ncsc/rss/",
    "category": "national",
    "region": "norway", 
    "priority": "high",
    "enabled": true,
    "description": "Norwegian National Security Authority cybersecurity alerts",
    "parser": "defaultParser"
  },
  {
    "name": "CISA-Alerts",
    "url": "https://www.cisa.gov/news.xml",
    "category": "government",
    "region": "usa",
    "priority": "high", 
    "enabled": true,
    "description": "US Cybersecurity and Infrastructure Security Agency alerts"
  }
]
```

**Configuration Fields:**
- `name` (required): Unique identifier for the feed
- `url` (required): RSS feed URL
- `enabled` (required): Boolean to enable/disable the feed
- `category` (optional): Feed category (national, vendor, government, commercial, community)
- `region` (optional): Geographic region (norway, usa, global, etc.)
- `priority` (optional): Processing priority (high, medium, low) - affects posting delays
- `description` (optional): Human-readable description of the feed
- `parser` (optional): Custom parser name (defaults to defaultParser)

### 3. Set up Microsoft Teams Webhook

1. In Microsoft Teams, go to the channel where you want to receive alerts
2. Click the three dots (⋯) next to the channel name
3. Select "Connectors" → "Incoming Webhook"
4. Configure the webhook and copy the URL

### 4. Configure GitHub Secrets

In your GitHub repository, go to Settings → Secrets and variables → Actions, then add:

- **TEAMS_WEBHOOK_URL**: Your Microsoft Teams webhook URL

### 5. Enable GitHub Actions

There are three workflows:

- CI (`.github/workflows/ci.yml`): runs tests on PRs and non-main pushes.
- Staging (`.github/workflows/staging.yml`): manual/scheduled runs using staging secrets.
- Production (`.github/workflows/production.yml`): scheduled every 5 minutes, cancel-in-progress enabled.

All share `.github/workflows/run-feed-reusable.yml` for consistency.

## Output Channels

The Threat Feed Bot supports multiple output channels for maximum flexibility:

### Microsoft Teams Integration

Posts real-time threat intelligence alerts to Microsoft Teams channels with rich adaptive cards featuring:
- Color-coded severity levels (Critical, High, Medium, Info)
- Threat type classification with emoji indicators
- Source feed metadata and regional context
- Direct links to original advisories
- Priority-based action indicators

### GitHub Pages Static Feed

Generate a beautiful, static HTML threat intelligence dashboard hosted on GitHub Pages.

**Setup:**
1. Enable GitHub Pages in your repository settings (Settings → Pages → Source: GitHub Actions)
2. Set the `ENABLE_GITHUB_PAGES` environment variable to `true` in your GitHub Actions workflow
3. The HTML feed will be automatically generated at `docs/index.html` and deployed to GitHub Pages

**Features:**
- 📊 **Interactive Dashboard**: Modern, responsive design with statistics overview
- 🎨 **Color-Coded Alerts**: Visual severity indicators with hover effects
- 🔍 **Rich Metadata**: Complete threat details including feed source, region, and category
- 📱 **Mobile Responsive**: Optimized for all devices and screen sizes
- ⚡ **Fast Loading**: Lightweight static HTML with modern CSS
- 🔗 **Direct Links**: Quick access to original threat advisories

**Example Output:**
- Statistics cards showing threat counts by severity
- Interactive threat cards with full descriptions
- Action buttons for immediate access to advisories
- Professional styling with gradients and modern typography

**Environment Configuration:**
```bash
# Enable GitHub Pages output
ENABLE_GITHUB_PAGES=true

# Test locally with HTML generation
npm run dry-run:html

# Generate HTML output in production
npm run generate-html
```

The GitHub Pages feed automatically updates with each run and provides a permanent, shareable URL for your threat intelligence dashboard.

## Quick Start (Continued)

### 6. Optional: Configure Additional Output Channels

## Project Structure

```
threat-feed-bot/
├── fetch-and-post.js           # Main orchestration logic
├── post-to-teams.js            # Teams webhook integration
├── data/                       # Configuration and state files
│   ├── feeds.json             # RSS feed configurations
│   └── state.json             # Tracks last processed items (auto-updated)
├── parsers/                    # Modular feed parsers
│   └── defaultParser.js       # Standard RSS/Atom parser
├── utils/                      # Utility modules
│   ├── validateFeeds.js       # Feed configuration validation
│   └── formatter.js           # Message formatting and classification
├── tests/                      # Comprehensive test suite
│   ├── parsers.test.js        # Parser functionality tests
│   ├── validator.test.js      # Validation logic tests
│   ├── formatter.test.js      # Formatting and classification tests
│   ├── fetch-and-post.test.js # Integration tests
│   ├── post-to-teams.test.js  # Teams integration tests
│   ├── test-utils.js          # Shared testing utilities
│   ├── index.js               # Test runner
│   └── package.json           # Jest configuration
├── .github/workflows/
│   └── rss-to-teams.yml       # GitHub Actions workflow
├── package.json                # Node.js dependencies and scripts
├── INSTRUCTIONS.txt            # Operational guide
└── README.md                   # This file
```

## Configuration Files

### data/feeds.json
Enhanced feed configuration with metadata and validation:
```json
[
  {
    "name": "Microsoft-MSRC",
    "url": "https://api.msrc.microsoft.com/update-guide/rss",
    "category": "vendor",
    "region": "global",
    "priority": "high",
    "enabled": true,
    "description": "Microsoft Security Response Center vulnerability updates",
    "parser": "defaultParser"
  }
]
```

### data/state.json (auto-managed)
```json
{
  "NSM-NCSC": "https://nsm.no/aktuelt/2024/01/15/critical-vulnerability-alert",
  "Microsoft-MSRC": "https://msrc.microsoft.com/update-guide/2024-01-15"
}
```

## Intelligence Classification

The bot automatically classifies threats into categories and severity levels:

### Threat Types
- 🦠 **Malware**: Ransomware, trojans, backdoors, viruses
- 🔓 **Vulnerability**: CVEs, security updates, patches
- 🎣 **Phishing**: Social engineering, scams, fraudulent campaigns
- 🎯 **APT**: Advanced persistent threats, nation-state activities
- 💾 **Data Breach**: Data leaks, exposed databases, credential theft
- 📄 **General**: Other security-related information

### Severity Levels
- 🚨 **CRITICAL (P1)**: Zero-day exploits, active threats requiring immediate action
- ⚠️ **HIGH (P2)**: Vulnerabilities, security updates, confirmed threats
- 📋 **MEDIUM (P3)**: Advisories, recommendations, moderate priority
- ℹ️ **INFO (P4)**: General security information, low priority

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

### Dry-Run Mode

The bot includes a comprehensive dry-run mode for testing and previewing without making any changes:

```bash
# Preview mode - shows what would be posted without actually posting
node fetch-and-post.js --dry-run

# Use custom configuration file
node fetch-and-post.js --dry-run --config path/to/feeds.json

# Save preview output to logs/dry-run-<timestamp>.json
LOG_TO_FILE=true node fetch-and-post.js --dry-run

# Convenient npm scripts
npm run dry-run           # Quick preview
npm run dry-run:save      # Preview with file output
npm run dry-run:html      # Preview with GitHub Pages HTML generation
npm run generate-html     # Generate GitHub Pages HTML output
```

**Dry-run Features:**
- ✅ Processes all feeds with full validation
- ✅ Generates formatted Teams message previews  
- ✅ Shows threat classification and severity detection
- ✅ Tests custom configuration files
- ❌ Skips actual Teams posting
- ❌ Skips state file updates
- 📁 Optionally saves output to `logs/` directory

**GitHub Actions Dry-Run:**
You can trigger a dry-run preview directly from GitHub Actions:
1. Go to your repository → Actions tab
2. Select "Threat Feed Bot" workflow
3. Click "Run workflow"
4. Check "Run in dry-run mode" 
5. Optionally check "Save dry-run output to file"
6. Click "Run workflow"

The dry-run artifacts will be available for download from the workflow run.

### Testing
```bash
# Run integration tests
npm test

# Run Jest unit tests  
npm run test:jest

# Run specific test suites
npm run test:parsers     # Test parser functionality
npm run test:validator   # Test feed validation
npm run test:formatter   # Test message formatting
npm run test:integration # Test end-to-end integration
npm run test:outputs     # Test GitHub Pages and output manager

# Run with coverage
npm run test:coverage

# Test with live Teams posting (requires TEAMS_WEBHOOK_URL)
npm run test:live

# Validate system configuration
npm run validate

# Dry-run preview mode (no Teams posting, no state updates)
npm run dry-run

# Dry-run with output saved to logs/dry-run-<timestamp>.json
npm run dry-run:save

# Dry-run with GitHub Pages HTML generation
npm run dry-run:html

# Generate GitHub Pages HTML output for production
npm run generate-html
```

## How It Works

### Processing Pipeline
1. **Configuration Validation**: Validates `data/feeds.json` structure and content
2. **Parser Loading**: Dynamically loads appropriate parser for each feed (default parser plus future per-source adapters)
3. **RSS Parsing**: Fetches and normalizes RSS feed content (with `FETCH_TIMEOUT_MS`)
4. **Content Filtering**: Relevance-first filtering: requires at least one relevant keyword; items are not dropped solely for blocked keywords if relevant
5. **Threat Classification**: Automatically detects severity and threat type
6. **State Comparison**: Compares against `data/state.json` to identify new items
7. **Message Formatting**: Creates standardized Teams adaptive cards
8. **Teams Posting**: Sends formatted alerts to Teams via webhook with exponential backoff, Retry-After support, and `POST_TIMEOUT_MS`
9. **State Updates**: Updates state file with latest processed items

### Intelligence Processing
- **Relevance Filtering**: Excludes webinars, marketing, and non-security content
- **Severity Detection**: Analyzes content for critical keywords and threat indicators
- **Type Classification**: Categorizes threats based on content analysis
- **Priority Processing**: High-priority feeds processed with shorter delays
- **Graceful Degradation**: Individual feed failures don't stop other feeds

### Modular Architecture
- **Parser System**: Pluggable parsers for different feed formats
- **Validation Engine**: Comprehensive input validation and error reporting
- **Formatter Module**: Centralized message formatting with consistent styling
- **Test Framework**: Complete unit and integration test coverage

## Customization

### Adding New Feeds
Add entries to `data/feeds.json` with full validation:
```json
{
  "name": "Your Custom Feed",
  "url": "https://example.com/feed.xml",
  "category": "vendor",
  "region": "global", 
  "priority": "medium",
  "enabled": true,
  "description": "Description of your feed"
}
```

### Creating Custom Parsers
Create a new parser in `parsers/` directory:
```javascript
// parsers/customParser.js
export class CustomParser {
  constructor() {
    this.name = 'customParser';
  }

  async parseURL(url) {
    // Custom parsing logic
    return {
      title: 'Feed Title',
      items: [/* normalized items */]
    };
  }

  normalizeItems(items) {
    // Return items with consistent fields
    return items.map(item => ({
      title: item.title,
      link: item.link,
      description: item.description,
      publishedDate: item.publishedDate
    }));
  }

  canHandle(feed) {
    // Return true if this parser can handle the feed
    return feed.url.includes('example.com');
  }
}
```

### Modifying Classification Rules
Edit `utils/formatter.js` to customize threat detection:
```javascript
// Add custom severity keywords
const criticalKeywords = ['your-critical-terms'];

// Add custom threat types
const threatTypes = {
  yourType: {
    keywords: ['your-keywords'],
    emoji: '🔥',
    category: 'Your Category'
  }
};
```

### Customizing Teams Messages
The formatter provides standardized messaging, but you can customize the format in `utils/formatter.js`:
```javascript
// Modify the formatMessage function
export function formatMessage(options) {
  // Your custom formatting logic
}
```

## Troubleshooting

### Common Issues

**Feed validation errors:**
- Check `data/feeds.json` syntax and required fields
- Verify URLs are accessible and use HTTPS
- Ensure feed names are unique
- Run `npm run validate` to check configuration

**Parser loading failures:**
- Verify custom parser files exist in `parsers/` directory
- Check parser class exports and method implementations
- Review console logs for specific parser errors
- System falls back to default parser automatically

**GitHub Actions not running:**
- Check that you've enabled GitHub Actions in repository settings
- Verify the TEAMS_WEBHOOK_URL secret is set correctly
- Ensure `data/state.json` is tracked by git

**No messages appearing in Teams:**
- Verify your webhook URL is correct and active
- Check the GitHub Actions logs for error messages
- Test the webhook manually using curl or Postman
- Verify feed URLs are accessible and contain recent content

**Message formatting issues:**
- Check threat classification keywords in `utils/formatter.js`
- Verify Teams adaptive card format compatibility
- Review formatter test cases for expected behavior

**Duplicate or missing messages:**
- Check if `data/state.json` is being updated correctly. The enhanced state uses a `seen` map; the system migrates from legacy last-URL map automatically.
- Verify state file is committed to repository
- Review feed item URL uniqueness and consistency

### Debugging Steps

1. **Local Testing**: Run `npm start` locally with webhook URL
2. **Validation**: Use `npm run validate` to check configuration
3. **Unit Tests**: Run `npm run test:jest` to verify component functionality
4. **Integration Tests**: Use `npm test` for end-to-end validation
5. **Live Testing**: Use `npm run test:live` to test Teams integration

### Logs and Monitoring
- Check GitHub Actions logs under the "Actions" tab
- Review local console output for detailed processing information
- Monitor Teams channel for message delivery
- Check `data/state.json` updates for processing progress

### Environment Variables

- Local development uses `.env` (see `.env.example` for keys). Do NOT commit real secrets.
- Production/staging use GitHub Actions secrets. The webhook URL is redacted in logs.

Key envs:
- `TEAMS_WEBHOOK_URL` (secret in Actions)
- `FETCH_TIMEOUT_MS`, `POST_TIMEOUT_MS`
- `PER_RUN_POST_CAP`, `POST_DELAY_MS`, `TEAMS_MAX_RETRIES`

## Security Considerations

- **Webhook Security**: Teams webhook URLs stored as GitHub Secrets
- **HTTPS Enforcement**: RSS feeds accessed over HTTPS when possible  
- **Input Validation**: Comprehensive validation of all configuration inputs
- **No Sensitive Data**: Only public RSS URLs and metadata stored in repository
- **State File Safety**: State file contains only public RSS item URLs
- **Error Handling**: Secure error reporting without exposing sensitive information
- **Parser Security**: Custom parsers run in controlled environment
- **Access Control**: Repository access controls who can modify configurations

## Contributing

We welcome contributions to improve the Threat Feed Bot!

### Development Setup
1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Set up your Teams webhook URL for testing
5. Run tests: `npm test` and `npm run test:jest`

### Contribution Areas
- **Custom Parsers**: Add support for new RSS feed formats
- **Classification Rules**: Improve threat detection and categorization
- **Message Formatting**: Enhance Teams message presentation
- **Testing**: Add test coverage for edge cases
- **Documentation**: Improve setup guides and troubleshooting
- **Performance**: Optimize processing speed and memory usage

### Submission Process
1. Create a feature branch from main
2. Make your changes with appropriate tests
3. Run the full test suite: `npm run validate`
4. Update documentation if needed
5. Submit a pull request with detailed description

### Code Standards
- Follow existing code style and patterns
- Add unit tests for new functionality
- Update integration tests for API changes
- Document new configuration options
- Maintain backward compatibility when possible

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

### Documentation
1. Review this comprehensive README
2. Check `INSTRUCTIONS.txt` for operational details
3. Examine test files for usage examples
4. Review code comments for implementation details

### Troubleshooting
1. Run `npm run validate` to check configuration
2. Check GitHub Actions logs for execution details
3. Test locally with `npm start` for debugging
4. Review unit tests for expected behavior patterns

### Getting Help
1. Search existing GitHub issues for similar problems
2. Check the troubleshooting section above
3. Open a detailed issue with:
   - Error messages and logs
   - Configuration details (anonymized)
   - Steps to reproduce
   - Expected vs actual behavior

### Resources
- **GitHub Actions Logs**: Detailed execution information
- **Test Suite**: Run `npm test` for system validation
- **Configuration Validation**: Use `npm run validate`
- **Live Testing**: Use `npm run test:live` for Teams integration testing
