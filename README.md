# 🍎 PomoBlock (v1.1) 🛡️

> **"Master Your Focus with Smart Site Blocking."**
> A Chrome Extension that combines a Pomodoro timer with a site blocker to help you stay productive.

---

## 🚀 Overview
**PomoBlock** is a productivity tool built on the Chrome Extension Manifest V3. It allows users to set customized focus and rest intervals while automatically restricting access to distracting websites during focus sessions.

## 🛠️ Tech Stack
* **Architecture**: Chrome Extension Manifest V3
* **Logic**: JavaScript (ES6+)
* **APIs Used**: 
    * `declarativeNetRequest` (Network filtering)
    * `chrome.alarms` (Background scheduling)
    * `chrome.storage.sync` (Data persistence)
    * `chrome.notifications` (User alerts)

## ✨ Key Features
* **Site Blocking**: Blocks user-defined websites during focus sessions using declarative rules.
* **Custom Timer**: Allows users to set specific durations for focus, rest, and total sets.
* **Badge Display**: Shows the remaining time directly on the browser toolbar icon.
* **Set Tracking**: Provides a visual progress indicator for completed sessions.
* **Persistence**: Saves the blacklist and timer settings across browser restarts.

---

## 📦 Installation
1.  Clone or download this repository.
2.  Go to `chrome://extensions/` in Chrome.
3.  Enable **"Developer mode"**.
4.  Click **"Load unpacked"** and select the project folder.

## 📄 License
Licensed under the [MIT License](LICENSE).
