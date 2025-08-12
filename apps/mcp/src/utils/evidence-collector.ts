export class EvidenceCollector {
  private evidence: any[] = []
  
  addEvidence(item: {
    source: string
    url?: string
    timestamp: string
    screenshot?: string
    data?: any
    success: boolean
    error?: string
  }) {
    this.evidence.push(item)
  }
  
  getEvidence(): any[] {
    return this.evidence
  }
  
  clearEvidence() {
    this.evidence = []
  }
  
  async saveScreenshot(page: any, sourceName: string): Promise<string | null> {
    try {
      const screenshot = await page.screenshot({ fullPage: true })
      const base64 = screenshot.toString('base64')
      
      this.addEvidence({
        source: sourceName,
        timestamp: new Date().toISOString(),
        screenshot: base64,
        success: true
      })
      
      return base64
    } catch (error) {
      this.addEvidence({
        source: sourceName,
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
      
      return null
    }
  }
  
  async saveAPIResponse(
    sourceName: string, 
    url: string, 
    response: any, 
    success: boolean
  ) {
    this.addEvidence({
      source: sourceName,
      url,
      timestamp: new Date().toISOString(),
      data: response,
      success
    })
  }
}