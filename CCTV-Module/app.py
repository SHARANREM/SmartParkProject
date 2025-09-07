import cv2
from ultralytics import YOLO

# Load YOLO COCO model
model_coco = YOLO("yolov8m.pt")
valid_classes = ["car", "motorcycle", "bus", "truck"]

# Define parking slots
parking_slots = {
    1: (50, 100, 200, 250),
    2: (220, 100, 370, 250),
    3: (390, 100, 540, 250),
}

def detect_vehicles(frame):
    """Detect only valid vehicle boxes using COCO."""
    vehicles = []
    results = model_coco(frame)
    for r in results[0].boxes:
        cls_id = int(r.cls[0])
        label = model_coco.names[cls_id]
        if label in valid_classes:
            x1, y1, x2, y2 = map(int, r.xyxy[0])
            vehicles.append({"label": label, "box": (x1, y1, x2, y2)})
    return vehicles

def object_inside_slot(obj_box, slot_box):
    """Return True if object box fully fits in slot box"""
    vx1, vy1, vx2, vy2 = obj_box
    sx1, sy1, sx2, sy2 = slot_box
    return vx1 >= sx1 and vy1 >= sy1 and vx2 <= sx2 and vy2 <= sy2

def run_parking_monitor():
    cap = cv2.VideoCapture(0)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Detect only vehicles
        vehicles = detect_vehicles(frame)

        # Keep only vehicles inside slots
        vehicles_in_slots = []
        for slot_id, slot_box in parking_slots.items():
            for v in vehicles:
                if object_inside_slot(v["box"], slot_box):
                    vehicles_in_slots.append({"slot_id": slot_id, **v})

        # Print only vehicles inside slots
        for v in vehicles_in_slots:
            print(f"{v['label']} in slot {v['slot_id']}")

        # Draw slots
        for slot_id, box in parking_slots.items():
            color = (255, 0, 0)
            cv2.rectangle(frame, (box[0], box[1]), (box[2], box[3]), color, 2)
            cv2.putText(frame, f"Slot {slot_id}", (box[0], box[1]-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        # Draw only vehicle boxes inside slots
        for v in vehicles_in_slots:
            x1, y1, x2, y2 = v["box"]
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame, v["label"], (x1, y1-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        cv2.imshow("Parking Monitor", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    run_parking_monitor()
