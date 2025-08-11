import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { QAStatus } from '@prisma/client'

// POST /api/admin/prices/[id]/reject - 审核拒绝价格数据
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json().catch(() => ({}))
    const reason = body.reason || '数据质量不符合要求'
    
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
    
    // 更新状态为已拒绝
    const updatedRecord = await prisma.dailyPrice.update({
      where: { id },
      data: {
        qaStatus: QAStatus.REJECTED,
        notes: priceRecord.notes ? `${priceRecord.notes}; 拒绝原因: ${reason}` : `拒绝原因: ${reason}`,
        updatedAt: new Date()
      }
    })
    
    // 记录审计日志
    await prisma.auditLog.create({
      data: {
        entity: 'DailyPrice',
        entityId: id,
        action: 'REJECT',
        actor: 'admin', // TODO: 从认证系统获取实际用户
        metadata: {
          previousStatus: priceRecord.qaStatus,
          newStatus: QAStatus.REJECTED,
          reason: reason
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      data: {
        id: updatedRecord.id,
        qaStatus: updatedRecord.qaStatus,
        updatedAt: updatedRecord.updatedAt,
        reason: reason
      }
    })
    
  } catch (error) {
    console.error('Error rejecting price record:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to reject record' },
      { status: 500 }
    )
  }
}