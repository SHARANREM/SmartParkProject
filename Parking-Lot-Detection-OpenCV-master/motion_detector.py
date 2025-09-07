import cv2 as open_cv
import numpy as np
import logging
from drawing_utils import draw_contours
from colors import COLOR_GREEN, COLOR_WHITE, COLOR_BLUE
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin import db


class MotionDetector:
    LAPLACIAN = 1.4
    DETECT_DELAY = 1

    def __init__(self, video, coordinates, start_frame):
        self.video = video
        self.coordinates_data = coordinates
        self.start_frame = start_frame
        self.contours = []
        self.bounds = []
        self.mask = []

        if not firebase_admin._apps:
            cred = credentials.Certificate("serviceAccount.json")
            firebase_admin.initialize_app(cred, {
                "databaseURL": "https://smartpark-5991c-default-rtdb.firebaseio.com/"
            })
        self.db_ref = db.reference("CCTV_parking")


        # slot status memory
        self.slot_statuses = {}  # {slot_id: "occupied"/"empty"}

    def detect_motion(self):
        capture = open_cv.VideoCapture(self.video)
        capture.set(open_cv.CAP_PROP_POS_FRAMES, self.start_frame)

        coordinates_data = self.coordinates_data

        # preprocess slot masks
        for p in coordinates_data:
            coordinates = self._coordinates(p)
            rect = open_cv.boundingRect(coordinates)

            new_coordinates = coordinates.copy()
            new_coordinates[:, 0] = coordinates[:, 0] - rect[0]
            new_coordinates[:, 1] = coordinates[:, 1] - rect[1]

            self.contours.append(coordinates)
            self.bounds.append(rect)

            mask = open_cv.drawContours(
                np.zeros((rect[3], rect[2]), dtype=np.uint8),
                [new_coordinates],
                contourIdx=-1,
                color=255,
                thickness=-1,
                lineType=open_cv.LINE_8)

            mask = mask == 255
            self.mask.append(mask)

        statuses = [False] * len(coordinates_data)
        times = [None] * len(coordinates_data)
        # 🚨 Initialize all slots in DB with starting values
        for index, p in enumerate(coordinates_data):
            self.update_database(p["id"], statuses[index])
        while capture.isOpened():
            result, frame = capture.read()
            if frame is None:
                break

            if not result:
                raise CaptureReadError("Error reading video capture on frame %s" % str(frame))

            blurred = open_cv.GaussianBlur(frame.copy(), (5, 5), 3)
            grayed = open_cv.cvtColor(blurred, open_cv.COLOR_BGR2GRAY)
            new_frame = frame.copy()

            position_in_seconds = capture.get(open_cv.CAP_PROP_POS_MSEC) / 1000.0

            for index, p in enumerate(coordinates_data):
                status = self.__apply(grayed, index, p)

                if times[index] is not None and self.same_status(statuses, index, status):
                    times[index] = None
                    continue

                if times[index] is not None and self.status_changed(statuses, index, status):
                    if position_in_seconds - times[index] >= MotionDetector.DETECT_DELAY:
                        statuses[index] = status
                        times[index] = None
                        # 🚨 Firestore update when slot changes
                        self.update_database(p["id"], statuses[index])

                    continue

                if times[index] is None and self.status_changed(statuses, index, status):
                    times[index] = position_in_seconds

            # draw slots
            for index, p in enumerate(coordinates_data):
                coordinates = self._coordinates(p)
                color = COLOR_GREEN if statuses[index] else COLOR_BLUE
                draw_contours(new_frame, coordinates, str(p["id"] + 1), COLOR_WHITE, color)

            # Get FPS of video to sync playback speed
            fps = capture.get(open_cv.CAP_PROP_FPS)
            delay = int(1000 / fps) if fps > 0 else 30  # fallback to ~30fps

            open_cv.imshow(str(self.video), new_frame)
            k = open_cv.waitKey(delay)  # wait based on fps
            if k == ord("q"):
                break

        capture.release()
        open_cv.destroyAllWindows()
        
        # After video ends → mark all slots empty
        for index, p in enumerate(coordinates_data):
            self.update_database(p["id"], statuses[index])


    def update_database(self, slot_id, is_empty):
        slot_name = f"slot{slot_id+1}"
        status = "empty" if is_empty else "occupied"
        ts = datetime.now().astimezone().isoformat()

        old_status = self.slot_statuses.get(slot_name)
        if old_status != status:
            self.slot_statuses[slot_name] = status
            event = "became_empty" if status == "empty" else "became_occupied"

            # Update slots
            self.db_ref.child("slots").child(slot_name).update({
                "id": slot_id + 1,
                "last_changed": ts,
                "sensor_value": 1 if is_empty else 0,
                "status": status
            })

            # Append log (push creates unique IDs under 'recent')
            self.db_ref.child("logs").child("recent").push({
                "event": event,
                "slot": slot_name,
                "ts": ts
            })

            # Update meta
            self.db_ref.child("meta").update({
                "last_updated": ts
            })

            print(f"[RTDB] {slot_name} {event} at {ts}")

    def __apply(self, grayed, index, p):
        coordinates = self._coordinates(p)
        rect = self.bounds[index]

        # Ensure ROI is inside frame boundaries
        h, w = grayed.shape
        x, y, bw, bh = rect
        if x < 0 or y < 0 or x + bw > w or y + bh > h:
            logging.warning(f"Slot {p['id']} is out of video bounds, skipping.")
            return False  # Treat as empty instead of crashing

        roi_gray = grayed[y:y + bh, x:x + bw]
        if roi_gray.size == 0:  # Extra safety
            logging.warning(f"Empty ROI for slot {p['id']}, skipping.")
            return False

        laplacian = open_cv.Laplacian(roi_gray, open_cv.CV_64F)

        coordinates[:, 0] = coordinates[:, 0] - rect[0]
        coordinates[:, 1] = coordinates[:, 1] - rect[1]

        status = np.mean(np.abs(laplacian * self.mask[index])) < MotionDetector.LAPLACIAN
        return status


    @staticmethod
    def _coordinates(p):
        return np.array(p["coordinates"])

    @staticmethod
    def same_status(coordinates_status, index, status):
        return status == coordinates_status[index]

    @staticmethod
    def status_changed(coordinates_status, index, status):
        return status != coordinates_status[index]


class CaptureReadError(Exception):
    pass
