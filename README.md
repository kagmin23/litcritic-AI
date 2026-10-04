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

Mở **Supabase > SQL Editor** và chạy lần lượt:

1. `supabase/schema.sql` — 4 bảng dữ liệu (students, texts, debate_sessions, interaction_logs).
2. `supabase/auth-schema.sql` — bảng `profiles` (có `username`, `role`, `status`), trigger tự tạo profile khi đăng ký, RLS.
3. `supabase/analytics-schema.sql` — bảng `access_logs` (lượt đăng nhập) + RLS.
4. `supabase/seed-admin.sql` — tạo sẵn tài khoản **admin** (xem bên dưới).

### Bật Realtime (cho tính năng Online)

Để đếm số người **đang online** và số người trong 1 phiên tranh luận:
- Vào **Realtime** (hoặc Project Settings → Realtime) và đảm bảo Realtime được
  bật cho project (mặc định đã bật). Tính năng online dùng **Presence** nên
  **không cần** bật replication cho bảng nào.
- Nếu Realtime chưa bật, phần "online" hiển thị 0 nhưng app vẫn chạy bình thường.

### Bật đăng nhập (Supabase Auth) — ĐĂNG NHẬP BẰNG USERNAME

Hệ thống dùng **username** thay vì email. Về mặt kỹ thuật, username được ánh xạ
nội bộ sang email ẩn `<username>@litcritic.local` để nạp vào Supabase Auth.

1. **Authentication > Providers > Email**: bật **Email** và **TẮT** *"Confirm
   email"* (vì email là ẩn danh, không có hộp thư thật để xác nhận).
2. Không cần cấu hình Redirect URL (đã bỏ luồng quên/đặt lại mật khẩu qua email).

### Tài khoản Admin (có sẵn, không cần đăng ký)

Sau khi chạy `supabase/seed-admin.sql`:

| | |
|---|---|
| Tên đăng nhập | `admin` |
| Mật khẩu | `123123` |

Đăng nhập admin qua nút **"Đăng nhập Quản trị"** ở góc trên phải trang đăng nhập
(trang login riêng, giao diện tối). Trang này chỉ chấp nhận tài khoản role
`admin`; tài khoản khác bị từ chối.

### Phân quyền (role) & duyệt giáo viên

| Role | Quyền |
|------|-------|
| `student` | Dashboard, tạo/phân tích ngữ liệu, tranh luận, xem báo cáo — kích hoạt ngay |
| `teacher` | Như student + **Nghiên cứu ViSEF** (xem phiên, logs, xuất CSV, số học sinh online) — **phải được admin phê duyệt** |
| `admin` | **Chỉ** quản trị: **Quản lý người dùng** (duyệt/thu hồi giáo viên, danh sách tài khoản) + **Thống kê truy cập** (biểu đồ lượt đăng nhập theo ngày/giờ, số người online realtime). Admin KHÔNG làm nghiệp vụ nội dung. |

**Tính năng Online (realtime):**
- Admin: xem tổng số người online + danh sách, tách theo vai trò, trong trang Thống kê truy cập.
- Teacher: xem số **học sinh đang online** và số **người tham gia** mỗi phiên trong trang Nghiên cứu.
- Trong phòng tranh luận: hiển thị số người **đang mở** phiên đó ("đang xem").

Luồng giáo viên:
1. Giáo viên đăng ký → vào thẳng app nhưng ở trạng thái **"Chờ phê duyệt"**,
   mọi tính năng bị **khóa** (banner nhắc + nút disable).
2. Admin vào **Nghiên cứu ViSEF > Phê duyệt giáo viên**, bấm **Phê duyệt** hoặc
   **Từ chối**.
3. Sau khi được duyệt, giáo viên **tải lại trang** là mở khóa đầy đủ tính năng.

> Không có thông báo qua email (tài khoản dùng username, email ẩn danh).

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
├── App.tsx                    # Gate route theo auth + role, chuyển cảnh
├── main.tsx
└── @/                         # alias "@" trỏ tới thư mục này
    ├── components/
    │   ├── ui/                # shadcn components
    │   ├── AppShell.tsx       # Sidebar + topbar dùng chung (sau đăng nhập)
    │   ├── AuthProvider.tsx   # Context phiên đăng nhập + role + status
    │   ├── AuthLayout.tsx     # Bố cục 2 cột cho trang auth
    │   ├── PendingBanner.tsx  # Banner "chờ phê duyệt" cho giáo viên
    │   ├── AuroraBackground.tsx
    │   ├── ArgumentGraph.tsx
    │   ├── RadarChartAssessment.tsx
    │   └── RoundtableChat.tsx
    ├── lib/
    │   ├── supabaseClient.ts
    │   ├── authContext.ts     # useAuth, ROLE_LABEL
    │   ├── navigation.ts      # Route union + useNav
    │   ├── motion.ts          # variants framer-motion dùng chung
    │   ├── agents.ts          # metadata 5 agent + scaffolding + trọng số
    │   ├── scoring.ts         # tính S_critical
    │   └── csv.ts             # xuất CSV ViSEF
    ├── services/
    │   ├── authService.ts     # Supabase Auth theo username + duyệt teacher
    │   ├── geminiService.ts   # analyzeUnseenText + generateMultiAgentResponse
    │   └── supabaseService.ts # CRUD + fallback localStorage
    ├── types/index.ts         # + UserRole, AccountStatus, Profile, AuthUser
    └── pages/
        ├── LoginPage.tsx · RegisterPage.tsx · AdminLoginPage.tsx
        ├── DashboardPage · TextInputPage · DebateArenaPage · AssessmentReportPage
        ├── AdminResearchPage      # Nghiên cứu ViSEF (teacher)
        ├── UserManagementPage     # Quản lý người dùng (admin)
        └── AdminAnalyticsPage     # Thống kê truy cập + online (admin)
```

> Database: `supabase/schema.sql` (dữ liệu) + `supabase/auth-schema.sql`
> (auth/role/status) + `supabase/seed-admin.sql` (tài khoản admin).

## Lệnh

```bash
npm run dev      # chạy dev server
npm run build    # tsc -b && vite build
npm run lint     # eslint
npm run preview  # xem bản build
```
