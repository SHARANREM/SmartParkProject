import argparse
import yaml
import logging
from motion_detector import MotionDetector


def main():
    logging.basicConfig(level=logging.INFO)

    data_file = "data/coordinates_1.yml"
    start_frame = 400
    video_file = "videos/o.mp4"

    # Load coordinates directly
    with open(data_file, "r") as data:
        points = yaml.load(data, Loader=yaml.FullLoader)

    # Start motion detection
    detector = MotionDetector(video_file, points, int(start_frame))
    detector.detect_motion()


def parse_args():
    parser = argparse.ArgumentParser(description='Parking Lot Motion Detection')

    parser.add_argument("--video",
                        dest="video_file",
                        required=True,
                        help="Video file to detect motion on")

    parser.add_argument("--data",
                        dest="data_file",
                        required=True,
                        help="YAML file with parking slot coordinates")

    parser.add_argument("--start-frame",
                        dest="start_frame",
                        required=False,
                        default=1,
                        help="Starting frame on the video")

    return parser.parse_args()


if __name__ == '__main__':
    main()
