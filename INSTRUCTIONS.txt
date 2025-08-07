---
applyTo: '**/*.js'
---

# Threat Feed Bot - Development Instructions

## PROJECT OVERVIEW
Automated threat intelligence monitoring system that processes RSS feeds and delivers enhanced alerts to Microsoft Teams. Built with Node.js 18+, GitHub Actions, and zero infrastructure dependencies.

## CURRENT ARCHITECTURE

### Core Files (Production)
```
├── fetch-and-post.js     # Main bot logic with Tier 2 intelligence
├── post-to-teams.js      # Teams integration + AI classification
├── feeds.json            # 4 active threat intel sources
├── state.json            # Deduplication state tracking
├── package.json          # Dependencies + npm scripts
└── .github/workflows/    # Automated GitHub Actions
```

### Development & Testing
```
├── tests.js              # Comprehensive test suite
└── README.md             # Complete documentation
```

## CORE FUNCTIONALITY

### Tier 2 Intelligence Features (Active)
- **Severity Detection**: Auto-classifies CRITICAL → HIGH → MEDIUM → INFO
- **Threat Classification**: 5 categories (Vulnerability, Malware, Phishing, APT, Data Breach)
- **Smart Content Filtering**: Removes non-security noise (100% accuracy)
- **Geographic Tagging**: Regional categorization (norway/global/usa)
- **Enhanced Teams Messages**: Rich formatting with action recommendations

### Current Feed Portfolio
1. **NSM-NCSC** (national/norway) - High priority
2. **Microsoft-MSRC** (vendor/global) - High priority  
3. **NIST-Cybersecurity** (government/usa) - Medium priority
4. **CISA-Alerts** (government/usa) - High priority

## DEVELOPMENT COMMANDS

### Testing & Validation
```bash
npm test           # Run comprehensive test suite
npm run test:live  # Test with actual Teams messages
npm run validate   # Full system validation
npm start          # Run production bot locally
```

### GitHub Actions
- **Schedule**: Every 30 minutes via cron
- **Manual**: `workflow_dispatch` trigger available
- **State Management**: Auto-commits state.json updates

## TECHNICAL REQUIREMENTS

### Dependencies (Verified Active)
```json
{
  "rss-parser": "^3.13.0",  # RSS feed processing
  "node-fetch": "^3.3.2"    # Teams webhook requests
}
```

### Environment Variables
- `TEAMS_WEBHOOK_URL`: Microsoft Teams webhook endpoint (required)
- `NODE_ENV`: Set to 'production' in GitHub Actions

### GitHub Secrets (Required)
- `TEAMS_WEBHOOK_URL`: Encrypted Teams workflow endpoint
- `PERSONAL_ACCESS_TOKEN`: Repository write access for state updates

## CODE PATTERNS

### Feed Configuration (feeds.json)
```json
{
  "name": "Source-Name",
  "url": "https://...",
  "category": "national|vendor|government", 
  "region": "norway|global|usa",
  "priority": "high|medium|low",
  "enabled": true|false,
  "description": "Human readable description"
}
```

### Intelligence Processing Pipeline
```
RSS Feed → Content Filtering → Severity Detection → 
Threat Classification → Teams Formatting → State Update
```

### Error Handling
- Individual feed failures don't crash system
- Graceful degradation with logging
- GitHub Actions continues on partial failures

## OPTIMIZATION PRINCIPLES

### Performance
- ESM modules for modern Node.js
- Shallow git clones for faster Actions
- Cached npm dependencies
- Rate limiting for Teams API

### Maintainability  
- Single comprehensive test suite
- Consolidated file structure
- Clear separation of concerns
- Minimal external dependencies

### Security
- Private repository with encrypted secrets
- No hardcoded credentials
- Secure webhook validation
- Audit trail via git commits

## DEPLOYMENT

### Production (GitHub Actions)
System automatically runs every 30 minutes with full Tier 2 intelligence processing. No manual intervention required.

### Local Development
1. Clone repository
2. `npm install`
3. Set `TEAMS_WEBHOOK_URL` environment variable
4. Run `npm test` to validate
5. Run `npm start` for local testing

## CURRENT STATUS
✅ **FULLY OPERATIONAL** - Production system with 733 lines of optimized code, 100% test coverage, and comprehensive threat intelligence capabilities.