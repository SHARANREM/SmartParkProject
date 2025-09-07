import cv2
from ultralytics import YOLO
from collections import defaultdict

# Load models
model_birdeye = YOLO("traffic_birdseye.pt")
model_coco = YOLO("yolov8m.pt")

# Valid vehicle classes
valid_classes = ["car", "motorcycle", "bus", "truck", "vehicle"]  # include BirdEye's 'vehicle'

# --- Image detection (both models) ---
def detect_separate(img):
    detections = {
        "birdeye": defaultdict(list),
        "coco": defaultdict(list)
    }

    # BirdEye detections
    results_birdeye = model_birdeye(img)
    for r in results_birdeye[0].boxes:
        cls_id = int(r.cls[0])
        label = model_birdeye.names[cls_id]
        conf = float(r.conf[0])
        detections["birdeye"][label].append(conf)

    # COCO detections
    results_coco = model_coco(img)
    for r in results_coco[0].boxes:
        cls_id = int(r.cls[0])
        label = model_coco.names[cls_id]
        conf = float(r.conf[0])
        if label in valid_classes:
            detections["coco"][label].append(conf)

    # Convert defaultdicts to dicts
    detections["birdeye"] = dict(detections["birdeye"])
    detections["coco"] = dict(detections["coco"])

    return results_birdeye, results_coco, detections

def test_image(path):
    img = cv2.imread(path)
    results_birdeye, results_coco, detections = detect_separate(img)

    print("Detections:", detections)

    annotated_birdeye = results_birdeye[0].plot()
    annotated_coco = results_coco[0].plot()

    cv2.imshow("BirdEye Detection", annotated_birdeye)
    cv2.imshow("COCO Detection", annotated_coco)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

# --- Video detection (COCO only) ---
def detect_coco(img):
    """Detect vehicles in a single image using COCO."""
    detections = defaultdict(list)
    results_coco = model_coco(img)
    for r in results_coco[0].boxes:
        cls_id = int(r.cls[0])
        label = model_coco.names[cls_id]
        conf = float(r.conf[0])
        if label in valid_classes:
            detections[label].append(conf)
    return results_coco, dict(detections)
def process_video(video_path, output_path=None, frame_skip=2):
    """
    Detect vehicles in a video using COCO, skipping frames for faster processing.
    
    frame_skip: process every N-th frame (e.g., 2 = every 2nd frame)
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("Error: Cannot open video.")
        return

    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    if output_path:
        out = cv2.VideoWriter(
            output_path,
            cv2.VideoWriter_fourcc(*'mp4v'),
            fps,
            (frame_width, frame_height)
        )

    video_detections = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Skip frames
        if frame_idx % frame_skip != 0:
            frame_idx += 1
            continue

        results_coco, detections = detect_coco(frame)
        video_detections.append(detections)

        annotated_frame = results_coco[0].plot()
        cv2.imshow("COCO Vehicle Detection", annotated_frame)
        if output_path:
            out.write(annotated_frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

        frame_idx += 1

        if frame_idx % 30 == 0:
            print(f"Processed {frame_idx} frames...")

    cap.release()
    if output_path:
        out.release()
    cv2.destroyAllWindows()

    return video_detections

if __name__ == "__main__":
    # Test image with both models
    # test_image("test2.jpg")

    # Process video with COCO only
    video_detections = process_video("v1.mp4", output_path="output_video.mp4")
    print("Sample video detections (first 5 frames):")
    print(video_detections[:5])
