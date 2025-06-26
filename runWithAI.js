const readline = require('readline');
const { AIAssistant, EchoLLM } = require('./aiAssistant');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

async function main() {
    rl.question('Describe your goal: ', async prompt => {
        const assistant = new AIAssistant(new EchoLLM());
        try {
            const output = await assistant.executePrompt(prompt);
            console.log('Result:\n' + output);
        } catch (err) {
            console.error('Failed:', err.message);
        } finally {
            rl.close();
        }
    });
}

main();
