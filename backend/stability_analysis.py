import math
import numpy as np
from dataclasses import dataclass
from typing import Tuple, Optional


@dataclass
class VehicleDynamicsParams:
    wheelbase: float = 2.5
    track_width: float = 1.8
    cg_height: float = 0.8
    roll_center_height: float = 0.3
    mass: float = 800.0
    roll_stiffness: float = 30000.0
    damping_ratio: float = 0.3
    wheel_radius: float = 0.35


@dataclass
class StabilityResult:
    roll_angle: float
    roll_rate: float
    yaw_rate: float
    lateral_acceleration: float
    roll_center_height: float
    rollover_risk: float
    stability_index: float
    understeer_gradient: float
    critical_speed: float


class RollCenterAnalyzer:
    def __init__(self, params: VehicleDynamicsParams = None):
        self.params = params or VehicleDynamicsParams()

    def calculate_roll_center_height(self, roll_angle_deg: float,
                                     wheel_displacement_left: float = 0.0,
                                     wheel_displacement_right: float = 0.0) -> float:
        T = self.params.track_width
        h_rc_base = self.params.roll_center_height
        h_cg = self.params.cg_height

        roll_angle = math.radians(roll_angle_deg)

        lateral_shift = h_rc_base * math.sin(roll_angle)

        track_change = abs(wheel_displacement_left - wheel_displacement_right)
        h_rc_dynamic = h_rc_base * (1 + 0.1 * track_change / T)

        roll_geometry_effect = math.sin(abs(roll_angle)) * T / 2 * 0.15

        return h_rc_dynamic + roll_geometry_effect


class YawRateAnalyzer:
    def __init__(self, params: VehicleDynamicsParams = None):
        self.params = params or VehicleDynamicsParams()

    def calculate_yaw_rate(self, speed: float, steering_angle_deg: float,
                           friction_coeff: float = 0.7) -> float:
        L = self.params.wheelbase
        steering_angle = math.radians(steering_angle_deg)

        if abs(steering_angle) < 0.001:
            return 0.0

        R = L / math.tan(steering_angle)

        ideal_yaw_rate = speed / R if abs(R) > 0.001 else 0.0

        slip_factor = 1.0 - 0.3 * (1.0 - friction_coeff)
        actual_yaw_rate = ideal_yaw_rate * slip_factor

        return actual_yaw_rate

    def calculate_lateral_acceleration(self, speed: float, yaw_rate: float,
                                       roll_angle_deg: float = 0.0) -> float:
        ay_centripetal = speed * yaw_rate

        roll_angle = math.radians(roll_angle_deg)
        ay_corrected = ay_centripetal * math.cos(roll_angle) + 9.81 * math.sin(roll_angle)

        return ay_corrected


class RolloverRiskAnalyzer:
    def __init__(self, params: VehicleDynamicsParams = None):
        self.params = params or VehicleDynamicsParams()
        self.roll_center_analyzer = RollCenterAnalyzer(params)
        self.yaw_analyzer = YawRateAnalyzer(params)

    def calculate_ssf(self) -> float:
        T = self.params.track_width
        h_cg = self.params.cg_height
        return T / (2 * h_cg)

    def calculate_rollover_risk(self, speed: float, steering_angle_deg: float,
                                friction_coeff: float = 0.7,
                                roll_angle_deg: float = 0.0) -> Tuple[float, str]:
        T = self.params.track_width
        h_cg = self.params.cg_height
        h_rc = self.roll_center_analyzer.calculate_roll_center_height(roll_angle_deg)
        h_eff = h_cg - h_rc

        yaw_rate = self.yaw_analyzer.calculate_yaw_rate(speed, steering_angle_deg, friction_coeff)
        ay = self.yaw_analyzer.calculate_lateral_acceleration(speed, yaw_rate, roll_angle_deg)

        ay_g = abs(ay) / 9.81

        ssf = self.calculate_ssf()

        roll_threshold = T / (2 * h_eff) if h_eff > 0 else float('inf')

        risk_ratio = ay_g / roll_threshold if roll_threshold > 0 else 0

        risk_percentage = min(100.0, risk_ratio * 100)

        if risk_percentage < 30:
            level = "安全"
        elif risk_percentage < 60:
            level = "注意"
        elif risk_percentage < 85:
            level = "警告"
        else:
            level = "危险"

        return risk_percentage, level

    def calculate_critical_speed(self, friction_coeff: float = 0.7,
                                  steering_angle_deg: float = 10.0) -> float:
        L = self.params.wheelbase
        T = self.params.track_width
        h_cg = self.params.cg_height
        h_rc = self.params.roll_center_height

        steering_angle = math.radians(steering_angle_deg)

        R = L / math.tan(steering_angle) if abs(steering_angle) > 0.001 else 100

        v_rollover = math.sqrt(9.81 * T * R / (2 * (h_cg - h_rc)))

        v_slide = math.sqrt(9.81 * friction_coeff * R)

        return min(v_rollover, v_slide)


