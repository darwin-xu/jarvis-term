// AI service functions extracted for testing
interface AppConfig {
    OPENAI_API_KEY: string;
}

declare const window: {
    APP_CONFIG: AppConfig;
} & typeof globalThis;

async function getPlan(goal: string, plan: any = null): Promise<string> {
    const { OPENAI_API_KEY } = window.APP_CONFIG || {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    };

    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    const requestBody = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.7,
        system: plan
            ? `You're a Jarvis that help Linux users achieve their goals by analyzing the failure of the previous plan and creating a revised plan with maximum 5 commands step by step. Provide the result as a valid JSON object with this structure:
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
        }`
            : `You're a Jarvis that help Linux users achieve their goals step by step. Maximum 5 commands. Provide the result as a valid JSON object with this structure:
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
        }`,
        messages: [
            {
                role: 'user',
                content: plan
                    ? `Previous plan failed: ${plan}. The goal is: ${goal}. Please create a revised plan.`
                    : `Goal: ${goal}`,
            },
        ],
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': OPENAI_API_KEY,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    return data.content[0].text;
}

async function getSummary(result: string): Promise<string> {
    const { OPENAI_API_KEY } = window.APP_CONFIG || {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    };

    if (!OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }

    const requestBody = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.7,
        system: `You're a Jarvis that analyzes command execution results and provides summaries. Provide the result as a valid JSON object with this structure:
        {
            "achieve": true/false,
            "summary": "Brief summary of what was accomplished or what went wrong"
        }`,
        messages: [
            {
                role: 'user',
                content: `Analyze this execution result: ${result}`,
            },
        ],
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': OPENAI_API_KEY,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
    }

    const data = (await response.json()) as any;
    return data.content[0].text;
}

export { getPlan, getSummary };
