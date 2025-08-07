// Shared AI utility functions for both client and tests
interface AIConfig {
    OPENAI_API_KEY: string;
}

// Get configuration from window in browser or environment variables in Node.js
function getConfig(): AIConfig {
    if (
        typeof globalThis !== 'undefined' &&
        (globalThis as any).window?.APP_CONFIG
    ) {
        return (globalThis as any).window.APP_CONFIG;
    }
    return {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    };
}

const planInstruction = `You're a Jarvis that help Linux users achieve their goals step by step. Maximum 5 commands. Provide the result as a valid JSON object with this structure:
{
    "explanation": "Human readable description of what to achieve",
    "steps": [
        {
            "cmd": "shell command to execute",
            "output": "",
            "exit": 0,
            "executed": false,
            "expectedDuration": "duration in milliseconds",
            "dependsOnPreviousOutput": true/false
        }
    ]
}`;

const summaryInstruction = `You're a Jarvis that analyzes command execution results and provides summaries. Provide the result as a valid JSON object with this structure:
{
    "achieve": true/false,
    "summary": "Brief summary of what was accomplished or what went wrong"
}`;

const planSchema = `{"explanation": "Human readable description of what to achieve", "steps": [{"cmd": "shell command to execute", "output": "", "exit": 0, "executed": false, "expectedDuration": "duration in milliseconds", "dependsOnPreviousOutput": true/false}]}`;
const summarySchema = `{"achieve": true/false, "summary": "Brief summary of what was accomplished or what went wrong"}`;

async function getPlan(goal: string, plan: any = null): Promise<string> {
    const config = getConfig();

    if (!config.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    let prompt = [
        { role: 'system', content: planInstruction },
        {
            role: 'user',
            content: plan
                ? `The goal is: ${goal}. The result of the executed plan is: ${JSON.stringify(plan)}. ` +
                  `If the goal is not achieved, please provide a new plan to achieve this goal.`
                : `The goal is: ${goal}. Please provide a plan to achieve this goal.`,
        },
    ];

    try {
        const response = await fetch(`http://35.234.22.51:8080/v1/responses`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                model: 'gpt-4.1-nano',
                input: prompt,
                text: {
                    format: planSchema,
                },
            }),
        });

        if (!response.ok) {
            return `Error: Failed to get response from OpenAI (${response.status})`;
        }

        const data = (await response.json()) as any;
        return data.output?.[0].content?.[0]?.text;
    } catch (error) {
        console.error('Error calling AI API:', error);
        throw error;
    }
}

async function getSummary(result: string): Promise<string> {
    const config = getConfig();

    if (!config.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    let prompt = [
        { role: 'system', content: summaryInstruction },
        { role: 'user', content: `The execution result is: ${result}` },
    ];

    const response = await fetch(`http://35.234.22.51:8080/v1/responses`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            model: 'gpt-4.1-nano',
            input: prompt,
            text: {
                format: summarySchema,
            },
        }),
    });

    if (!response.ok) {
        throw new Error(
            `Failed to get response from OpenAI (${response.status})`
        );
    }

    const data = (await response.json()) as any;
    return data.output?.[0].content?.[0]?.text;
}

export { getPlan, getSummary };
