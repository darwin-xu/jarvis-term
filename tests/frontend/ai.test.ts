import { MockAIService } from '../mocks';

// Mock fetch globally
global.fetch = jest.fn();

describe('AI Integration', () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
        MockAIService.clearMockResponses();
        mockFetch.mockClear();
    });

    describe('Plan Generation', () => {
        it('should generate valid plan for simple goal', async () => {
            const mockResponse = {
                output: [
                    {
                        content: [
                            {
                                text: JSON.stringify({
                                    explanation:
                                        'List files in current directory',
                                    steps: [
                                        {
                                            cmd: 'ls -la',
                                            output: '',
                                            exit: 0,
                                            executed: false,
                                            expectedDuration: 1000,
                                            dependsOnPreviousOutput: false,
                                        },
                                    ],
                                }),
                            },
                        ],
                    },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            // Import the function after mocking
            const { getPlan } = require('../../src/frontend/client');

            const result = await getPlan('list files');
            const plan = JSON.parse(result);

            expect(plan.explanation).toBe('List files in current directory');
            expect(plan.steps).toHaveLength(1);
            expect(plan.steps[0].cmd).toBe('ls -la');
        });

        it('should handle complex multi-step goals', async () => {
            const mockResponse = {
                output: [
                    {
                        content: [
                            {
                                text: JSON.stringify({
                                    explanation: 'Find and count Python files',
                                    steps: [
                                        {
                                            cmd: "find . -name '*.py'",
                                            output: '',
                                            exit: 0,
                                            executed: false,
                                            expectedDuration: 2000,
                                            dependsOnPreviousOutput: false,
                                        },
                                        {
                                            cmd: "find . -name '*.py' | wc -l",
                                            output: '',
                                            exit: 0,
                                            executed: false,
                                            expectedDuration: 1000,
                                            dependsOnPreviousOutput: true,
                                        },
                                    ],
                                }),
                            },
                        ],
                    },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const { getPlan } = require('../../src/frontend/client');

            const result = await getPlan('find and count python files');
            const plan = JSON.parse(result);

            expect(plan.steps).toHaveLength(2);
            expect(plan.steps[1].dependsOnPreviousOutput).toBe(true);
        });

        it('should handle API errors gracefully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
            } as Response);

            const { getPlan } = require('../../src/frontend/client');

            const result = await getPlan('test goal');

            expect(result).toContain(
                'Error: Failed to get response from OpenAI (401)'
            );
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const { getPlan } = require('../../src/frontend/client');

            const result = await getPlan('test goal');

            expect(result).toContain('Error: Network error');
        });
    });

    describe('Summary Generation', () => {
        it('should generate summary for successful execution', async () => {
            const mockResponse = {
                output: [
                    {
                        content: [
                            {
                                text: JSON.stringify({
                                    achieve: true,
                                    summary:
                                        'Successfully listed all files in the directory',
                                }),
                            },
                        ],
                    },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const { getSummary } = require('../../src/frontend/client');

            const result = await getSummary('Files listed successfully');
            const summary = JSON.parse(result);

            expect(summary.achieve).toBe(true);
            expect(summary.summary).toContain('Successfully listed');
        });

        it('should generate summary for failed execution', async () => {
            const mockResponse = {
                output: [
                    {
                        content: [
                            {
                                text: JSON.stringify({
                                    achieve: false,
                                    summary:
                                        'Command failed due to permission error',
                                }),
                            },
                        ],
                    },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const { getSummary } = require('../../src/frontend/client');

            const result = await getSummary('Permission denied error');
            const summary = JSON.parse(result);

            expect(summary.achieve).toBe(false);
            expect(summary.summary).toContain('permission error');
        });
    });

    describe('Plan Schema Validation', () => {
        it('should validate plan schema structure', () => {
            const { planSchema } = require('../../src/frontend/client');

            expect(planSchema.schema.properties.explanation).toBeDefined();
            expect(planSchema.schema.properties.steps).toBeDefined();
            expect(planSchema.schema.required).toContain('explanation');
            expect(planSchema.schema.required).toContain('steps');
        });

        it('should validate step schema structure', () => {
            const { planSchema } = require('../../src/frontend/client');

            const stepSchema =
                planSchema.schema.properties.steps.items.properties;

            expect(stepSchema.cmd).toBeDefined();
            expect(stepSchema.output).toBeDefined();
            expect(stepSchema.exit).toBeDefined();
            expect(stepSchema.executed).toBeDefined();
            expect(stepSchema.expectedDuration).toBeDefined();
            expect(stepSchema.dependsOnPreviousOutput).toBeDefined();
        });
    });
});
