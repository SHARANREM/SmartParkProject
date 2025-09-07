🚦 CCTV Traffic Monitoring – YOLOv8 + traffic_eagleseye.pt

This project uses YOLOv8 for real-time traffic monitoring through CCTV footage.
The custom-trained model traffic_eagleseye.pt is designed for detecting and analyzing vehicles, pedestrians, and traffic patterns.

📌 Requirements

Python 3.8+

pip

Git

🔧 Installation

Clone the repository

git clone https://github.com/your-username/cctv-traffic-monitor.git
cd cctv-traffic-monitor


Create virtual environment (optional but recommended)

python -m venv venv
source venv/bin/activate   # for Linux/Mac
venv\Scripts\activate      # for Windows


Install dependencies

pip install ultralytics opencv-python

📥 Download Models

YOLOv8 (automatically installed with ultralytics).

traffic_eagleseye.pt – Custom-trained model.

👉 Download here
 and place it inside the models/ directory.

▶️ Usage

Run detection on CCTV feed or video:

yolo task=detect mode=predict model=models/traffic_eagleseye.pt source="cctv_feed.mp4" show=True


Run detection on live CCTV camera (RTSP/URL):

yolo task=detect mode=predict model=models/traffic_eagleseye.pt source="rtsp://your-camera-ip" show=True

📂 Project Structure
cctv-traffic-monitor/
│── models/
│   └── traffic_eagleseye.pt
│── data/
│   └── sample_video.mp4
│── results/
│── README.md

📊 Features

Real-time CCTV traffic analysis

Vehicle & pedestrian detection

Custom-trained YOLOv8 model (traffic_eagleseye.pt)

Easy integration with live CCTV streams



And Here is the ESP32 Module
/*
  ESP32 -> Firebase Realtime DB
  Updates:
   /parking/slots/slot1  ... slot4
     - sensor_value  (0/1)
     - status        ("occupied" / "empty")
     - last_changed  (ISO8601 local time e.g. 2025-09-07T06:31:03+05:30)
   /parking/meta
     - available
     - occupied
     - last_updated
*/
#include <WiFi.h>
#include <HTTPClient.h>




// -------- CONFIG ----------
const char* WIFI_SSID = "Redmi";
const char* WIFI_PASS = "1234567890";
const char* FIREBASE_HOST = "smartpark-5991c-default-rtdb.firebaseio.com";
const char* FIREBASE_AUTH = "RwKnXa2oe4nGptoyeIEuXoZcy21W7R1bkVyJwEDw"; // or ""

const int IR1 = 32;
const int IR2 = 33;
const int IR3 = 25;
const int IR4 = 26;

const unsigned long UPDATE_INTERVAL = 5000; // increase interval to reduce contention
unsigned long lastMillis = 0;

int lastState[4] = {-1, -1, -1, -1};

// Retry/backoff params
const int MAX_RETRIES = 4;
const unsigned long BACKOFF_BASE_MS = 400; // base backoff, will multiply

String makeSlotUrl(int slotIndex) {
  String url = "https://";
  url += FIREBASE_HOST;
  url += "/parking/slots/slot";
  url += String(slotIndex + 1);
  url += ".json";
  if (strlen(FIREBASE_AUTH) > 0) {
    url += "?auth=";
    url += FIREBASE_AUTH;
  }
  return url;
}

bool httpPutWithRetry(const String &url, const String &payload) {
  for (int attempt = 1; attempt <= MAX_RETRIES; ++attempt) {
    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    int code = http.PUT(payload);
    if (code > 0) {
      // success (or server returned HTTP status)
      Serial.printf("[HTTP] %s -> %d\n", url.c_str(), code);
      http.end();
      // treat 200/204/201 as success; other codes might be retryable depending on status
      return (code >= 200 && code < 300);
    } else {
      // client error (timeout or connection failed). log and retry
      Serial.printf("[HTTP] attempt %d failed, code=%d\n", attempt, code);
      http.end();
      unsigned long backoff = BACKOFF_BASE_MS * attempt; // linear backoff (can be exponential)
      delay(backoff);
    }
  }
  Serial.println("[HTTP] all attempts failed for url:");
  Serial.println(url);
  return false;
}

void sendSlotUpdate(int slotIndex, int sensorValue, const String &status, unsigned long tsMillis) {
  String url = makeSlotUrl(slotIndex);
  String payload = "{\"sensor_value\":";
  payload += String(sensorValue);
  payload += ",\"status\":\"";
  payload += status;
  payload += "\",\"last_changed\":";
  payload += String(tsMillis);
  payload += "}";

  bool ok = httpPutWithRetry(url, payload);
  if (!ok) Serial.printf("Failed to update slot%d after retries\n", slotIndex + 1);
}

void sendMetaUpdate(int occupied, int available, unsigned long tsMillis) {
  String url = String("https://") + FIREBASE_HOST + "/parking/meta.json";
  if (strlen(FIREBASE_AUTH) > 0) url += "?auth=" + String(FIREBASE_AUTH);
  String payload = "{\"occupied\":" + String(occupied) + ",\"available\":" + String(available) + ",\"last_updated\":" + String(tsMillis) + "}";
  bool ok = httpPutWithRetry(url, payload);
  if (!ok) Serial.println("Failed to update /parking/meta after retries");
}

void setup() {
  Serial.begin(115200);
  pinMode(IR1, INPUT);
  pinMode(IR2, INPUT);
  pinMode(IR3, INPUT);
  pinMode(IR4, INPUT);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected.");
  Serial.printf("RSSI: %d dBm\n", WiFi.RSSI());

  lastState[0] = digitalRead(IR1);
  lastState[1] = digitalRead(IR2);
  lastState[2] = digitalRead(IR3);
  lastState[3] = digitalRead(IR4);
}

void loop() {
  if (millis() - lastMillis < UPDATE_INTERVAL) return;
  lastMillis = millis();

  int raw[4];
  raw[0] = digitalRead(IR1);
  raw[1] = digitalRead(IR2);
  raw[2] = digitalRead(IR3);
  raw[3] = digitalRead(IR4);

  int occupied = 0, available = 0;
  for (int i = 0; i < 4; ++i) {
    int sensorValue = (raw[i] == HIGH) ? 1 : 0;
    String status = (raw[i] == HIGH) ? "empty" : "occupied";

    // only send if changed
    if (sensorValue != (lastState[i] == HIGH ? 1 : 0)) {
      Serial.printf("Change detected slot%d: %s\n", i+1, status.c_str());
      sendSlotUpdate(i, sensorValue, status, millis());
      lastState[i] = raw[i];
    }

    if (status == "occupied") occupied++; else available++;
  }

  // update meta (single call)
  sendMetaUpdate(occupied, available, millis());

  // debug info
  Serial.printf("Meta updated: occupied=%d available=%d, RSSI=%d\n", occupied, available, WiFi.RSSI());
}
