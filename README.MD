# AI-Enhanced Developer Assistant

This project aims to build a Node.js-based application that leverages AI to observe, enhance, and intelligently assist with a wide range of developer workflows, starting with terminal sessions and expanding to other tools and environments.

## ✨ Features

- 🔍 **Context Awareness**: Observe terminal sessions, code editors, and command outputs.
- 🤖 **AI Assistance**:

    - Natural language → shell command or code snippet translation.
    - Smart command/code suggestions and completions.
    - Session or activity summarization with optional script generation.

- 🧠 **Workflow Automation**: Detect patterns in development activities and suggest reusable automations.
- 📜 **Summarization & Logging**: Generate readable summaries, changelogs, or documentation from developer activity.

## 🛠 Stack Overview

### Programming Language

- **Node.js**

### Core Interaction Targets

- **Terminal**: via [`node-pty`](https://github.com/microsoft/node-pty)
- **Code Editor**: future integration with VS Code API or LSPs
- **Shell Multiplexers**: optional integration with [`tmux`](https://github.com/tmux/tmux/wiki)

### AI Backend

- **Flexible model backend**: supports OpenAI GPT, local models (LLaMA, Mistral, etc.), or any pluggable LLM-compatible interface
- AI used for:

    - Interpreting natural language
    - Generating shell commands or code
    - Summarizing or translating developer activity

## 🚀 Getting Started

To begin development:

```bash
git clone https://github.com/your-org/ai-dev-assistant.git
cd ai-dev-assistant
```

### Web-Based Terminal Tool

Install dependencies and start the web server:

```bash
npm install
npm start
```

Open `http://localhost:3000` in your browser and connect to a remote host using the provided form. Credentials can also be supplied via `SSH_HOST`, `SSH_USER` and `SSH_PASS` environment variables.

## 🧩 Future Ideas

- VS Code plugin version
- GUI-based shell/IDE assistant (Electron + xterm.js + Monaco)
- Voice-controlled assistant
- Auto-save, annotate & replay sessions
- Contextual understanding of file trees or project structure
- Offline LLM integration

## 🤖 AI Command Runner

`aiAssistant.js` provides a minimal framework for turning natural language
prompts into shell commands. It uses a pluggable language model adapter so you
can integrate OpenAI, Grok, Claude, Gemini, LLaMA or any local model.

Run the helper script:

```bash
node runWithAI.js
```

This will ask for a goal, generate a command, execute it and keep iterating until
the command succeeds or the attempts are exhausted. `EchoLLM` is included as a
placeholder that simply echoes your input. Replace it with your own adapter that
implements the `LLMAdapter.complete()` method.

### Using in the Web Terminal

When connected via the browser, an **AI Prompt** field appears below the
terminal. Enter a natural language request and the server will generate and
execute a shell command on the active SSH session. The output is shown in the
terminal with a green prefix when successful or red if an error occurs.

Built with ♥ for developers who want smarter tools.
