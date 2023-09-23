# Yolanda BLE Food Scale to MQTT

This repo parses BLE readings for the

| Yolanda CK10B Food Scale | ![Yolanda CK10B Food Scale](CK10B.png) |
|-----|-----|
| Size                        | 209mm x 181.2mm x 20mm                |
| Capacity                    | 2g - 5000g                            |
| Display                     | LCD, Key Button                        |
| Wireless Mode               | Bluetooth 4.0                          |
| Units Switch                | g / ml / fl.oz. / lb:oz               |
| Power                       | 2 x 1.5V AAA Batteries                 |
| source: | https://www.yolanda.hk/en/kitchenScale.html |

sent via https://docs.openmqttgateway.com/ to an mqtt broker.

[parsePayload.js](./parsePayload.js) contains the logic to parse the manufacturer data from the BLE advertisement packet coming from the scale.

This app then publishes the parsed data back to the MQTT broker using the MQTT_TOPIC_FOR_PARSED_DATA env var as the destination.

## Installation
1. Setup https://github.com/1technophile/OpenMQTTGateway preferably on an ESP32 running the [esp32dev-ble-datatest](https://docs.openmqttgateway.com/prerequisites/boards/esp32dev-ble-datatest.html) firmware.
1. Configure the OpenMQTTGateway to connect to your MQTT broker
1. Use dotenv .env to setup the environment variables to connect to the same MQTT broker
1. `npm install`
1. `npm start` (or npm run dev)

## Config example
```bash
MQTT_SERVER=mqtt://localhost
MQTT_USERNAME=user
MQTT_PASSWORD=password
MQTT_TOPIC=home/OMG_ESP32_BLE/BTtoMQTT/ED67394BDA25
MQTT_TOPIC_FOR_PARSED_DATA=home/yolanda/weight
```

## Logging / OpenTelemetry

This project uses @opentelemetry/sdk-node to log / instrument the app. this gives you console logs in JSON format with the weight.
