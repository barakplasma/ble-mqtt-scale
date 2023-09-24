import opentelemetry from '@opentelemetry/api';

const tracer = opentelemetry.trace.getTracer(
    'ble-mqtt-scale-baby-buddy-updater',
    '1',
);
const myMeter = opentelemetry.metrics.getMeter('ble-mqtt-scale-baby-buddy-meter', '1');

import pThrottle from 'p-throttle';

const throttle = pThrottle({
    limit: 5,
    interval: 5e3,
});

const { BABY_BUDDY_API_URL, BABY_BUDDY_API_TOKEN } = process.env;
const Authorization = `Token ${BABY_BUDDY_API_TOKEN}`;

if (BABY_BUDDY_API_URL === undefined || BABY_BUDDY_API_TOKEN === undefined) {
    console.error("BABY_BUDDY_API_URL or BABY_BUDDY_API_TOKEN not set");
    process.exit(1);
}
const weightMeter = myMeter.createHistogram('weight', {
    description: 'Weights measured',
    unit: 'g',
});

import TTLCache from "@isaacs/ttlcache";
const oneDay = String(1000 * 60 * 60 * 24);
const cache = new TTLCache({
    max: parseInt(process.env.MAX_CACHE ?? '1000'),
    ttl: parseInt(process.env.TTL ?? oneDay)
});

/**
 *
 * @param {import("./parsePayload.js").ScaleData} parsed
 */
const updateBabyBuddy = (parsed) => {
    tracer.startActiveSpan('update-baby-buddy', async (span) => {
        const date = new Date().toISOString().slice(0, 16);

        updateCache(date, parsed);

        await sendRequest(date, parsed, span);

        weightMeter.record(parsed.weight);
        span.end();
    });
}

export const throttledUpdateBabyBuddy = throttle(updateBabyBuddy);

const sendRequest = async (
    /** @type {string} */ date,
    /** @type {import("./parsePayload.js").ScaleData} */ parsed,
    /** @type {import("@opentelemetry/api").Span} */ span
) => {
    let options = {
        method: 'PATCH',
        headers: {
            'content-type': 'application/json',
            Authorization
        },
        body: JSON.stringify({
            note: JSON.stringify({
                date,
                cache: [...cache.entries()].map(x => (
                    {
                        date: x[0],
                        weights: [...x[1]]
                    }
                )).reverse(),
                ...parsed,
            }, null, 2)
        })
    };

    await fetch(BABY_BUDDY_API_URL, options)
        .then(res => res.json())
        .then(json => span.addEvent("updated-baby-buddy", json))
        .catch(err => span.recordException(err));
}

function updateCache(
    /** @type {string} */ date,
    /** @type {import("./parsePayload.js").ScaleData} */ parsed,
) {
    if (cache.has(date)) {
        let cachedSet = cache.get(date);
        cachedSet.add(parsed.weight);
        cache.set(date, cachedSet);
    } else {
        cache.set(date, new Set([parsed.weight]));
    }
}

