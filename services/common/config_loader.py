import json
import os
from typing import Any, Dict
from dataclasses import dataclass


class ConfigLoader:
    def __init__(self, config_dir: str = None):
        if config_dir is None:
            self.config_dir = os.path.join(
                os.path.dirname(os.path.abspath(__file__)), '..', '..', 'config', 'json'
            )
        else:
            self.config_dir = config_dir
        self.config_dir = os.path.abspath(self.config_dir)
        self._cache: Dict[str, Any] = {}

    def load(self, name: str) -> Dict[str, Any]:
        if name in self._cache:
            return self._cache[name]
        path = os.path.join(self.config_dir, f'{name}.json')
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        self._cache[name] = data
        return data

    def chariot_geometry(self) -> Dict[str, Any]:
        return self.load('chariot_geometry')

    def vehicle_dynamics(self) -> Dict[str, Any]:
        return self.load('vehicle_dynamics')

    def system_config(self) -> Dict[str, Any]:
        return self.load('system_config')

    def alert_thresholds(self) -> Dict[str, Any]:
        return self.load('alert_thresholds')


_config_loader: ConfigLoader = None


def get_config_loader() -> ConfigLoader:
    global _config_loader
    if _config_loader is None:
        _config_loader = ConfigLoader()
    return _config_loader
