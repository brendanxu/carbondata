# MCP Carbon Data Collector

自动化碳市场数据采集系统，基于 MCP (Model Context Protocol) 架构。

## 功能特性

- **多市场支持**: CEA、CCER、CARB、CDR 等主要碳市场
- **自动化采集**: 定时抓取和实时数据更新
- **质量保障**: 数据验证、重试机制、证据保存
- **健康监控**: 实时监控数据源状态和采集质量

## 支持的市场

| 市场 | 代码 | 数据源 | 更新频率 | 状态 |
|------|------|--------|----------|------|
| 中国全国碳市场 | CEA | 上海环境能源交易所 | 工作日 17:30 | ✅ |
| 中国核证减排 | CCER | 广州碳排放权交易所 | 工作日 17:45 | ✅ |
| 加州碳市场 | CCA | CARB CSV/API | 工作日 16:00 | ✅ |
| 碳移除信贷 | CDR | CDR.fyi API | 每日 01:00 | ✅ |

## 快速开始

### 安装依赖

```bash
cd apps/mcp
npm install
```

### 构建项目

```bash
npm run build
```

### 运行调度器

```bash
# 启动定时任务调度器
npm start

# 开发模式
npm run dev

# 立即执行所有任务
npm run run-all

# 检查状态
npm run status
```

### 测试适配器

```bash
# 测试CEA适配器
npm run test-cea

# 测试CCER适配器  
npm run test-ccer

# 测试CARB适配器
npm run test-carb

# 测试CDR适配器
npm run test-cdr
```

## 架构设计

### 核心组件

```
src/
├── adapters/           # 市场数据适配器
│   ├── cea-cneeex.ts   # CEA全国碳市场
│   ├── ccer-official.ts # CCER核证减排
│   ├── carb-csv.ts     # 加州CARB CSV
│   └── cdr-fyi.ts      # CDR.fyi API
├── scheduler/          # 任务调度器
│   └── task-scheduler.ts
├── types/              # 类型定义
│   ├── adapter.ts      # 适配器接口
│   └── price-record.ts # 数据记录类型
├── utils/              # 工具类
│   ├── quality-checker.ts   # 数据质量检查
│   └── evidence-collector.ts # 证据收集
└── index.ts            # 主入口
```

### 适配器接口

每个市场适配器实现 `MCPAdapter` 接口：

```typescript
interface MCPAdapter {
  name: string
  marketCode: string
  currency: string
  
  collectData(date?: Date): Promise<{
    data: PriceRecord[]
    evidence: any[]
  }>
  
  validateData(records: PriceRecord[]): Promise<ValidationResult>
  
  getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    message: string
  }>
}
```

### 数据流程

1. **定时触发**: cron调度器按市场时区触发
2. **数据采集**: 适配器抓取官方数据源
3. **质量验证**: 价格范围、变化率、完整性检查
4. **证据保存**: 截图、原始数据、元数据记录
5. **数据提交**: CSV格式提交到主应用API
6. **结果记录**: 执行历史和错误日志

### 质量控制

- **价格范围验证**: 每个市场设定合理价格区间
- **变化率检查**: 日间价格变化超过阈值触发告警
- **数据完整性**: 必填字段验证和格式检查
- **重试机制**: 失败任务自动重试，递增延迟
- **证据收集**: 保存页面截图和原始数据

### 错误处理

- **网络超时**: 15秒超时，自动重试3次
- **数据解析失败**: 记录错误，继续处理其他记录
- **质量检查失败**: 警告日志，低质量数据跳过
- **API提交失败**: 本地缓存，稍后重试

## 配置说明

### 调度时间

- **CEA**: 北京时间 17:30 (工作日)
- **CCER**: 北京时间 17:45 (工作日)  
- **CARB**: 加州时间 16:00 (工作日)
- **CDR**: 每日 UTC 01:00

### 数据源配置

适配器会自动处理不同数据源的格式差异：

- **HTML表格**: 使用Playwright解析动态网页
- **CSV文件**: 支持多种列名和日期格式
- **JSON API**: RESTful API集成
- **混合源**: 组合多个数据源提高可靠性

## 监控与告警

### 健康检查

系统提供多层次健康检查：

```bash
# 检查调度器和所有适配器状态
npm run status
```

返回示例：

```json
{
  "scheduler": "healthy",
  "tasks": {
    "cea-daily": { "status": "healthy", "message": "CEA data source accessible" },
    "ccer-daily": { "status": "degraded", "message": "Primary source slow response" },
    "carb-daily": { "status": "healthy", "message": "CARB CSV sources accessible" },
    "cdr-daily": { "status": "healthy", "message": "CDR.fyi API responding" }
  }
}
```

### 执行历史

```bash
# 查看最近执行历史
npm run history
```

### 告警机制

- **数据源不可用**: 连续3次失败触发告警
- **数据质量异常**: 质量分数低于60分
- **价格波动异常**: 单日变化超过设定阈值
- **采集超时**: 执行时间超过5分钟

## 部署说明

### Docker部署

```bash
# 构建镜像
docker build -t carbondata-mcp .

# 运行容器
docker run -d --name mcp-collector \
  -e DATABASE_URL="your-database-url" \
  -e API_ENDPOINT="http://localhost:3000" \
  carbondata-mcp
```

### 环境变量

```bash
DATABASE_URL=postgresql://user:pass@host:5432/carbondata
API_ENDPOINT=http://localhost:3000
LOG_LEVEL=info
RETRY_COUNT=3
TIMEOUT_MS=15000
```

### 生产环境

建议配置：

- **资源限制**: 内存512MB，CPU 0.5核
- **网络超时**: 15秒连接，30秒读取
- **重试策略**: 3次重试，指数退避
- **日志级别**: INFO，错误级别SENTRY

## 故障排除

### 常见问题

1. **网络连接失败**
   - 检查防火墙和代理设置
   - 验证数据源URL可访问性

2. **数据解析错误**
   - 检查网页结构是否变化
   - 验证CSS选择器是否正确

3. **质量检查失败**
   - 查看具体错误信息
   - 调整质量阈值配置

4. **API提交失败**
   - 检查主应用API状态
   - 验证数据格式正确性

### 调试命令

```bash
# 测试单个适配器
npm run test-adapter cea

# 查看详细日志
npm run dev

# 手动执行特定任务
npm run mcp run cea-daily
```

## 开发指南

### 添加新适配器

1. 创建适配器类实现 `MCPAdapter` 接口
2. 在 `TaskScheduler` 中注册新适配器
3. 配置适当的调度时间
4. 添加对应的测试命令

### 数据质量标准

- **价格范围**: 基于历史数据设定合理区间
- **变化率**: 单日涨跌幅不超过20-30%
- **完整性**: 必填字段不能为空
- **一致性**: 同一日期同一市场不能有重复记录

### 错误处理最佳实践

- 使用结构化错误记录
- 保留原始数据用于调试
- 实现优雅降级策略
- 记录详细的执行日志

## API集成

MCP收集器通过标准CSV导入API与主应用集成：

```bash
POST /api/import
Content-Type: multipart/form-data

file: CSV文件
source: "MCP Automation"
```

返回格式：

```json
{
  "success": true,
  "imported": 10,
  "skipped": 2,
  "errors": []
}
```