class StabilityAnalyzer:
    def __init__(self, params: VehicleDynamicsParams = None):
        self.params = params or VehicleDynamicsParams()
        self.roll_center = RollCenterAnalyzer(params)
        self.yaw_analyzer = YawRateAnalyzer(params)
        self.rollover_risk = RolloverRiskAnalyzer(params)

    def analyze(self, speed: float, pole_angle_deg: float, roll_angle_deg: float,
                slip_rate: float = 0.1, friction_coeff: float = 0.7,
                dt: float = 60.0) -> StabilityResult:
        h_rc = self.roll_center.calculate_roll_center_height(roll_angle_deg)

        yaw_rate = self.yaw_analyzer.calculate_yaw_rate(speed, pole_angle_deg, friction_coeff)

        ay = self.yaw_analyzer.calculate_lateral_acceleration(speed, yaw_rate, roll_angle_deg)

        roll_rate = roll_angle_deg / dt if dt > 0 else 0

        risk_pct, _ = self.rollover_risk.calculate_rollover_risk(
            speed, pole_angle_deg, friction_coeff, roll_angle_deg
        )

        ssf = self.rollover_risk.calculate_ssf()
        ay_g = abs(ay) / 9.81
        stability_index = max(0.0, min(1.0, 1.0 - risk_pct / 100.0))

        understeer_gradient = self._calculate_understeer_gradient(
            pole_angle_deg, ay, friction_coeff
        )

        critical_speed = self.rollover_risk.calculate_critical_speed(
            friction_coeff, pole_angle_deg if abs(pole_angle_deg) > 1 else 10
        )

        return StabilityResult(
            roll_angle=roll_angle_deg,
            roll_rate=roll_rate,
            yaw_rate=math.degrees(yaw_rate),
            lateral_acceleration=ay,
            roll_center_height=h_rc,
            rollover_risk=risk_pct,
            stability_index=stability_index,
            understeer_gradient=understeer_gradient,
            critical_speed=critical_speed
        )

    def _calculate_understeer_gradient(self, steering_angle_deg: float,
                                       lateral_accel: float,
                                       friction_coeff: float) -> float:
        if abs(lateral_accel) < 0.01:
            return 0.0

        L = self.params.wheelbase
        steering_angle = math.radians(steering_angle_deg)

        ay_g = lateral_accel / 9.81

        K_us = (steering_angle * 180 / math.pi) / (ay_g + 0.001) - 180 * L / (9.81 * math.pi * 30)

        return K_us * friction_coeff

    def calculate_stability_margin(self, speed: float, pole_angle_deg: float,
                                   friction_coeff: float = 0.7) -> dict:
        critical_speed = self.rollover_risk.calculate_critical_speed(
            friction_coeff, pole_angle_deg
        )

        speed_margin = critical_speed - speed
        speed_margin_pct = (speed_margin / critical_speed * 100) if critical_speed > 0 else 0

        _, risk_level = self.rollover_risk.calculate_rollover_risk(
            speed, pole_angle_deg, friction_coeff
        )

        return {
            "critical_speed": critical_speed,
            "current_speed": speed,
            "speed_margin": speed_margin,
            "speed_margin_percent": speed_margin_pct,
            "risk_level": risk_level
        }


if __name__ == "__main__":
    analyzer = StabilityAnalyzer()
    result = analyzer.analyze(
        speed=8.0,
        pole_angle_deg=15.0,
        roll_angle_deg=12.0,
        slip_rate=0.15,
        friction_coeff=0.6
    )
    print(f"侧倾角: {result.roll_angle:.1f}°")
    print(f"横摆角速度: {result.yaw_rate:.2f}°/s")
    print(f"侧向加速度: {result.lateral_acceleration:.2f} m/s²")
    print(f"侧倾中心高度: {result.roll_center_height:.3f} m")
    print(f"侧翻风险: {result.rollover_risk:.1f}%")
    print(f"稳定性指数: {result.stability_index:.2f}")
    print(f"临界速度: {result.critical_speed:.2f} m/s")
