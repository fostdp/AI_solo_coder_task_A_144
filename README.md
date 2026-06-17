# 古代双辕车转向机构仿真与操控稳定性分析系统

某交通史团队对秦汉双辕车进行复原研究的仿真分析系统。

## 项目概述

本系统实现了古代双辕车的转向机构仿真与操控稳定性分析，包括：
- 基于阿克曼转向几何和多体动力学的转向机构仿真模型
- 基于侧倾中心和横摆角速度的操控稳定性分析
- 三维可视化展示（Three.js）
- 实时传感器数据接收与存储（InfluxDB）
- 告警系统（MQTT推送）

## 系统架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  传感器模拟器   │────▶│  FastAPI 后端   │────▶│   InfluxDB      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ├───────────────▶│   MQTT Broker   │
                               │
                          ┌────▼────┐
                          │ 前端    │
                          │ Three.js│
                          └─────────┘
```

## 目录结构

```
.
├── backend/                # 后端代码
│   ├── main.py            # FastAPI主程序
│   ├── steering_model.py  # 转向机构仿真模型
│   ├── stability_analysis.py  # 稳定性分析模块
│   ├── alert_manager.py   # 告警管理模块
│   └── requirements.txt   # Python依赖
├── frontend/              # 前端代码
│   ├── index.html         # 主页面
│   ├── style.css          # 样式文件
│   └── app.js             # 主应用脚本（Three.js）
├── scripts/               # 工具脚本
│   ├── init_influxdb.py   # InfluxDB初始化脚本
│   └── sensor_simulator.py  # 传感器模拟器
├── config/                # 配置文件
│   └── settings.py        # 系统配置
└── README.md
```

## 核心功能

### 1. 转向机构仿真模型
- 基于阿克曼转向几何计算内外轮转角
- 多体动力学连杆运动学分析
- 转向半径和内侧轮差计算
- 车轮轨迹生成

### 2. 操控稳定性分析
- 侧倾中心高度计算
- 横摆角速度估算
- 侧翻风险评估（SSF静态稳定系数）
- 稳定性指数计算
- 临界速度分析

### 3. 告警系统
- 侧倾角超过20°触发预警
- 滑移率异常（<0.05 或 >0.8）触发预警
- MQTT实时推送
- 告警冷却机制

### 4. 三维可视化
- Three.js双辕车三维模型
- 转向机构连杆动画
- 车轮轨迹动态线条
- 多视角切换（3D/俯视/侧视）

## 快速开始

### 环境要求
- Python 3.8+
- Node.js (可选，用于本地静态文件服务)
- InfluxDB 2.x
- MQTT Broker (可选，如 Mosquitto)

### 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 启动步骤

#### 1. 启动 InfluxDB

确保 InfluxDB 服务已启动，默认地址：http://localhost:8086

#### 2. 初始化 InfluxDB

```bash
python scripts/init_influxdb.py
```

#### 3. 启动 MQTT Broker（可选）

如使用 Mosquitto：
```bash
mosquitto -p 1883
```

#### 4. 启动后端服务

```bash
cd backend
python main.py
```

或使用 uvicorn：
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### 5. 启动传感器模拟器

```bash
python scripts/sensor_simulator.py
```

#### 6. 访问前端

打开浏览器访问：
```
http://localhost:8000/frontend/index.html
```

或直接打开 `frontend/index.html` 文件。

## API 接口

### 传感器数据接口
- `POST /api/sensor/data` - 接收传感器数据
- `GET /api/data/history?vehicle_id=xxx&hours=1` - 获取历史数据

### 转向分析接口
- `POST /api/analysis/steering` - 转向机构分析
- `POST /api/analysis/trajectory` - 车轮轨迹计算
- `GET /api/analysis/linkage?pole_angle=0` - 连杆位置

### 稳定性分析接口
- `POST /api/analysis/stability` - 稳定性分析

### 告警接口
- `GET /api/alerts` - 获取告警列表
- `GET /api/alerts/stats` - 告警统计

### 系统接口
- `GET /api/vehicles` - 获取车辆列表
- `GET /api/system/params` - 获取系统参数
- `WebSocket /ws/realtime` - 实时数据推送

## 传感器数据格式

```json
{
  "vehicle_id": "chariot-qin-001",
  "pole_angle": 15.5,
  "slip_rate": 0.12,
  "roll_angle": 8.3,
  "friction_coeff": 0.65,
  "timestamp": 1703123456
}
```

字段说明：
- `vehicle_id`: 车辆ID
- `pole_angle`: 辕杆转角（度）
- `slip_rate`: 车轮滑移率（0-1）
- `roll_angle`: 车身侧倾角（度）
- `friction_coeff`: 路面摩擦系数
- `timestamp`: 时间戳（秒）

## 配置说明

编辑 `config/settings.py` 修改系统配置：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| INFLUXDB_URL | http://localhost:8086 | InfluxDB地址 |
| INFLUXDB_TOKEN | my-token | InfluxDB令牌 |
| INFLUXDB_ORG | transport-history | 组织名 |
| INFLUXDB_BUCKET | chariot-sensors | 数据桶 |
| MQTT_BROKER | localhost | MQTT服务器 |
| MQTT_PORT | 1883 | MQTT端口 |
| ALERT_ROLL_ANGLE_THRESHOLD | 20.0 | 侧倾角告警阈值（度） |
| ALERT_SLIP_RATE_LOW | 0.05 | 滑移率下限 |
| ALERT_SLIP_RATE_HIGH | 0.8 | 滑移率上限 |
| CHARIOT_WHEELBASE | 2.5 | 轴距（米） |
| CHARIOT_TRACK_WIDTH | 1.8 | 轮距（米） |

## 技术栈

**后端：**
- FastAPI - Web框架
- InfluxDB - 时序数据库
- Paho MQTT - MQTT客户端
- NumPy - 数值计算

**前端：**
- Three.js - 3D渲染
- Canvas 2D - 转向机构示意图
- WebSocket - 实时通信

## 注意事项

1. InfluxDB 和 MQTT 为可选依赖，系统在缺少时仍可正常运行核心功能
2. 传感器模拟器默认每60秒上报一次数据，可按需调整
3. 告警有5分钟冷却时间，避免重复告警
4. 前端使用 CDN 加载 Three.js，需确保网络连接正常

## 开发团队

交通史研究团队 · 秦汉双辕车复原研究项目

