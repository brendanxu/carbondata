# 碳资产交易数据平台

全球碳市场每日价格数据展示与分析平台，涵盖EU ETS、UK ETS、California、中国碳市场、CCER、CDR等主要市场。

## 功能特性

### 一期已完成功能
- ✅ 多市场数据展示（EU ETS、UK ETS、California、中国碳市场、CCER、CDR）
- ✅ CSV数据导入与验证
- ✅ 价格数据查询API
- ✅ 数据导出功能（CSV/JSON）
- ✅ 市场总览页面
- ✅ 市场详情页面（含价格走势图）
- ✅ 数据质量校验（阈值检测、单位验证）
- ✅ 审计日志记录

### 待开发功能
- ⏳ 数据对比页面
- ⏳ 管理后台（Directus集成）
- ⏳ MCP自动化数据采集
- ⏳ Sentry监控集成
- ⏳ 多语言支持
- ⏳ 小程序端

## 技术栈

- **前端框架**: Next.js 15 (App Router)
- **UI库**: TailwindCSS
- **图表**: Apache ECharts
- **数据库**: PostgreSQL (Prisma ORM)
- **语言**: TypeScript
- **部署**: Vercel + Cloudflare CDN

## 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone [repository-url]
cd carbondata

# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env.local
```

### 2. 数据库配置

```bash
# 生成Prisma客户端
npm run db:generate

# 推送数据库结构（需要先配置DATABASE_URL）
npm run db:push

# 运行种子数据（可选）
npm run db:seed
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 查看应用

## API接口文档

### 价格查询
```
GET /api/prices
参数:
  - marketCode: EU|UK|CCA|CEA|CCER|CDR
  - instrumentCode: 标的代码
  - startDate: YYYY-MM-DD
  - endDate: YYYY-MM-DD
  - page: 页码
  - pageSize: 每页数量
```

### 数据导出
```
GET /api/prices/export
参数:
  - format: csv|json
  - 其他参数同价格查询
```

### 数据导入
```
POST /api/import
Body: FormData
  - file: CSV文件
  - importedBy: 导入者
```

### 市场汇总
```
GET /api/summary
返回所有市场的最新价格和统计数据
```

## CSV导入模板

CSV文件应包含以下列：
- market_code: 市场代码（EU/UK/CCA/CEA/CCER/CDR）
- instrument_code: 标的代码
- date: 日期（YYYY-MM-DD）
- price: 价格
- price_type: 价格类型（SETTLEMENT/CLOSE/MID）
- currency: 货币（EUR/GBP/USD/CNY）
- unit: 单位（tCO2e）
- volume: 成交量（可选）
- venue_name: 交易场所（可选）
- source_url: 数据来源URL（可选）

## 数据质量规则

- 价格变动超过20%会触发警告
- 日期不能为未来日期
- 市场与货币必须匹配（EU->EUR, UK->GBP等）
- 成交量异常检测（0或>1M tCO2e）

## 部署指南

### Vercel部署

1. 连接GitHub仓库到Vercel
2. 配置环境变量
3. 部署

### 数据库选择

推荐使用Supabase或AWS RDS PostgreSQL

### CDN配置

使用Cloudflare进行全球加速和DDoS防护

## 项目结构

```
carbondata/
├── src/
│   ├── app/              # Next.js App Router页面
│   │   ├── api/          # API路由
│   │   └── markets/      # 市场详情页
│   ├── components/       # React组件
│   └── lib/              # 工具库和验证器
├── prisma/               # 数据库模型和迁移
├── public/               # 静态资源
└── package.json          # 项目配置
```

## 开发指南

### 添加新市场

1. 更新`prisma/schema.prisma`中的市场代码
2. 添加对应的验证规则到`src/lib/validators/price-data.ts`
3. 更新前端导航和市场信息

### 数据采集MCP配置

详见`apps/mcp/README.md`（二期开发）

## 许可证

本项目仅供内部使用，数据仅供参考，不构成投资建议。

## 联系方式

如有问题请联系技术团队。