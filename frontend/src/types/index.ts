export interface RunStatus {
  run_id: string
  status: string
  stage_checkpoint?: string
  research_question: string
  target_records: number
  collected_count: number
  classified_count: number
  error_message?: string
  started_at?: string
  completed_at?: string
  resumable?: boolean
}
