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
