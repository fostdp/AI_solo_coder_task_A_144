import math
import numpy as np
from dataclasses import dataclass
from typing import Tuple


@dataclass
class ChariotParams:
    wheelbase: float = 2.5
    track_width: float = 1.8
    wheel_radius: float = 0.35
    pole_length: float = 1.8
    kingpin_offset: float = 0.1


@dataclass
class SteeringResult:
    inner_wheel_angle: float
    outer_wheel_angle: float
    turning_radius: float
    wheel_speed_diff: float
    ackermann_error: float
    pole_effective_angle: float


class AckermannSteeringModel:
    def __init__(self, params: ChariotParams = None):
        self.params = params or ChariotParams()

    def calculate_ackermann_geometry(self, pole_angle_deg: float) -> SteeringResult:
        pole_angle = math.radians(pole_angle_deg)

        L = self.params.wheelbase
        T = self.params.track_width
        d = self.params.kingpin_offset

        if abs(pole_angle) < 0.001:
            return SteeringResult(
                inner_wheel_angle=0.0,
                outer_wheel_angle=0.0,
                turning_radius=float('inf'),
                wheel_speed_diff=0.0,
                ackermann_error=0.0,
                pole_effective_angle=pole_angle_deg
            )

        R = L / math.tan(abs(pole_angle))

        inner_angle = math.atan(L / (R - T / 2))
        outer_angle = math.atan(L / (R + T / 2))

        R_actual = L / math.tan(inner_angle) + T / 2 - d * math.sin(inner_angle)

        wheel_speed_diff = T / (2 * R) if R != 0 else 0

        ackermann_error = abs(1 / math.tan(outer_angle) - 1 / math.tan(inner_angle) + T / L) / (T / L)

        if pole_angle < 0:
            inner_angle = -inner_angle
            outer_angle = -outer_angle

        return SteeringResult(
            inner_wheel_angle=math.degrees(inner_angle),
            outer_wheel_angle=math.degrees(outer_angle),
            turning_radius=R_actual,
            wheel_speed_diff=wheel_speed_diff,
            ackermann_error=ackermann_error,
            pole_effective_angle=pole_angle_deg
        )


