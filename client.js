import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('mqtt-client', '1');

import mqtt from 'mqtt';
const { MQTT_SERVER, MQTT_USERNAME, MQTT_PASSWORD } = process.env;

if (!MQTT_SERVER) {
    console.error("MQTT_SERVER not set");
    process.exit(1);
}

const client = mqtt.connect(MQTT_SERVER, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD
})

const { MQTT_TOPIC, MQTT_TOPIC_FOR_PARSED_DATA } = process.env;

if (!MQTT_TOPIC) {
    console.error("MQTT_TOPIC not set");
    process.exit(1);
}

if (typeof MQTT_TOPIC_FOR_PARSED_DATA !== 'string') {
    console.error("MQTT_TOPIC_FOR_PARSED_DATA not set");
    process.exit(1);
}

client.on('connect', function () {
    tracer.startActiveSpan('mqtt-subscribe', (span) => {
        client.subscribe(MQTT_TOPIC, function (err) {
            if (!err) {
                span.addEvent("Successfully subscribed to receiving topic");
            }
            if (err instanceof Error) {
                span.recordException(err);
                span.setStatus({ code: SpanStatusCode.ERROR });
            }
            span.end();
        });
    });
});

export default client;
