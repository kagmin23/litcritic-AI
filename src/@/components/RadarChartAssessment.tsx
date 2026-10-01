import { GDPT_CRITERIA } from '@/lib/agents'
import type { CriticalAssessment } from '@/types'
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface RadarChartAssessmentProps {
  assessment: CriticalAssessment
}

/**
 * Biểu đồ Tơ nhện (Radar Chart) đánh giá 5 tiêu chí GDPT 2018:
 * (1) Đa dạng góc nhìn, (2) Thuyết phục của dẫn chứng, (3) Cởi mở phản biện,
 * (4) Logic lập luận, (5) Sáng tạo đọc hiểu — thang 0-10.
 */
export function RadarChartAssessment({
  assessment,
}: RadarChartAssessmentProps) {
  const data = [
    { criterion: GDPT_CRITERIA[0], value: assessment.perspective_diversity },
    { criterion: GDPT_CRITERIA[1], value: assessment.evidence_validity },
    { criterion: GDPT_CRITERIA[2], value: assessment.openness },
    { criterion: GDPT_CRITERIA[3], value: assessment.reasoning_logic },
    { criterion: GDPT_CRITERIA[4], value: assessment.creativity },
  ]

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid />
          <PolarAngleAxis
            dataKey="criterion"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 10]}
            tick={{ fontSize: 10 }}
          />
          <Radar
            name="Điểm năng lực (0-10)"
            dataKey="value"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.45}
          />
          <Tooltip
            formatter={(value) => [`${value as number}/10`, 'Điểm']}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default RadarChartAssessment
