import {
    getLogger,
    resetLogger,
    setLogLevel,
    setLogTransport,
} from '../../src/shared/logger';

describe('logger', () => {
    const createMockTransport = () => ({
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
    });

    afterEach(() => {
        resetLogger();
    });

    it('respects log level thresholds', () => {
        const transport = createMockTransport();
        setLogTransport(transport);
        setLogLevel('error');

        const logger = getLogger('test');
        logger.warn('ignore this');
        logger.error('capture this');

        expect(transport.warn).not.toHaveBeenCalled();
        expect(transport.error).toHaveBeenCalledTimes(1);
        expect(transport.error.mock.calls[0][0]).toBe('[test] capture this');
    });

    it('prefixes namespaced loggers', () => {
        const transport = createMockTransport();
        setLogTransport(transport);
        setLogLevel('debug');

        const parent = getLogger('parent');
        const child = parent.child('child');

        parent.info('parent message');
        child.debug('child message');

        expect(transport.info.mock.calls[0][0]).toBe('[parent] parent message');
        expect(transport.debug.mock.calls[0][0]).toBe(
            '[parent:child] child message'
        );
    });
});
