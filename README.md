# 铸造产线数字孪生系统

基于 Three.js / WebGL2 的铸造产线数字孪生与设备监控工作台。

## 在线演示

https://kezhenyu-ai.github.io/casting-line-digital-twin/

项目包含厂房三维场景、铸造工艺链路、设备状态看板、排放监测、能源计量、模型导入工作台和引擎光影设置。

## 技术栈

- Three.js 0.180
- WebGL2
- Vite 7
- 原生 JavaScript / CSS
- GLTFLoader / DRACOLoader / FBXLoader
- AnimationMixer
- IndexedDB

## 启动

需要 Node.js 20+。

```bash
npm install
npm run dev
```

开发地址：

```text
http://127.0.0.1:5180/
```

生产构建：

```bash
npm run build
npm run preview
```

## 主要功能

- 铸造产线三维数字孪生场景
- 浇筑、造型、砂处理等工艺链路
- 设备状态、功率、负载率、温度、振动等运行数据
- 设备点击聚焦与选中光环
- 右侧设备列表详情抽屉
- 引擎光影参数实时调节
- 引擎参数保存为默认
- GLB / FBX 模型导入
- FBX 外部贴图多选支持
- 导入项目保存到 IndexedDB
- 最近导入项目重新打开
- 场景标签显示 / 隐藏
- 第一人称漫游
- 视频监控墙
- 排放监测、能源计量、运行日志和 AI 运营助手界面

## 模型

默认模型：

```text
public/models/shape-line-20260617.glb
```

模型由 Blender 导出，包含厂房1造型线场景、设备层级、材质和动画。

模型通过 object 自定义属性 `equipmentId` 进行设备识别。

## 目录

```text
src/                前端源码
src/scene/          三维场景、模型加载、相机和漫游
src/import/         GLB / FBX 模型导入
src/data/           模拟数据
server/             本地开发 API：认证、AI、项目
public/models/      默认 GLB 模型
public/draco/       Draco 解码器
index.html          页面入口
vite.config.js      Vite 配置
```

## 模型导入

1. 打开页面
2. 点击右上角“导入模型”
3. 选择 GLB，或选择 FBX 及其外部贴图
4. 填写项目名称
5. 点击“导入并加载”

GLB 会把纹理、层级和动画一起加载。FBX 支持同时选择 PNG、JPG、JPEG、WEBP 外部贴图。

导入后的项目会保存到浏览器 IndexedDB，刷新后可从“最近项目”重新打开。

## 说明

当前设备运行数据、排放数据、能源数据和告警均为演示模拟数据，不代表真实工厂运行状态。

项目用于数字孪生界面和模型导入流程的开发验证。接入真实生产系统时，需要替换为实际的 OPC UA、MES、能源或设备 API。

## 目录中的本地文件

以下内容不进入 Git：

- `node_modules/`
- `dist/`
- 本地日志
- 本地模型源文件
- 视频和临时截图
