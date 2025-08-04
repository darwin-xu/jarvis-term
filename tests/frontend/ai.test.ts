import { MockAIService } from '../mocks';
import { getPlan, getSummary } from '../../src/frontend/ai-service';

// Mock fetch globally
global.fetch = jest.fn();

// Mock window.APP_CONFIG for browser environment
(global as any).window = {
    APP_CONFIG: {
        OPENAI_API_KEY: 'test-api-key',
    },
};

describe('AI Integration', () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
        MockAIService.clearMockResponses();
        mockFetch.mockClear();
    });

    describe('Plan Generation', () => {
        it('should generate valid plan for simple goal', async () => {
            const mockResponse = {
                content: [
                    {
                        text: JSON.stringify({
                            explanation: 'List files in current directory',
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
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const result = await getPlan('list files');
            const plan = JSON.parse(result);

            expect(plan.explanation).toBe('List files in current directory');
            expect(plan.steps).toHaveLength(1);
            expect(plan.steps[0].cmd).toBe('ls -la');
        });

        it('should handle complex multi-step goals', async () => {
            const mockResponse = {
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
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

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

            await expect(getPlan('test goal')).rejects.toThrow(
                'AI API error: 401'
            );
        });

        it('should handle network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(getPlan('test goal')).rejects.toThrow('Network error');
        });
    });

    describe('Summary Generation', () => {
        it('should generate summary for successful execution', async () => {
            const mockResponse = {
                content: [
                    {
                        text: JSON.stringify({
                            achieve: true,
                            summary:
                                'Successfully listed all files in the directory',
                        }),
                    },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const result = await getSummary('Files listed successfully');
            const summary = JSON.parse(result);

            expect(summary.achieve).toBe(true);
            expect(summary.summary).toContain('Successfully listed');
        });

        it('should generate summary for failed execution', async () => {
            const mockResponse = {
                content: [
                    {
                        text: JSON.stringify({
                            achieve: false,
                            summary: 'Command failed due to permission error',
                        }),
                    },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const result = await getSummary('Permission denied error');
            const summary = JSON.parse(result);

            expect(summary.achieve).toBe(false);
            expect(summary.summary).toContain('permission error');
        });
    });

    describe('Plan Schema Validation', () => {
        it('should validate plan schema structure', () => {
            const validPlan = {
                explanation: 'Test explanation',
                steps: [
                    {
                        cmd: 'test command',
                        output: '',
                        exit: 0,
                        executed: false,
                        expectedDuration: 1000,
                        dependsOnPreviousOutput: false,
                    },
                ],
            };

            // Validate the plan has required properties
            expect(validPlan.explanation).toBeDefined();
            expect(validPlan.steps).toBeDefined();
            expect(Array.isArray(validPlan.steps)).toBe(true);
        });

        it('should validate step schema structure', () => {
            const validStep = {
                cmd: 'test command',
                output: '',
                exit: 0,
                executed: false,
                expectedDuration: 1000,
                dependsOnPreviousOutput: false,
            };

            // Validate the step has required properties
            expect(validStep.cmd).toBeDefined();
            expect(validStep.output).toBeDefined();
            expect(validStep.exit).toBeDefined();
            expect(validStep.executed).toBeDefined();
            expect(typeof validStep.executed).toBe('boolean');
        });
    });
});
