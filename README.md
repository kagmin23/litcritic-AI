# ViSEF · Hệ thống Web AI Multi-Agent — Tư duy Phản biện trong Đọc hiểu Ngữ văn

Hệ thống hỗ trợ nghiên cứu khoa học kỹ thuật **ViSEF**: *Đánh giá & Phát triển
Tư duy Phản biện trong Đọc hiểu Ngữ văn*, bám sát Chương trình GDPT 2018. Học
sinh tranh luận bàn tròn cùng **4 nhà phê bình AI** dưới sự điều phối của một
**Trọng tài**, từ đó đo lường chỉ số tư duy phản biện mở `S_critical`.

## Công nghệ

- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui (radix-nova)
- lucide-react (icons)
- Supabase (`@supabase/supabase-js`)
- Google Gemini 1.5 Flash (`@google/genai`) — API key FREE
- `@xyflow/react` (sơ đồ cây lập luận) · `recharts` (biểu đồ tơ nhện)
- `papaparse` (xuất CSV)

## 5 Phân hệ

1. **Tiếp nhận & Phân tích Ngữ liệu** — `TextInputPage` (OCR ảnh, bóc tách thể
   loại / từ khó / bối cảnh / câu hỏi định hướng).
2. **Khởi tạo & Điều phối Multi-Agent** — 4 Critic Agents (Cấu trúc luận · Tâm
   lý học · Xã hội - Lịch sử · Nữ quyền/Văn hóa) + 1 Moderator.
3. **Đấu trường Tranh luận** — `DebateArenaPage`: Roundtable Chat + Sơ đồ cây
   lập luận động + Scaffolding mẫu câu + chú thích từ khó bằng Tooltip.
4. **Chẩn đoán & Đánh giá** — `AssessmentReportPage`: tính `S_critical`, vẽ
   Radar Chart 5 tiêu chí GDPT 2018, liệt kê lỗi ngụy biện + lời khuyên.
5. **Quản trị & Xuất Dữ liệu** — `AdminResearchPage`: bảng phiên học, xem logs
   chi tiết, xuất CSV (theo lượt & tổng hợp theo phiên) cho SPSS / Python.

## Cài đặt

```bash
npm install
cp .env.example .env   # rồi điền API key
npm run dev
```

### Biến môi trường (`.env`)

| Biến | Mô tả | Lấy ở đâu |
|------|-------|-----------|
| `VITE_GEMINI_API_KEY` | API key Gemini (FREE) | https://aistudio.google.com/app/apikey |
| `VITE_SUPABASE_URL` | Project URL | Supabase > Project Settings > API |
| `VITE_SUPABASE_ANON_KEY` | anon public key | Supabase > Project Settings > API |

> Nếu chưa cấu hình Supabase, ứng dụng tự động chạy **chế độ demo** — dữ liệu
> lưu tạm trong `localStorage` trình duyệt để trải nghiệm đầy đủ luồng.

### Khởi tạo Database

Mở **Supabase > SQL Editor**, dán toàn bộ nội dung `supabase/schema.sql` và chạy.

## Công thức S_critical

```
S = w1·D_perspective + w2·E_validity + w3·C_openness − w4·F_fallacy
    (w1 = w2 = w3 = 0.3 ; w4 = 0.5)  → chuẩn hóa thang 100
```

- `D_perspective` — Đa dạng góc nhìn
- `E_validity` — Tính thuyết phục của dẫn chứng
- `C_openness` — Độ cởi mở phản biện
- `F_fallacy` — Số lỗi ngụy biện (trừ điểm)

Radar Chart đánh giá 5 tiêu chí GDPT 2018: Đa dạng góc nhìn · Dẫn chứng · Cởi mở
phản biện · Logic lập luận · Sáng tạo đọc hiểu.

## Cấu trúc thư mục

```
src/
├── App.tsx                    # Điều hướng 5 pages (state navigation)
├── main.tsx
└── @/                         # alias "@" trỏ tới thư mục này
    ├── components/
    │   ├── ui/                # shadcn components
    │   ├── ArgumentGraph.tsx
    │   ├── RadarChartAssessment.tsx
    │   └── RoundtableChat.tsx
    ├── lib/
    │   ├── supabaseClient.ts
    │   ├── agents.ts          # metadata 5 agent + scaffolding + trọng số
    │   ├── scoring.ts         # tính S_critical
    │   ├── csv.ts             # xuất CSV ViSEF
    │   └── navigation.ts
    ├── services/
    │   ├── geminiService.ts   # analyzeUnseenText + generateMultiAgentResponse
    │   └── supabaseService.ts # CRUD + fallback localStorage
    ├── types/index.ts
    └── pages/                 # 5 phân hệ
```

## Lệnh

```bash
npm run dev      # chạy dev server
npm run build    # tsc -b && vite build
npm run lint     # eslint
npm run preview  # xem bản build
```
