[![Build Status](https://travis-ci.com/switcherapi/switcher-load-balance.svg?branch=master)](https://travis-ci.com/github/switcherapi/switcher-load-balance)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=switcherapi_switcher-load-balance&metric=alert_status)](https://sonarcloud.io/dashboard?id=switcherapi_switcher-load-balance)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Slack: Switcher-HQ](https://img.shields.io/badge/slack-@switcher/hq-blue.svg?logo=slack)](https://switcher-hq.slack.com/)

![Switcher Load Balance: Load Balancing API](https://github.com/petruki/switcherapi-assets/blob/master/logo/switcherapi_loadbalance.png)

# Requirements  
- NodeJS
- Postman (optional for request examples)
- Coffee =D

# About  
**Switcher Load Balance** is a simple load balance developed especially for supporting CI environments.

Main features:
- Auto switch off when a node is offline.
- Auto recover, forced or scheduled.
- Stateful configuration, no DB in between, the only latency is the network.
- Check node health via REST requests.
- API Key generated automatically after deployment.

# Configuration
1) npm install
2) Add .env-cmdrc file into the project directory.

Example:
```
{
  "dev": {
    "PORT": "3002",
    "SNODE1": "http://localhost:3000",
    "SNODE2": "https://switcher-api.herokuapp.com",
    "CHECK_ENDPOINT": "/check",
    "LOGGER": "true",
    "RECOVER_ATTEMPT_DURATION": "60",
    "RECOVER_INTERVAL": "10"
  },
  "prod": {
    "PORT": "3002",
    "SNODE1": "http://localhost:3000",
    "SNODE2": "https://switcher-api.herokuapp.com",
    "CHECK_ENDPOINT": "/check",
    "LOGGER": "true",
    "RECOVER_ATTEMPT_DURATION": "60",
    "RECOVER_INTERVAL": "10"
  },
  "test": {
    "PORT": "3002"
  }
}
```

## Donation
Donations for cookies and pizza are extremely welcomed.

[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=9FKW64V67RKXW&source=url)