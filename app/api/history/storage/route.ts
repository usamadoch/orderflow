import { NextResponse } from 'next/server'
import { deleteStorageDays, getStorageSummary } from '../../../../lib/services/storageService'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const summary = await getStorageSummary()
    return NextResponse.json(summary)
  } catch (error: unknown) {
    console.error('Failed to get storage summary:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { dates } = await request.json()
    if (!Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ error: 'dates array is required' }, { status: 400 })
    }

    const totalDeleted = await deleteStorageDays(dates)
    return NextResponse.json({ success: true, deletedCount: totalDeleted })
  } catch (error: unknown) {
    console.error('Failed to delete storage data:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
