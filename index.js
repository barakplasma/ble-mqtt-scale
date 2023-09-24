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
import { throttledUpdateBabyBuddy } from "./baby-buddy-update.js";

const messages_counter = myMeter.createCounter('messages_received');

client.on('message', function (topic, message) {
    messages_counter.add(1);
    if (topic === process.env.MQTT_TOPIC) {

        tracer.startActiveSpan('message-received', async (span) => {
            const msg = message.toString()

            let payload = JSON.parse(msg);

            const parsed = parseManufacturerData(payload);

            sendParsedData(parsed);

            if (process.env.BABY_BUDDY_API_URL !== undefined && process.env.BABY_BUDDY_API_TOKEN !== undefined) {
                await throttledUpdateBabyBuddy(parsed);
            }

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
