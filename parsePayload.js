import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('parser', '1');

/**
 * @typedef {Object} ScaleData
 * @property {string} unit
 * @property {number} weight
 * @property {boolean} tared
 * @property {boolean} weightIsStable
 * @param {string} payload
 * @returns {ScaleData}
 * @example
 * const payload = {
        manufacturerData: '7a5f87000008000282ed67394bda25',
        unit: 'grams',
        weight: 0,
        tared: false,
        weightIsStable: true
    }
 */

/**
 * Parses Manufacturer Data from a payload
 * @param {{manufacturerdata?: string}} payload
 * @returns {ScaleData}
 */
export function parseManufacturerData(payload) {
    return tracer.startActiveSpan('parseManufacturerData', (span) => {
        try {
            if (typeof payload.manufacturerdata !== 'string') {
                const err = new Error("payload.manufacturerdata is not a string");
                span.recordException(err);
                throw err;
            }
            const manufacturerData = payload.manufacturerdata;
            const tared = ["9", "b"].includes(manufacturerData.substring(16, 17));
            const weightIsStable = ["8", "9", "b"].includes(manufacturerData.substring(16, 17));
            const negative = "b" === manufacturerData.substring(16, 17);
            const weight = parseInt(manufacturerData.substring(7, 10), 16) * (negative ? -1 : 1);
            const unit = { "2": "grams", "4": "mL", "6": "floz", "8": "lb-oz" }[manufacturerData.substring(17, 18)];
            const parsed = { unit, weight, tared, weightIsStable };
            span.addEvent("Parsed payload", parsed);
            span.end();
            return parsed;
        } catch (error) {
            span.recordException(error);
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw error;
        }
    });
}