class MultiBodyDynamicsSteering:
    def __init__(self, params: ChariotParams = None):
        self.params = params or ChariotParams()
        self.ackermann = AckermannSteeringModel(params)

    def _linkage_kinematics(self, pole_angle: float, tie_rod_length: float = 1.2,
                            arm_length: float = 0.25) -> Tuple[float, float]:
        L = self.params.wheelbase
        T = self.params.track_width
        pole_rad = math.radians(pole_angle)

        inner_angle = pole_rad * 0.85
        outer_angle = pole_rad * 0.72

        if abs(pole_rad) > 0.01:
            ideal = self.ackermann.calculate_ackermann_geometry(pole_angle)
            inner_angle = math.radians(ideal.inner_wheel_angle) * 0.98
            outer_angle = math.radians(ideal.outer_wheel_angle) * 0.95

        return inner_angle, outer_angle

    def calculate_steering(self, pole_angle: float, vehicle_speed: float = 5.0,
                           friction_coeff: float = 0.7) -> SteeringResult:
        ack_result = self.ackermann.calculate_ackermann_geometry(pole_angle)

        inner_angle, outer_angle = self._linkage_kinematics(pole_angle)

        L = self.params.wheelbase
        T = self.params.track_width

        avg_angle = (abs(inner_angle) + abs(outer_angle)) / 2
        if avg_angle > 0.001:
            actual_radius = L / math.tan(avg_angle) + T / 4
        else:
            actual_radius = float('inf')

        slip_factor = 1.0 - (friction_coeff - 0.3) * 0.2
        actual_radius *= slip_factor

        if abs(actual_radius) > 0.001:
            speed_diff = (T / 2) / abs(actual_radius)
        else:
            speed_diff = 0

        ackermann_error = abs(ack_result.ackermann_error - (outer_angle - inner_angle) / inner_angle) if inner_angle != 0 else 0

        return SteeringResult(
            inner_wheel_angle=math.degrees(inner_angle),
            outer_wheel_angle=math.degrees(outer_angle),
            turning_radius=actual_radius,
            wheel_speed_diff=speed_diff,
            ackermann_error=ackermann_error,
            pole_effective_angle=pole_angle * 0.9
        )

    def get_wheel_trajectory(self, pole_angle: float, speed: float = 5.0,
                             duration: float = 10.0, dt: float = 0.1) -> dict:
        result = self.calculate_steering(pole_angle, speed)

        num_steps = int(duration / dt)
        x_inner = np.zeros(num_steps)
        y_inner = np.zeros(num_steps)
        x_outer = np.zeros(num_steps)
        y_outer = np.zeros(num_steps)
        x_center = np.zeros(num_steps)
        y_center = np.zeros(num_steps)

        R = result.turning_radius
        T = self.params.track_width

        if R == float('inf') or abs(R) > 1000:
            for i in range(num_steps):
                s = speed * i * dt
                x_inner[i] = s
                y_inner[i] = -T / 2
                x_outer[i] = s
                y_outer[i] = T / 2
                x_center[i] = s
                y_center[i] = 0
        else:
            direction = 1 if pole_angle > 0 else -1
            R_abs = abs(R)
            angular_vel = speed / R_abs

            for i in range(num_steps):
                theta = angular_vel * i * dt
                x_center[i] = R_abs * math.sin(theta) * direction
                y_center[i] = R_abs * (1 - math.cos(theta))

                R_inner = R_abs - T / 2
                R_outer = R_abs + T / 2

                x_inner[i] = R_inner * math.sin(theta) * direction
                y_inner[i] = R_inner * (1 - math.cos(theta))
                x_outer[i] = R_outer * math.sin(theta) * direction
                y_outer[i] = R_outer * (1 - math.cos(theta))

        return {
            "inner_wheel": {"x": x_inner.tolist(), "y": y_inner.tolist()},
            "outer_wheel": {"x": x_outer.tolist(), "y": y_outer.tolist()},
            "center": {"x": x_center.tolist(), "y": y_center.tolist()},
            "turning_radius": R,
            "duration": duration
        }

    def get_linkage_positions(self, pole_angle: float) -> dict:
        L = self.params.wheelbase
        T = self.params.track_width
        arm_len = 0.25
        tie_rod_len = T - 2 * arm_len * math.sin(math.radians(15))

        inner_angle, outer_angle = self._linkage_kinematics(pole_angle)

        left_knuckle_x = -T / 2
        left_knuckle_y = 0
        right_knuckle_x = T / 2
        right_knuckle_y = 0

        left_arm_end_x = left_knuckle_x - arm_len * math.sin(outer_angle)
        left_arm_end_y = left_knuckle_y + arm_len * math.cos(outer_angle)

        right_arm_end_x = right_knuckle_x + arm_len * math.sin(inner_angle)
        right_arm_end_y = right_knuckle_y + arm_len * math.cos(inner_angle)

        pole_base_x = 0
        pole_base_y = L / 2

        pole_angle_rad = math.radians(pole_angle)
        pole_tip_x = pole_base_x + self.params.pole_length * math.sin(pole_angle_rad)
        pole_tip_y = pole_base_y + self.params.pole_length * math.cos(pole_angle_rad)

        return {
            "left_knuckle": {"x": left_knuckle_x, "y": left_knuckle_y},
            "right_knuckle": {"x": right_knuckle_x, "y": right_knuckle_y},
            "left_arm_end": {"x": left_arm_end_x, "y": left_arm_end_y},
            "right_arm_end": {"x": right_arm_end_x, "y": right_arm_end_y},
            "tie_rod_left": {"x": left_arm_end_x, "y": left_arm_end_y},
            "tie_rod_right": {"x": right_arm_end_x, "y": right_arm_end_y},
            "pole_base": {"x": pole_base_x, "y": pole_base_y},
            "pole_tip": {"x": pole_tip_x, "y": pole_tip_y},
            "left_wheel_angle": math.degrees(outer_angle),
            "right_wheel_angle": math.degrees(inner_angle)
        }
