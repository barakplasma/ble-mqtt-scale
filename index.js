import 'dotenv/config'

import './instrumentation.js'
import opentelemetry from '@opentelemetry/api';

const tracer = opentelemetry.trace.getTracer(
    'ble-mqtt-scale-parser',
    '1',
);
const myMeter = opentelemetry.metrics.getMeter('ble-mqtt-scale-parser-meter', '1');

import client from './client.js';
import { parseManufacturerData } from "./parsePayload.js";

const messages_counter = myMeter.createCounter('messages_received');

import pThrottle from 'p-throttle';

const throttle = pThrottle({
    limit: 5,
    interval: 5e3,
});

client.on('message', function (topic, message) {
    messages_counter.add(1);
    if (topic === process.env.MQTT_TOPIC) {

        tracer.startActiveSpan('message-received', (span) => {
            const msg = message.toString()

            let payload = JSON.parse(msg);

            const parsed = parseManufacturerData(payload);

            sendParsedData(parsed);

            throttledUpdateBabyBuddy(parsed);

            span.end();
        });
    }
})

const { MQTT_TOPIC_FOR_PARSED_DATA } = process.env;

/**
 *
 * @param {import("./parsePayload.js").ScaleData} parsed
 */
function sendParsedData(parsed) {
    tracer.startActiveSpan('send-parsed-data', (span) => {
        if (typeof MQTT_TOPIC_FOR_PARSED_DATA !== 'string') {
            console.error("MQTT_TOPIC_FOR_PARSED_DATA not set");
            process.exit(1);
        }
        span.setAttribute("topic", MQTT_TOPIC_FOR_PARSED_DATA);
        client.publish(
            MQTT_TOPIC_FOR_PARSED_DATA,
            JSON.stringify(parsed), {
            retain: true
        });
        span.end();
    });
}

const { BABY_BUDDY_API_URL, BABY_BUDDY_API_TOKEN } = process.env;
const Authorization = `Token ${BABY_BUDDY_API_TOKEN}`;
if (BABY_BUDDY_API_URL === undefined || BABY_BUDDY_API_TOKEN === undefined) {
    console.error("BABY_BUDDY_API_URL or BABY_BUDDY_API_TOKEN not set");
    process.exit(1);
}
const weightMeter = myMeter.createHistogram('weight', {
    description: 'Weight of the baby',
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

        if (cache.has(date)) {
            let cachedSet = cache.get(date);
            cachedSet.add(parsed.weight);
            cache.set(date, cachedSet);
        } else {
            cache.set(date, new Set([parsed.weight]));
        }

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

        weightMeter.record(parsed.weight);
        span.end();
    });
}

const throttledUpdateBabyBuddy = throttle(updateBabyBuddy);
