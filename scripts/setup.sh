#!/bin/bash

echo "🚀 开始初始化碳资产交易数据平台..."

# 检查Node.js版本
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装，请先安装Node.js 18+"
    exit 1
fi

# 检查npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm未安装"
    exit 1
fi

echo "✅ Node.js环境检查通过"

# 安装依赖
echo "📦 安装项目依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 依赖安装完成"

# 检查环境变量文件
if [ ! -f ".env.local" ]; then
    echo "📋 创建环境变量文件..."
    cp .env.example .env.local
    echo "⚠️  请编辑 .env.local 文件，配置数据库连接"
    echo "   DATABASE_URL=\"postgresql://user:password@localhost:5432/carbondata\""
fi

# 生成Prisma客户端
echo "🔧 生成Prisma客户端..."
npm run db:generate

if [ $? -ne 0 ]; then
    echo "❌ Prisma客户端生成失败"
    exit 1
fi

echo "✅ Prisma客户端生成完成"

echo ""
echo "🎉 项目初始化完成！"
echo ""
echo "接下来的步骤："
echo "1. 配置数据库连接（编辑 .env.local）"
echo "2. 推送数据库结构: npm run db:push"
echo "3. 运行种子数据: npm run db:seed"
echo "4. 启动开发服务器: npm run dev"
echo ""
echo "访问地址："
echo "- 前端: http://localhost:3000"
echo "- 管理后台: http://localhost:3000/admin"
echo "- Prisma Studio: npm run db:studio"
echo ""
echo "📚 更多信息请查看 README.md"