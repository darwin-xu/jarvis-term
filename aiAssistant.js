const { exec } = require('child_process');

function log(...args) {
    console.log(new Date().toISOString(), '[AI]', ...args);
}

class LLMAdapter {
    /**
     * Generate a response from the language model.
     * @param {Array<{role: string, content: string}>} context Conversation history following the Model Context Protocol.
     * @returns {Promise<string>} Model reply containing a shell command to execute.
     */
    async complete(context) {
        throw new Error('complete() must be implemented by subclass');
    }
}

/**
 * Example placeholder implementation that simply echoes the prompt.
 * Replace with integration to your preferred LLM provider.
 */
class EchoLLM extends LLMAdapter {
    async complete(context) {
        const last = context[context.length - 1];
        return `echo ${JSON.stringify(last.content)}`;
    }
}

function runCommand(cmd) {
    return new Promise(resolve => {
        exec(cmd, { shell: '/bin/bash' }, (error, stdout, stderr) => {
            resolve({
                code: error ? error.code || 1 : 0,
                stdout,
                stderr,
            });
        });
    });
}

class AIAssistant {
    /**
     * @param {LLMAdapter} llm Language model client implementing complete()
     */
    constructor(llm) {
        this.llm = llm;
    }

    /**
     * Execute a user prompt by generating commands with the LLM until success.
     * @param {string} prompt Natural language instruction from the user.
     * @param {number} [maxAttempts=5] Maximum number of attempts.
     */
    async executePrompt(prompt, maxAttempts = 5) {
        const history = [
            {
                role: 'system',
                content: 'Translate user requests into shell commands.',
            },
            { role: 'user', content: prompt },
        ];
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            log(`Attempt ${attempt}: requesting command from LLM`);
            const command = await this.llm.complete(history);
            history.push({ role: 'assistant', content: command });
            log(`Executing: ${command}`);
            const result = await runCommand(command);
            if (result.code === 0) {
                log('Command succeeded');
                return result.stdout;
            }
            log(`Command failed with code ${result.code}`);
            const errorMessage = `Command failed with code ${result.code}. Output:\n${result.stderr}`;
            history.push({ role: 'system', content: errorMessage });
        }
        throw new Error('Maximum attempts exceeded');
    }
}

module.exports = { AIAssistant, LLMAdapter, EchoLLM };
