import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { QAStatus } from '@prisma/client'

// POST /api/admin/prices/[id]/approve - 审核通过价格数据
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    // 查找记录
    const priceRecord = await prisma.dailyPrice.findUnique({
      where: { id }
    })
    
    if (!priceRecord) {
      return NextResponse.json(
        { success: false, error: 'Price record not found' },
        { status: 404 }
      )
    }
    
    // 更新状态为已审核
    const updatedRecord = await prisma.dailyPrice.update({
      where: { id },
      data: {
        qaStatus: QAStatus.APPROVED,
        updatedAt: new Date()
      }
    })
    
    // 记录审计日志
    await prisma.auditLog.create({
      data: {
        entity: 'DailyPrice',
        entityId: id,
        action: 'APPROVE',
        actor: 'admin', // TODO: 从认证系统获取实际用户
        metadata: {
          previousStatus: priceRecord.qaStatus,
          newStatus: QAStatus.APPROVED
        }
      }
    })
    
    // 触发衍生指标重新计算
    // TODO: 实现衍生指标计算逻辑
    
    return NextResponse.json({
      success: true,
      data: {
        id: updatedRecord.id,
        qaStatus: updatedRecord.qaStatus,
        updatedAt: updatedRecord.updatedAt
      }
    })
    
  } catch (error) {
    console.error('Error approving price record:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to approve record' },
      { status: 500 }
    )
  }
}