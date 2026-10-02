# PARADoNext — Ứng Dụng Quản Lý Công Việc theo PARA cho Người ADHD

## 1. Tổng Quan Dự Án

**PARADoNext** là ứng dụng quản lý công việc cá nhân được xây dựng theo phương pháp **PARA**, tối ưu hóa cho người dùng có ADHD, có tích hợp **trợ lý AI** để giảm tải quyết định (decision fatigue).

Tên gọi *PARADoNext* ghép trực tiếp hai nửa của triết lý sản phẩm: **PARA** (tổ chức thông tin) + **Do Next** (làm việc tiếp theo) — nói thẳng ra ngay trong tên rằng đây không chỉ là công cụ sắp xếp, mà luôn kết thúc bằng một hành động cụ thể cần làm ngay.

Ứng dụng này **không phải** là công cụ SEO.

Ý tưởng cốt lõi:

> PARA tổ chức thông tin. PARADoNext giúp người dùng quyết định nên làm gì và thực sự bắt tay vào làm — với sự hỗ trợ của AI ở những bước dễ gây "đứng hình" nhất.

Hệ thống được thiết kế để giảm thiểu quá tải nhận thức, giảm số lượng quyết định cần thiết để bắt đầu một việc, và giúp việc capture — tổ chức — thực thi — hoàn thành diễn ra mượt mà.

Phiên bản đầu tiên là ứng dụng web responsive / PWA. Kiến trúc cần phù hợp để mở rộng sang desktop app và mobile app trong tương lai.

---

## 2. Bản Sắc Thương Hiệu & Giao Diện

### 2.1. Ý nghĩa tên gọi
- **PARADoNext** = **PARA** (tổ chức) + **Do Next** (làm việc tiếp theo) — tên tự giải thích nguyên tắc cốt lõi: "PARA là hệ thống tổ chức, NOW là hệ thống thực thi".
- Logo: ô vuông màu cam với mũi tên → ("việc tiếp theo"). Chữ "Do" trong wordmark tô màu nhấn.

### 2.2. Nguyên tắc thiết kế
- **Bình tĩnh, ít nhiễu:** nền trung tính ấm, gần như không dùng màu — để màu chỉ xuất hiện khi mang ý nghĩa.
- **Một màu nhấn duy nhất (cam):** dành cho hành động chính và "việc tiếp theo". Mỗi màn hình chỉ nên có một thứ nổi bật nhất.
- **Màu có ngữ nghĩa:** đỏ = quá hạn/lỗi, xanh lá = hoàn thành. Không dùng màu cho trang trí.
- **Sáng/tối tự động** theo cài đặt hệ điều hành; mọi màu đi qua biến CSS nên không có chữ bị chìm ở chế độ nào.
- **Font:** Be Vietnam Pro (hiển thị tiếng Việt tốt).

### 2.3. Design tokens (`src/index.css`)

| Token (Tailwind class) | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `bg` | `#faf9f7` | `#121110` | Nền trang |
| `surface` / `surface-2` | `#ffffff` / `#f3f1ee` | `#1a1917` / `#242220` | Card, sidebar / hover, nền phụ |
| `line` / `line-strong` | `#e7e4df` / `#d6d2cb` | `#2e2b28` / `#423e39` | Viền |
| `fg` / `muted` / `subtle` | `#1c1917` / `#57534e` / `#8a847c` | `#f2efea` / `#b5afa6` / `#857f76` | Chữ chính / phụ / mờ |
| `accent` | `#e8590c` | `#ff7a33` | Hành động chính, "Do Next" |
| `success` | `#2b8a3e` | `#69db7c` | Hoàn thành |
| `danger` | `#e03131` | `#ff6b6b` | Quá hạn, lỗi |

Component dùng chung nằm ở `src/components/ui.tsx` (`Button`, `Input`, `Field`, `Card`, `Notice`, `PageHeader`). Trang mới nên dựng từ các component này thay vì tự viết class Tailwind, để giao diện luôn nhất quán.

---

## 3. Các Khái Niệm Cốt Lõi (PARA)

PARADoNext sử dụng bốn khái niệm PARA:

- **Projects (Dự án)** — việc có kết quả cụ thể và điểm kết thúc.
- **Areas (Lĩnh vực)** — trách nhiệm/lĩnh vực đời sống cần duy trì liên tục.
- **Resources (Tài nguyên)** — thông tin/tài liệu tham khảo có thể hữu ích sau này.
- **Archives (Lưu trữ)** — Projects, Areas, Resources không còn hoạt động, hoặc thông tin lịch sử khác.

Hai khái niệm vận hành quan trọng khác:

- **Inbox (Hộp thư đến)** — nơi capture tạm thời các ý nghĩ/thông tin chưa xử lý.
- **Now / Today (Bây giờ / Hôm nay)** — chế độ xem hướng thực thi, cho biết người dùng nên làm gì ngay.

Nguyên tắc quan trọng:

> PARA là hệ thống tổ chức. NOW là hệ thống thực thi. AI là cầu nối giữa hai hệ thống này.

---

## 4. Mục Tiêu Sản Phẩm

PARADoNext giúp người dùng:

1. Capture nhanh một ý nghĩ/việc cần làm.
2. Tổ chức nó mà không tốn nhiều công sức (AI hỗ trợ phân loại).
3. Thấy rõ hôm nay cần làm gì (AI gợi ý ưu tiên).
4. Bắt tay vào việc ngay lập tức.
5. Chia nhỏ việc quá tải thành các bước nhỏ (AI hỗ trợ breakdown).
6. Theo dõi thời gian dành cho từng việc.
7. Không bỏ sót việc dang dở.
8. Xem lại việc đã hoàn thành và chưa hoàn thành (AI tổng hợp review).
9. Giữ Projects, Areas, Resources, Archives tách biệt rõ ràng.
10. Duy trì mô hình tư duy đơn giản.

Tránh biến PARADoNext thành hệ thống quản lý dự án phức tạp.

---

## 5. Trợ Lý AI — Vai Trò & Tính Năng

AI trong PARADoNext không phải tính năng phụ — nó là **cầu nối** giúp giảm số quyết định người dùng ADHD phải tự đưa ra, vốn là nguyên nhân chính gây "đứng hình" (decision paralysis).

### 5.1. Xử lý Inbox tự động
Khi người dùng ném một ghi chú thô vào Inbox (vd: "gọi nha sĩ", "deadline báo cáo thứ 6"), AI sẽ:
- Phân loại: Task / Project / Resource?
- Gợi ý Project/Area phù hợp trong số đã có.
- Tách task mơ hồ thành hành động cụ thể (vd: "chuẩn bị sinh nhật mẹ" → "đặt bánh", "mua quà", "gọi mời khách").
- Gợi ý độ ưu tiên / ước lượng thời gian nếu người dùng chưa tự đặt.

Người dùng chỉ cần **duyệt** gợi ý (chấp nhận/sửa nhanh) — không tự nghĩ từ đầu.

### 5.2. Gợi ý "việc tiếp theo" trong Now/Today
AI chọn 1–3 việc nên làm ngay, dựa trên: deadline, năng lượng hiện tại (hỏi nhanh optional), thời gian rảnh, lịch sử hoàn thành việc tương tự.

### 5.3. Tự động chia nhỏ task lớn
AI nhận một task to (vd: "làm báo cáo quý") và đề xuất checklist bước nhỏ, có thể chỉnh sửa. Xuất hiện trong Task Detail view (xem mục 7).

### 5.4. Trợ lý trong chế độ Focus
Ô chat nhỏ trong Focus/Pomodoro mode để hỏi AI khi bí ý tưởng hoặc cần "nghĩ thành tiếng".

### 5.5. Review định kỳ tự động tổng hợp
Cuối tuần/tháng, AI viết tóm tắt: đã hoàn thành gì, việc nào bị trì hoãn nhiều lần (gợi ý chia nhỏ hơn hoặc bỏ), Area nào đang bị bỏ bê.

### 5.6. Nguyên tắc an toàn khi dùng AI
- **Luôn có bước duyệt** trước khi AI ghi đè hoặc tự sắp xếp dữ liệu — không tự động hóa hoàn toàn "hộp đen".
- AI trả về dữ liệu có cấu trúc (JSON qua function calling), không tự ý thực thi hành động phá hủy (xóa, archive hàng loạt) mà không xác nhận.

### 5.7. Triển khai kỹ thuật
- Dùng Claude API (function calling / structured output) tại: bước xử lý Inbox, bước gợi ý Today, bước breakdown task.
- Kết quả AI lưu vào Supabase như dữ liệu thông thường — không cần đổi kiến trúc backend.

---

## 6. Công Nghệ Sử Dụng

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS v4 (design tokens — xem mục 2.3)
- React Router
- TanStack Query
- React Hook Form
- Zod

### Backend / Database
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Row Level Security (RLS)

### AI
- Claude API (Anthropic) — function calling / structured JSON output

### Tùy chọn
- Zustand — quản lý state nhẹ phía client
- date-fns — xử lý ngày giờ
- Lucide React — icon

Backend nên được thiết kế để có thể thay thế/mở rộng bằng API riêng nếu cần sau này.

---

## 7. Cấu Trúc Ứng Dụng

```text
PARADoNext
│
├── NOW
│   ├── Today
│   ├── Quick Start       (AI gợi ý 1-3 việc nên làm ngay)
│   └── Focus             (Pomodoro + AI chat hỗ trợ)
│
├── INBOX                 (AI tự động phân loại khi xử lý)
│
├── TASKS
│   ├── Today
│   ├── Tomorrow
│   ├── This Week
│   ├── No Date
│   ├── Overdue
│   ├── Open Loops        (task chưa xong, không deadline — xem mục 8)
│   ├── Completed
│   └── All Tasks
│       ├── Saved Views: QUICK | EASY | LOW | PERSONAL | BY AREA | + (xem mục 8)
│       └── Task Detail   (AI breakdown subtask tại đây)
│
├── PROJECTS
│   ├── Active
│   ├── Favorites
│   ├── Completed
│   └── Archived
│
├── AREAS
│
├── RESOURCES
│
├── ARCHIVES
│
└── REVIEW                (AI tổng hợp định kỳ tuần/tháng)
```

---

## 8. Task Views & Saved Views

### 8.1. Nguyên tắc cốt lõi

> PARADoNext không tạo bảng dữ liệu riêng cho Today, Overdue, Quick, Easy, v.v. Một **Task View** là một cấu hình truy vấn (query) đã lưu, chạy trên cùng một tập dữ liệu `tasks`.

Nói cách khác: **chỉ có một nguồn dữ liệu thật** (`tasks`), còn mọi cách "nhìn" khác nhau (Today, Overdue, QUICK, EASY, Tasks by Areas...) chỉ là filter + sort + group khác nhau áp trên cùng bảng đó. Điều này tránh cho database biến thành một mớ bảng rời rạc theo từng màn hình.

### 8.2. Schema — `tasks` (bổ sung field mới)

```text
tasks
├── id
├── user_id
├── project_id          → FK Projects (nullable)
├── area_id              → FK Areas (nullable)
├── task_name
├── start_at             (timestamp, nullable)
├── due_at               (timestamp, nullable)
├── importance           (enum: low | medium | high)
├── urgency              (enum: low | medium | high)
├── energy_level         (text, nullable: flow | quick | easy | personal) ← Năng lượng = kiểu việc, chọn 1 (migration 0008)
├── end_at               (timestamp, nullable)          ← tự điền khi hoàn thành (mục 9.5)
├── actual_minutes       (int, tự tính)                  ← end_at − start_at (mục 9.5)
├── actual_hours         (numeric, tự tính)
├── state                (enum: not_started | in_progress | done)
├── task_type            (enum: task | habit)            — xem mục Phase 2
├── complete             (boolean)
├── moved_the_needle     (boolean, nullable)              ← MỚI: đánh giá hồi cứu, set lúc Review
├── created_at
└── updated_at
```

`energy_level` (hiển thị là **Năng lượng**) là kiểu việc, mỗi task chọn **1** giá trị hoặc để trống. Trục này độc lập với `importance`/`urgency`:

| Giá trị | Nhãn | Ý nghĩa |
|---|---|---|
| `flow` | Flow | Cần tập trung sâu (deep work) |
| `quick` | Quick | Việc nhanh, làm xong trong vài phút |
| `easy` | Easy | Việc nhẹ đầu, làm được khi mệt |
| `personal` | Personal | Việc dành cho cá nhân |

`moved_the_needle` là field mới, khác bản chất với `importance`: `importance` là đánh giá **trước khi làm** (task này có đáng ưu tiên không), còn `moved_the_needle` là đánh giá **sau khi làm xong** (task đó có thực sự tạo tác động không). Field này để `NULL` cho tới khi task hoàn thành và được đánh giá trong Review (mục 5.5) — không hỏi ngay lúc tạo task, tránh thêm quyết định không cần thiết ở bước capture.

Các view QUICK / EASY / FLOW / PERSONAL chỉ là saved view lọc `energy_level` bằng đúng giá trị đó (ví dụ QUICK = `energy_level in (quick)`). App **không suy ra** nhãn từ trường khác. Thời gian dự kiến (`estimated_minutes`) đã bỏ; thời gian thật vẫn tự tính từ Bắt đầu → Kết thúc (mục 9.5).

| View gợi ý | Điều kiện lọc |
|---|---|
| QUICK / EASY / FLOW / PERSONAL | `energy_level` = giá trị tương ứng |
| LOW | `importance = low` |
| HABIT | `task_type = habit` |
| Tasks by Areas | không lọc, chỉ `group_by = area_id` |
| Moved the Needle (trong Review) | `moved_the_needle = true` |

### 8.3. Schema — `saved_views`

```text
saved_views
├── id
├── user_id
├── name                 ("QUICK", "EASY", "My Morning"...)
├── description          (ghi chú: view này hiện gì — mục 9.9)
├── icon
├── filters               (TaskFilter[], xem DSL bên dưới)
├── sorts                 (TaskSort[])
├── group_by              (nullable: area_id | project_id | state | importance | urgency | energy_level)
├── visible_columns        (string[] — ["task_name", ...cột theo thứ tự], rỗng = mặc định; mục 9.13)
├── view_type              ("table" | "calendar_week" | "calendar_month" — mục 9.10)
├── section                ("tasks" | "schedule" | "list")
├── calendar_field         ("due_at" | "start_at" | "end_at")
├── is_system              (boolean — true cho 8 view mặc định, không cho xóa)
├── sort_order             (vị trí hiển thị tab)
├── created_at
└── updated_at
```

**MVP:** seed sẵn các `is_system = true` view cho mỗi user ngay lúc onboarding (đơn giản hơn cho RLS/logic so với việc dùng `user_id = NULL` làm template dùng chung). View hệ thống không cho xóa, nhưng cho phép user tạo thêm view riêng (`is_system = false`) không giới hạn.

### 8.4. Filter DSL (giới hạn, không cho query tự do)

Không nhận JSON tùy ý hay chuỗi kiểu SQL từ frontend — luôn định nghĩa field/operator hợp lệ trước, để cả người và AI coding agent không thể tạo ra query ngoài tầm kiểm soát:

```ts
type TaskFilter = {
  field:
    | "complete" | "start_at" | "due_at"
    | "importance" | "urgency" | "energy_level"
    | "state"
    | "project_id" | "area_id" | "task_type"
    | "moved_the_needle"
  operator:
    | "eq" | "neq" | "lt" | "lte" | "gt" | "gte"
    | "in" | "is_null" | "not_null"
  value?: unknown
}

type TaskSort = {
  field: "importance" | "urgency" | "start_at" | "due_at" | "end_at" | "actual_minutes" | "task_name" | "created_at"
  direction: "asc" | "desc"
}

type SavedView = {
  id: string
  name: string
  filters: TaskFilter[]
  sorts: TaskSort[]
  group_by?: "area_id" | "project_id" | "state" | "importance" | "urgency" | null
  visible_columns: string[]
  view_type: "table"
  is_system: boolean
}
```

### 8.5. Ví dụ view cụ thể

```json
{
  "name": "QUICK",
  "filters": [
    { "field": "complete", "operator": "eq", "value": false },
    { "field": "energy_level", "operator": "in", "value": ["quick"] }
  ],
  "sorts": [{ "field": "due_at", "direction": "asc" }],
  "group_by": null,
  "visible_columns": ["task_name", "start_at", "importance", "energy_level"],
  "view_type": "table",
  "is_system": false
}
```

```json
{
  "name": "FLOW",
  "filters": [
    { "field": "complete", "operator": "eq", "value": false },
    { "field": "energy_level", "operator": "in", "value": ["flow"] }
  ],
  "sorts": [{ "field": "importance", "direction": "desc" }],
  "group_by": null,
  "visible_columns": ["task_name", "start_at", "importance", "energy_level"],
  "view_type": "table",
  "is_system": false
}
```

```json
{
  "name": "Open Loops",
  "filters": [
    { "field": "complete", "operator": "eq", "value": false },
    { "field": "due_at", "operator": "is_null" }
  ],
  "sorts": [{ "field": "importance", "direction": "desc" }],
  "group_by": null,
  "visible_columns": ["task_name", "importance", "project_id"],
  "view_type": "table",
  "is_system": true
}
```

### 8.6. Hai tầng điều hướng

```text
SIDEBAR ("tôi đang làm loại việc nào?")
   ↓
TASKS → All Tasks
   ↓
SAVED VIEW TABS ("tôi muốn nhìn nhóm task này theo cách nào?")
   ORDER | QUICK | EASY | FLOW | PERSONAL | LOW | HABIT | NO DATE | BY AREA | EVERYTHING | +
   ↓
Filter / Sort / Group áp dụng
   ↓
Task list hiển thị
```

Sidebar (Today, Overdue, Open Loops, All Tasks...) và Saved View tabs đều dùng chung một cơ chế bên dưới (query definition), chỉ khác nơi hiển thị: các view lõi (Today, Overdue...) cố định trong sidebar để luôn thấy ngay; các view linh hoạt hơn (QUICK, EASY, PERSONAL, custom) nằm trong tab bên trong "All Tasks", không chiếm chỗ sidebar chính.

### 8.7. Ranh giới MVP — tránh rơi vào bẫy "tự tổ chức thay vì làm việc"

- **Dùng view có sẵn** (click chọn tab) → luồng chính, không giới hạn, xuất hiện ngay ở giao diện chính.
- **Tạo view mới / chỉnh filter-sort** → đặt sau nút `+ New` rõ ràng, tách biệt khỏi thao tác hàng ngày. Đây là tính năng cho lúc thiết lập, không phải quyết định phải đưa ra mỗi ngày — tránh đúng bẫy ADHD hay gặp: dành thời gian tinh chỉnh hệ thống thay vì dùng nó.
- MVP chỉ cần `view_type = "table"`; không làm Kanban/Calendar view ở giai đoạn này.

---

## 9. Auth & Trạng Thái Triển Khai

### 9.1. Supabase Auth (email + password)

MVP dùng thẳng Supabase Auth có sẵn (`auth.signInWithPassword` / `auth.signUp`), chưa cần OAuth (Google/GitHub...) — thêm sau nếu cần. Không tự quản lý bảng user riêng: `auth.users` của Supabase là nguồn sự thật, các bảng khác (`tasks`, `projects`...) chỉ tham chiếu `user_id` tới đó.

- `src/lib/useSession.ts` — hook theo dõi session hiện tại, tự cập nhật khi đăng nhập/đăng xuất
- `src/features/auth/AuthPage.tsx` — 1 form dùng chung cho cả đăng nhập và đăng ký (`mode: "signin" | "signup"`)
- `src/components/ProtectedRoute.tsx` — chặn truy cập `/tasks` nếu chưa đăng nhập, tự chuyển hướng sang `/login`
- Trigger `seed_system_views_for_user` (migration `0002`) tự chạy ngay khi `auth.users` có user mới → 8 Saved View hệ thống có sẵn ngay sau khi đăng ký, không cần bước setup thủ công
- ⚠️ Migration `0003` sửa lỗi "Database error saving new user": Supabase Auth chạy trigger với `search_path = auth`, nên mọi hàm trigger trên `auth.users` phải ghi rõ schema (`public.saved_views`) và đặt `set search_path = ''`. Áp dụng quy tắc này cho mọi hàm `security definer` viết sau này.

### 9.2. Task View Query Engine (đã hiện thực hoá Filter DSL ở mục 8.4)

- `src/lib/taskViewTypes.ts` — types khớp 1:1 với Filter DSL trong README (không thêm field/operator ngoài danh sách đã khai báo)
- `src/lib/taskViewQuery.ts` — dịch `TaskFilter[]` + `TaskSort[]` thành query Supabase thật (`fetchTasksForView`). Riêng giá trị ngày tương đối (`today`/`tomorrow`/`this_week`/`now`) được tính lại **mỗi lần gọi** dựa trên thời điểm hiện tại, không lưu cứng trong DB — đúng lý do "hôm nay" phải đổi theo từng ngày.
- `src/features/tasks/useSavedViews.ts` + `useTasksView.ts` — hook TanStack Query gọi engine trên
- `src/features/tasks/TasksPage.tsx` — UI tab Saved View (mục 8.6), click tab nào chạy filter/sort của view đó

### 9.4. Thêm / sửa / xoá Task (thao tác kiểu Notion)

Bảng Tasks thao tác giống database của Notion — bấm vào ô nào sửa ô đó:

| Cột | Cách sửa |
|---|---|
| Tên | Bấm để sửa tại chỗ. Enter lưu, Esc huỷ. Di chuột vào dòng hiện nút **Mở** → mở trang chi tiết |
| Bắt đầu / Hạn | Bấm → chọn ngày, hoặc nhanh: Hôm nay / Ngày mai / Tuần sau / Xoá ngày |
| Quan trọng / Gấp / Trạng thái | Bấm → chọn nhãn màu (giống select của Notion) |
| Project / Area | Bấm → chọn có sẵn, hoặc gõ tên chưa có để **tạo mới ngay trong ô**. Tìm không cần dấu ("du an" khớp "Dự án") |

- **"+ Thêm task"** ở cuối bảng (như "+ New page"): gõ tên → Enter lưu và mở sẵn dòng trống kế tiếp để ghi liên tục; Esc huỷ. Hạn mặc định theo view đang mở (*Today* → hôm nay, *Tomorrow* → ngày mai). Ẩn ở *Completed* / *Overdue*.
- **Nút "Mới"** (góc phải): mở trang chi tiết ở chế độ tạo mới — chưa lưu gì cho tới khi bấm "Tạo task".
- **Trang chi tiết** (`TaskDetailDrawer.tsx`): sửa mọi field kể cả Project/Area, xoá có xác nhận, Esc để đóng (Esc trong menu con chỉ đóng menu con).
- **Tick hoàn thành**: cập nhật ngay, giữ task ~1 giây để thấy dấu tick rồi mới rời view.
- Màn hình hẹp: danh sách thay cho bảng, chạm để mở chi tiết, dòng thêm task ở cuối.

Code: `TaskTable.tsx` (bảng + dòng thêm mới + danh sách mobile), `cells.tsx` (các ô sửa tại chỗ), `taskFields.ts` (nhãn/màu dùng chung), `components/Popover.tsx` (menu neo theo ô, không bị bảng cắt), `features/para/usePara.ts` (đọc/tạo Projects & Areas).

### 9.5. Tự tính thời gian làm (Minutes / Hours)

Giống 2 cột công thức *Minutes* / *Hours* trong Notion — migration `0004_task_time_tracking.sql`:

| Field | Ý nghĩa |
|---|---|
| `start_at` | Bắt đầu (có giờ). **Tự điền** khi chuyển task sang *Đang làm* nếu đang trống |
| `end_at` | Kết thúc. **Tự điền** = lúc đánh dấu hoàn thành; bỏ hoàn thành thì tự xoá |
| `actual_minutes` | Cột tự tính trong database = `end_at − start_at` (phút). Chỉ đọc |
| `actual_hours` | Như trên nhưng theo giờ, 2 chữ số thập phân. Chỉ đọc |

- Không có `start_at` → tính từ lúc tạo task (`created_at`), giống template Notion đặt Start Time mặc định là ngày tạo.
- Kết thúc trước bắt đầu → để trống (không ra số âm).
- Toàn bộ logic nằm trong **database** (trigger `task_auto_timestamps` + generated columns), nên tick xong ở app, sửa trong Supabase Table Editor hay app khác sau này đều tính đúng như nhau.
- Code **không bao giờ** gửi `actual_minutes`/`actual_hours` lên (`TaskDraft` loại bỏ 2 cột này) — Postgres sẽ từ chối nếu ghi vào cột tự tính.
- Giao diện: cột **Thời gian** trong bảng (`1g 30p`), trang chi tiết hiện Bắt đầu/Kết thúc có giờ và `1 giờ 30 phút · 90 phút · 1,50 giờ`.

### 9.6. Bộ lọc & sắp xếp (kiểu Notion)

Thanh công cụ ngay dưới các tab view (`features/tasks/ViewToolbar.tsx`):

- **Chip sắp xếp** (vd `Hạn: Sớm → muộn`): bấm để đổi trường/chiều, thêm nhiều mức sắp xếp (ưu tiên từ trên xuống). Ô trống luôn xuống cuối. Sắp được theo: Hạn, Bắt đầu, Kết thúc, Quan trọng, Gấp, Thời gian làm, Tên, Ngày tạo.
- **Chip bộ lọc** (vd `Quan trọng: Cao`, `Hoàn thành: Chưa xong`): bấm để sửa, có nút *Xoá bộ lọc*. **+ Bộ lọc** để thêm — editor mở ngay sau khi thêm.

| Loại trường | Trường | Cách lọc |
|---|---|---|
| Có/không | Hoàn thành | Chưa xong / Đã xong |
| Nhãn | Trạng thái, Quan trọng, Gấp, Năng lượng | Chọn một hoặc nhiều (`in`) |
| Ngày | Hạn, Bắt đầu, Kết thúc | Hôm nay / Ngày mai / Tuần này / Đã qua / Có ngày / Trống — lưu dạng tương đối nên "Hôm nay" luôn đúng mỗi ngày |
| Relation | Project, Area | Chọn một hoặc nhiều, hoặc "Trống (chưa gán)" |

- Thay đổi là **nháp** cho tới khi lưu (tab hiện chấm cam): **Lưu vào [view]** · **Lưu thành view mới** (tạo tab mới, vd QUICK, EASY như trong Notion) · **Đặt lại**.
- View tự tạo có nút **Xoá view** (chỉ xoá cách nhìn, không xoá task). View hệ thống (Today, Overdue…) sửa được nhưng không xoá được.
- Bộ lọc "chọn nhiều" mà chưa chọn gì thì không lọc (không làm trống bảng).
- Tất cả đi qua Filter DSL ở mục 8.4 — không có query tự do.

### 9.7. Chọn nhiều task · Nhân bản · Xoá hàng loạt

- **Chọn:** di chuột vào dòng → hiện ô vuông bên trái (khác ô tròn = hoàn thành). **Shift+click** chọn cả dải, ô ở tiêu đề = chọn tất cả. Đang có dòng được chọn thì mọi ô vuông hiện sẵn.
- **Thanh thao tác nổi** ở đáy màn hình: `N đã chọn · Nhân bản · Xoá · ✕`.
- **Phím tắt** (khi không gõ trong ô nhập): `Ctrl/Cmd + D` nhân bản · `Delete` xoá · `Esc` bỏ chọn.
- **Nhân bản** (`useDuplicateTasks`): gửi 1 request cho tất cả. Bản sao giữ tên, ghi chú, hạn, Project/Area, các mức Quan trọng/Gấp/Năng lượng — nhưng là **task mới**: *Chưa làm*, chưa hoàn thành, không mang giờ bắt đầu/kết thúc (để thời gian làm tính lại từ đầu). Bản sao được chọn sẵn để thao tác tiếp.
- **Xoá hàng loạt** (`useDeleteTasks`): xoá ngay như Notion, kèm thông báo **Hoàn tác** trong 8 giây (`useRestoreTasks` chèn lại đúng các dòng cũ, giữ id & ngày tạo, bỏ qua cột tự tính).
- Trang chi tiết có nút **Nhân bản**: tạo bản sao rồi mở luôn bản sao để sửa (có dòng báo "Đây là bản sao…"). Trên điện thoại, nhân bản/xoá làm qua trang chi tiết.

### 9.8. Kéo thả sắp thứ tự (1 hoặc nhiều task)

- Di chuột vào dòng → hiện **tay nắm ⋮⋮** bên trái; kéo tay nắm để đổi vị trí (các ô khác vẫn bấm để sửa như cũ).
- **Kéo nhiều task:** chọn các task (ô vuông / Shift+click) rồi kéo một trong số đó → cả nhóm di chuyển, giữ nguyên thứ tự giữa chúng. Thẻ nổi hiện "Tên task +N".
- **View đang có sắp xếp** → khi thả hiện hộp thoại **"Bỏ sắp xếp?"**:
  - *Không* → không thay đổi gì (không gửi request nào).
  - *Bỏ sắp xếp* → xoá sắp xếp của view (giữ nguyên bộ lọc), task nằm đúng chỗ vừa thả.
- **View không sắp xếp** → hiển thị theo thứ tự kéo thả (chip sắp xếp ghi "Thứ tự thủ công"); thả là lưu luôn, không hỏi.
- Lưu vào cột `tasks.position` (đã có từ migration 0001 — không cần SQL mới). Cách tính (`features/tasks/reorder.ts`):
  - Bình thường chỉ đổi `position` của các task vừa kéo — chèn vào giữa 2 hàng xóm → 1 request mỗi task được kéo.
  - Lần đầu kéo (task chưa có vị trí) hoặc vừa bỏ sắp xếp → đánh số lại cả danh sách đang hiển thị.
- Task mới / bản sao chưa có vị trí → nằm cuối, theo thứ tự tạo.
- Thư viện: `@dnd-kit/core` + `@dnd-kit/sortable` (hỗ trợ cả bàn phím). Màn hình điện thoại chưa hỗ trợ kéo thả.

### 9.9. Ghi chú cho từng view

Dòng ghi chú ngay dưới các tab — cho biết view đang hiện dữ liệu gì (`features/tasks/ViewNote.tsx`, migration `0005_view_descriptions.sql`):

- **8 view hệ thống có sẵn ghi chú**, vd *Today*: "Việc chưa xong có hạn hôm nay — bắt đầu từ đây.", *Open Loops*: "Việc chưa xong và chưa có hạn — những thứ còn lơ lửng trong đầu."
- **Sửa được**: bấm *Sửa* / *Thêm ghi chú* → gõ → Enter lưu, Esc huỷ. Xoá trắng = quay về mô tả tự động.
- **View chưa có ghi chú** → hiện **câu mô tả tự sinh** từ bộ lọc + sắp xếp, vd "Task chưa xong · quan trọng: Cao — sắp theo hạn (sớm → muộn)."
- **Đang chỉnh bộ lọc chưa lưu** → hiện thêm dòng "Đang chỉnh (chưa lưu): …" để ghi chú không bao giờ nói sai về dữ liệu đang thấy.
- Lưu trong cột `saved_views.description`; trigger tạo view cho user mới cũng đã kèm ghi chú.

### 9.10. 📅 Work Schedule — view dạng lịch

Trang Tasks gồm 2 mục, mỗi mục có bộ view riêng (`TaskViewSection.tsx` dùng chung):

- **📅 Work Schedule** (trên) — mặc định dạng lịch: *Week's Tasks* (lịch tuần, chỉ việc chưa xong) · *All this week* (lịch tuần, tất cả) · *Monthly tasks* (lịch tháng).
- **Task list** (dưới) — dạng bảng như cũ: Today, Tomorrow, Overdue…

Mỗi view tuỳ chỉnh đầy đủ như Notion: chip **Bố cục** (Bảng / Lịch tuần / Lịch tháng) + **hiện theo** Hạn / Bắt đầu / Kết thúc, cùng bộ lọc, sắp xếp, ghi chú, lưu / lưu thành view mới / đặt lại.

Trên lịch (`CalendarView.tsx`):
- ‹ Hôm nay › để chuyển tuần/tháng; chỉ tải task trong khoảng đang xem (`gte`/`lte` theo trường ngày).
- Di chuột vào ô ngày → **+** thêm task vào ngày đó (hạn = cuối ngày; nếu lịch theo Bắt đầu thì = đầu ngày).
- **Kéo thẻ sang ngày khác** để đổi ngày, giữ nguyên giờ.
- Bấm thẻ → mở chi tiết; tick hoàn thành ngay trên thẻ. Hôm nay tô cam, cuối tuần nền nhạt.
- Điện thoại: hiện dạng danh sách theo ngày.

Database (migration `0006_work_schedule_calendar.sql`): `saved_views.view_type` đổi từ enum sang text (`table` | `calendar_week` | `calendar_month`), thêm `section` (`list` | `schedule`) và `calendar_field` (`due_at` | `start_at` | `end_at`). Hàm `seed_schedule_views()` tạo 3 view Work Schedule cho user cũ lẫn user mới, chạy lại không bị nhân đôi.

### 9.11. ✅ Tasks List & nhóm task (Group by)

Trang Tasks giờ có 3 mục, từ trên xuống giống Notion: **✅ Tasks List → 📅 Work Schedule → Work Summary** (mục "Task list" cũ đổi tên thành *Work Summary*).

Tasks List có 3 view mặc định:
- *Tasks today*: việc chưa xong, hạn hôm nay, sắp theo Quan trọng.
- *Tasks to context*: giống Tasks today nhưng **nhóm theo Area**.
- *Tomorrow*: việc chưa xong, hạn ngày mai.

Bất kỳ view bảng nào cũng dùng được chip **Nhóm** (Không nhóm / Area / Project / Trạng thái / Quan trọng / Gấp):
- Mỗi nhóm có tiêu đề ▾ tên · số task · Σ thời gian. Bấm vào tiêu đề để thu gọn hoặc mở. Nhóm theo Area/Project liệt kê đủ mọi Area/Project (kể cả nhóm 0 task), xếp A→Z, nhóm "Chưa có Area" nằm cuối.
- **+ Thêm task** trong mỗi nhóm: task mới tự nhận giá trị của nhóm (vd. area của nhóm).
- **Kéo task sang nhóm khác** (thả lên dòng hoặc tiêu đề nhóm) để đổi Area/Project/mức…. Việc này không hỏi "Bỏ sắp xếp?" vì chỉ đổi nhóm.
- Cuối bảng có dòng **Σ** tổng thời gian đã làm (giống SUM của Notion).
- Trên điện thoại, danh sách cũng chia theo nhóm.

Database (migration `0007_tasks_list_section.sql`): `section` thêm giá trị `tasks`, `group_by` được ràng buộc giá trị hợp lệ. Hàm `seed_tasks_list_views()` tạo 3 view Tasks List cho cả user cũ lẫn user mới; chạy lại cũng không bị nhân đôi.

### 9.12. ⚡ Năng lượng = Flow · Quick · Easy · Personal

- Bảng có thêm cột **Năng lượng** (sau Trạng thái). Bấm vào ô để chọn Flow / Quick / Easy / Personal, hoặc **Bỏ chọn**. Màu giống Notion: Flow xanh, Quick xám, Easy vàng, Personal hồng.
- Trang chi tiết task: 4 nhãn để chọn (mỗi task chỉ 1 kiểu, bấm lại để bỏ). Đã bỏ ô *Thời gian dự kiến*.
- **Trạng thái** giữ nguyên cho tiến độ (Chưa làm / Đang làm / Xong), nên thời gian vẫn tự tính.
- Lọc theo Năng lượng, nhóm theo Năng lượng (thêm nhóm "Chưa chọn năng lượng"), rồi lưu thành view như QUICK, EASY...
- Thêm nhanh trong view đang lọc đúng 1 kiểu (vd QUICK) thì task mới tự nhận kiểu đó, nên không bị "biến mất" khỏi view. Điều này cũng áp dụng cho Quan trọng / Gấp.

Database (migration `0008_energy_types.sql`):
- `energy_level` đổi từ enum `low|medium|high` sang text `flow|quick|easy|personal` (có thể trống). Xoá cột `estimated_minutes`.
- Dữ liệu cũ tự chuyển: high → Flow, low → Easy, dự kiến ≤ 15 phút → Quick, Area "Personal" → Personal, còn lại để trống.
- Các saved view đang lọc hoặc sắp theo 2 cột cũ được sửa theo.

### 9.13. Kéo sắp xếp cột & tab view

Chỉ đổi cách hiển thị. Không cần migration, dữ liệu task không bị động tới. Thứ tự được lưu vào `saved_views` nên sang máy khác vẫn giữ nguyên.

**Cột trong bảng** (riêng cho từng view, lưu ngay, không cần bấm Lưu):
- **Kéo tiêu đề cột** sang trái/phải để đổi chỗ, ô dữ liệu đổi theo.
- **Bấm tiêu đề cột** để mở menu: Sắp xếp tăng/giảm (là nháp như chip Sắp xếp), Dời sang trái/phải (dùng được bằng bàn phím), Ẩn cột.
- **Chip "Cột"** trên thanh công cụ: kéo đổi thứ tự trong danh sách, bấm con mắt để ẩn/hiện, có mục *Đang ẩn*, và **Về mặc định**. Cột *Kết thúc* ẩn sẵn, bật khi cần.
- Cột **Tên** luôn đứng đầu, không ẩn được.
- Lưu ở `visible_columns = ['task_name', ...các cột theo thứ tự]`. Mảng rỗng nghĩa là bố cục mặc định.

**Tab view**: giữ và kéo ngang để đổi thứ tự trong từng mục (Tasks List / Work Schedule / Work Summary), bấm để mở như cũ. Trên điện thoại thì giữ khoảng 0,3 giây rồi kéo, để vuốt ngang vẫn cuộn được hàng tab. Lưu ngay vào `sort_order`.

### 9.14. Sidebar thu gọn & vùng làm việc rộng hơn

- Nút ⟨▯ cạnh logo (hoặc **Ctrl/Cmd + \\**) thu sidebar còn dải icon rộng 64px. Di chuột lên icon để xem tên. Trạng thái được nhớ theo trình duyệt (localStorage), vì đây chỉ là tuỳ chọn giao diện.
- Trang Tasks rộng tối đa 1760px (trước là 1152px). Bảng tự co theo nội dung, không còn khoá bề rộng tối thiểu 1060px. Chỉ cuộn ngang khi cột thật sự không đủ chỗ.
- Bỏ thanh cuộn dọc thừa ở hàng tab view (hiện trên Windows).

### 9.15. Bộ chọn ngày giờ kiểu Notion (`DatePicker.tsx`)

Dùng chung cho ô Bắt đầu / Hạn / Kết thúc trong bảng và trang chi tiết task. Đã bỏ ô ngày mặc định của trình duyệt.

- **Ô gõ ngày** ở trên cùng: gõ `24/09/2026`, `24/9`, `24/9/26`, hoặc kèm giờ `24/9 14:30`, rồi Enter. Gõ sai thì giữ nguyên giá trị cũ.
- **Lịch tháng** tuần bắt đầu từ Thứ 2. Có nút **Hôm nay** và ‹ › để đổi tháng. Ngày đang chọn tô cam, hôm nay chữ cam.
- Công tắc **Có giờ**: bật thì hiện ô **Giờ**. Hạn mặc định tắt. Bắt đầu và Kết thúc mặc định bật, vì cần giờ để tính thời gian làm.
- Không có giờ: bấm 1 ngày là lưu và đóng luôn. Có giờ: bộ chọn vẫn mở để chỉnh giờ.
- **Xoá** để bỏ trống ngày.
- Cách lưu giữ nguyên như cũ: chỉ có ngày thì Hạn/Kết thúc lưu 23:59, Bắt đầu lưu 00:00. Hạn giờ có thể mang giờ cụ thể, và ô sẽ hiện kiểu "Hôm nay 14:30".
- Đổi giờ vẫn giữ phần giây cũ, nên sửa Kết thúc 21:47 → 23:47 ra đúng 2 giờ.

### 9.16. Nút "Làm ngay"

Nằm cạnh nút **Mới** ở đầu trang Tasks. Mở trang Task mới giống nút Mới nhưng điền sẵn:
- **Bắt đầu** = ngày giờ lúc bấm nút
- **Trạng thái** = Đang làm
- **Hạn** = hôm nay

Chỉ cần gõ tên rồi **Tạo task**. Thời gian làm tính từ lúc bấm, khi đánh dấu Xong thì tự ra số phút/giờ. Các giá trị trên vẫn sửa được trước khi tạo.

### 9.17. Notes (ghi chú) + Ghi chú nhanh

Giống bảng Quick Notes trong Notion (migration `0009_notes.sql`, bảng `notes`):

```text
notes
├── title, content
├── area_id, project_id      (1 Area, 1 Project — như Task)
├── topics                   (text[] — tag tự do, nhiều tag / ghi chú)
├── archived                 (New notes / Archive)
└── created_at, updated_at
```

Bảng `resources` giữ nguyên, để dành cho tính năng Resources sau này (đã làm ở 9.29).

- **Ghi chú nhanh** có ở đầu trang Tasks, đầu trang Notes, nút ở sidebar, hoặc bấm phím **N** ở bất kỳ trang nào.
  - Gõ rồi **Enter** là lưu. **Shift+Enter** để xuống dòng: dòng đầu là tên, phần còn lại là nội dung.
  - Các nút nhỏ **Area · Project · Topics** để gắn ngay lúc ghi. Topic chưa có thì gõ tên để tạo.
  - Lưu xong hiện "Đã lưu … · Mở".
- **Trang Notes** có tab *New notes* / *Archive* và các cột Tên · Areas · Projects · Topics · Created time.
  - Sửa Area/Project/Topics ngay trong bảng. Bấm tên để mở trang chi tiết (nội dung dài, Ctrl+Enter để lưu).
  - Lưu trữ / khôi phục / xoá. Tìm không dấu, bấm Topic để lọc.

### 9.18. Thanh "Đang làm"

Thanh nổi ở góc dưới, hiện trên mọi trang khi có task *Đang làm*:
- Tên task và đồng hồ chạy từ giờ Bắt đầu.
- Nút **Xong**: hoàn thành task, database tự ghi giờ kết thúc.
- Bấm tên để mở chi tiết task.
- Có nhiều việc đang làm thì hiện "+N" để chuyển qua lại.

Sidebar: bỏ *Now* (đã gộp vào Tasks + thanh Đang làm) và *Inbox* (thay bằng Ghi chú nhanh + Notes).

### 9.19. Areas, Projects, Archives

Không cần migration mới, vì dùng các bảng `areas` / `projects` đã có sẵn.

- **Areas** (`/areas`) và **Projects** (`/projects`) hiển thị dạng bảng, mỗi dòng có: số việc đang mở, số việc đã xong (Project có thanh tiến độ), tổng thời gian đã làm, số ghi chú.
  - Gõ tên ở ô trên bảng để tạo mới.
  - Projects có 3 tab: *Đang làm · Yêu thích · Hoàn thành*. Bấm ⭐ / ✓ / 🗄 ngay trên dòng.
- **Trang chi tiết** (`/areas/:id`, `/projects/:id`):
  - Đổi tên ngay trên tiêu đề. Có các nút Yêu thích, Hoàn thành (Project), Lưu trữ / Khôi phục, Xoá. Xoá chỉ bỏ liên kết, task và ghi chú vẫn giữ.
  - 4 ô số liệu. Danh sách **Tasks**: thêm nhanh, tick xong, bấm để mở chi tiết, mục "Đã xong" gấp lại được.
  - **Ghi chú** có ô ghi chú nhanh gắn sẵn Area/Project đó.
  - Trang Area có thêm danh sách **Projects** thuộc Area và ô tạo Project mới trong Area.
  - Task tạo trong Project tự gắn luôn Area của Project.
- **Archives** (`/archives`) chứa Projects và Areas đã lưu trữ, có nút Khôi phục, kèm link tới ghi chú đã lưu trữ.

### 9.20. Biến ghi chú thành task

Có nút **Tạo task** trong trang chi tiết ghi chú, và biểu tượng trên từng dòng bảng Notes. Bấm vào mở trang Task mới điền sẵn:
- Tên, nội dung (vào phần ghi chú của task), Area, Project
- Hạn là hôm nay

Ghi chú gốc vẫn được giữ nguyên.

### 9.21. Projects giống Notion (các view + dạng thẻ)

Migration `0010_project_deadline.sql` thêm cột `projects.due_at` (hạn chót).

- Trang **Projects** có 7 view giống bảng Notion, mỗi tab kèm số lượng:

  | View | Hiện gì |
  |---|---|
  | Uncompleted Projects | chưa xong |
  | OVERDUE | chưa xong và đã qua hạn (tab đỏ khi có) |
  | Project by Areas | chưa xong, nhóm theo Area, gấp/mở được, có "Chưa có Area" |
  | Fav | yêu thích |
  | Finished | đã hoàn thành |
  | Archive | đã lưu trữ |
  | All Projects | tất cả |

- Có 2 bố cục **Thẻ** (gallery như Notion) / **Bảng**. View và bố cục đang chọn được nhớ theo trình duyệt.
- Mỗi thẻ hiện: tên, ⭐ yêu thích, ✓ hoàn thành, Area, hạn (đỏ nếu quá hạn), thanh tiến độ task, giờ đã làm.
- Thẻ **+ New page** cuối mỗi nhóm để tạo Project. Tạo trong nhóm Area thì tự gắn Area đó, tạo trong Fav/Finished thì tự đánh dấu tương ứng.
- Tìm Project không cần dấu. Nút **Mới** tạo Project rồi mở luôn trang chi tiết.
- Trang chi tiết Project có thêm ô **Hạn** (bộ chọn ngày), hiện chữ "Quá hạn" màu đỏ khi trễ.

### 9.22. Trang Project kiểu Notion: Areas · Deadline · Status

Migration `0011_project_labels.sql` thêm cột `projects.labels`.

- Trang chi tiết Project trình bày như một trang Notion: icon thư mục lớn, tên to, bên dưới là các thuộc tính:
  - **Areas**: chọn Area.
  - **Deadline**: bộ chọn ngày. Khi trễ, nhãn đổi thành "Quá hạn" màu đỏ.
  - **Status** (màu như Notion; từ mục 9.28 chỉ chọn 1):

    | Status | Lưu ở |
    |---|---|
    | Fav | `is_favorite` |
    | Completed | `completed` |
    | Archive | `archived` |
    | On-going · Deadline · Moved the Needle | `labels` (migration 0011) |

    Fav, Completed và Archive dùng lại cột có sẵn nên các view (Fav / Finished / Archive…) vẫn chạy như trước.
- Ô trống hiện chữ "Trống". Bấm **Status** để mở danh sách: gõ để tìm, bấm để bật/tắt, bấm × trên nhãn để gỡ.
- Nút **Mới** ở trang Projects mở ngay trang Project mới, con trỏ nằm sẵn ở ô tên đã được chọn, gõ là đè tên luôn.
- Thẻ Project hiện thêm nhãn On-going / Deadline / Moved the Needle.

### 9.23. Icon tuỳ chỉnh + trang Project/Area như Notion

Migration `0012_para_icons.sql` thêm cột `icon` cho `projects` và `areas`.

- **Icon:** bấm icon lớn ở đầu trang để mở bộ chọn (`ParaIcon.tsx`):
  - Tab **Emoji**: khoảng 70 emoji chia nhóm Công việc / Học & sáng tạo / Cuộc sống, hoặc dán một emoji bất kỳ.
  - Tab **Link ảnh**: dán `https://…`, có xem trước.
  - Nút **Ngẫu nhiên** và **Xoá icon**.
  - Icon hiện ở thẻ / bảng Projects, danh sách Areas, và các tag Area/Project trong bảng Task, Notes, bộ chọn.
- **Bố cục trang** (`ParaDetailPage.tsx`, `ParaBlocks.tsx`): cột giữa rộng 1100px.
  - Trên cùng: icon, tên lớn, các thuộc tính (Project: Areas · Deadline · Status).
  - Dưới đó: một dòng số liệu gọn (việc mở · đã xong · giờ đã làm · ghi chú · % tiến độ).
- **Các khối có tab view**, giống linked database của Notion:
  - **Tasks**: tab *Project Tasks* / *Completed Tasks*. Bảng sửa tại chỗ Tên, Hạn, Quan trọng, Gấp, Trạng thái, Năng lượng. Dòng "+ Thêm task" ở cuối.
  - **Notes**: tab *Notes* / *Archive*, gồm cột Tên, Topics, Created time, Last edited, nút lưu trữ trên từng dòng, và dòng "+ Ghi chú mới".
  - Trang Area có thêm khối **Projects** dạng thẻ, kèm ô tạo Project mới ngay trong Area.
- **Tạo Project mới:** trang mở ra với con trỏ ở ô tên. Có khối **"Bắt đầu Project trong 3 bước"**:
  - Các bước: Gắn Area → Đặt Deadline → Thêm task đầu tiên. Bước nào xong tự gạch.
  - Bấm bước 3 là nhảy vào ô thêm task.
  - Khối tự ẩn khi đã có task.

### 9.24. Khối Tasks trong trang Project / Area = đầy đủ như trang Tasks

Migration `0013_para_task_views.sql` thêm `section` mới: `project` và `area`, kèm các view mặc định:
- Project: *Project Tasks* (chưa xong, thứ tự kéo thả) và *Completed Tasks* (đã xong, mới xong trước). Cột Project/Area ẩn sẵn.
- Area: *Area Tasks* (chưa xong, nhóm theo Project) và *Completed Tasks*.

Khối Tasks trong trang Project/Area giờ chính là `TaskViewSection`, giống hệt mục Tasks trên sidebar:
- Lọc, sắp xếp, nhóm, bố cục Bảng/Lịch tuần/Lịch tháng, ghi chú view.
- Kéo sắp xếp và ẩn/hiện cột, kéo tab view, chọn nhiều / nhân bản / xoá, kéo thả task, lưu thành view mới.
- `scope` là **bộ lọc ẩn** `project_id = <Project đang mở>` (hoặc `area_id`). Nó không lưu vào view và không hiện trong chip lọc. Task thêm nhanh tự gắn `project_id` + `area_id` của Project.
- **View dùng chung** cho mọi Project (hoặc mọi Area), giống 1 template trong Notion: tuỳ chỉnh 1 lần là mọi trang Project đều có, nhưng mỗi trang chỉ hiện task của chính nó.
- Trang Area nhóm theo Project thì chỉ hiện nhóm có task, không liệt kê Project của Area khác.
- Nếu chưa chạy migration 0013, trang vẫn hiện bảng Tasks đơn giản như cũ, kèm dòng nhắc chạy migration.

### 9.25. Trang Areas có view đầy đủ (`AreasPage.tsx`)

- Có 3 tab: **Đang dùng · Lưu trữ · Tất cả**, mỗi tab kèm số lượng.
- Chip **Bố cục**: Bảng hoặc Thẻ.
- Chip **Cột**: kéo để đổi thứ tự, bấm con mắt để ẩn/hiện, có **Về mặc định**.
  - Các cột: Projects, Việc đang mở, Đã xong, Tiến độ, Thời gian, Ghi chú, Ngày tạo. Tên luôn hiện.
- Chip **Sắp xếp**: nhiều mức, ưu tiên từ trên xuống.
- **Bộ lọc**:
  - Tên chứa…
  - Số việc đang mở / đã xong / thời gian (phút) / ghi chú / projects với điều kiện `>` `=` `<`.
- **Tiêu đề cột**: kéo sang trái/phải để đổi chỗ. Bấm để mở menu: sắp xếp tăng/giảm, dời trái/phải, ẩn cột.
- Tìm kiếm không dấu, ô tạo Area mới, nút lưu trữ/khôi phục trên từng dòng/thẻ. Nút **Đặt lại** về cấu hình mặc định.
- Cấu hình view (tab, bố cục, cột, sắp xếp, lọc) **đồng bộ giữa các máy** qua Supabase. Xem mục 9.26.

### 9.26. Đồng bộ cấu hình hiển thị giữa các máy (`ui_prefs`)

Migration `0014_ui_prefs.sql` thêm bảng `ui_prefs`:
- Cột: `user_id`, `key`, `value jsonb`, `updated_at`. Khoá chính là `(user_id, key)`, có RLS, mỗi người chỉ thấy của mình.
- Chỉ chứa cách hiển thị, không chứa dữ liệu công việc.

Hook `src/lib/useUiPref.ts` chạy như sau:
- Hiện ngay bằng bản lưu trên trình duyệt để không bị "nháy".
- Tải bản trên Supabase về. Có bản trên Supabase thì dùng bản đó, tức là theo cấu hình máy khác vừa chỉnh.
- Mỗi lần đổi: lưu vào trình duyệt ngay, gửi lên Supabase sau 0,4 giây (upsert, gộp các lần đổi liên tiếp).
- Chưa chạy migration hoặc mất mạng: vẫn chạy bình thường, chỉ nhớ trên trình duyệt.

Đang dùng cho các key:
- `areas-view`: trang Areas (tab, bố cục, cột, sắp xếp, lọc)
- `projects-view`: trang Projects (view đang chọn, Thẻ/Bảng)

Sidebar thu gọn vẫn nhớ riêng từng máy, vì đó là tuỳ chọn theo màn hình.

### 9.27. Sửa lỗi: Project mới tạo ở nơi khác không hiện ở trang Projects

- Tạo Project ở bất kỳ đâu (ô Project trong bảng Task, trang chi tiết task, khối Projects trong trang Area, trang Projects) thì Project mới được thêm **ngay** vào mọi danh sách đang nhớ, sau đó mới tải lại từ server (`rememberNewPara` trong `usePara.ts`).
- Trang Projects / Areas luôn tải lại khi mở (`refetchOnMount: 'always'`).
- Trang Area báo "Đã tạo Project … · Mở". Nếu tạo lỗi thì hiện rõ lý do (trước đây lỗi bị nuốt, không báo gì).
- Ô chọn Project/Area khi "Tạo …" giờ lấy đủ cột (icon…) của bản ghi vừa tạo.

### 9.28. Projects: thẻ hiện Area · Deadline · Status; Status chỉ chọn 1

- **Thẻ Project** (bố cục Thẻ) luôn có 3 dòng thuộc tính giống Gallery của Notion:
  - Area, Deadline (đỏ kèm "quá hạn" khi trễ), Status.
  - Thuộc tính trống hiện chữ mờ: "Chưa có Area" / "Chưa có deadline" / "Chưa có status".
- **Bảng Projects** có các cột Tên · Area · Deadline · **Status** · Tiến độ · Thời gian. Status đổi được ngay trong bảng.
- **Status chỉ chọn 1** (hoặc để trống): chọn xong tự đóng, có "Bỏ chọn". Cách lưu (`setStatusPatch` trong `projectStatus.tsx`):

  | Status | Lưu ở |
  |---|---|
  | Fav | `is_favorite` |
  | Completed | `completed` |
  | Archive | `archived` |
  | On-going · Deadline · Moved the Needle | `labels = [giá trị]` |

  Chọn 1 status thì mọi cờ còn lại được tắt. Không cần migration.
- Nút ⭐ / ✓ trên thẻ cũng theo quy tắc chọn 1: bấm lại thì bỏ trống.
- Dữ liệu cũ lỡ có nhiều status cùng lúc thì hiển thị status "nặng" nhất, theo thứ tự Archive > Completed > Deadline > On-going > Moved the Needle > Fav. Lần chọn tiếp theo sẽ gộp lại còn 1.

### 9.29. Resources (chữ R trong PARA) — `features/resources/`

Migration `0015_resources.sql` bổ sung cột cho bảng `resources` có sẵn từ 0001:

| Cột | Ý nghĩa |
|---|---|
| `kind` | Video · Book · Article/News/Post · Course · Khác |
| `creator` | Tác giả / kênh |
| `topics text[]` | Tag, dùng chung danh sách gợi ý với Notes |
| `review` | Reviews 1–5 sao |
| `minutes` | Độ dài (phút, cho phép số lẻ như 43.5) |
| `finished` | Đã xem / đọc xong |

Trang `/resources` (sidebar → Resources) có 7 view giống bảng Notion "All Resources":
Videos, Books, Article/News/Post, Course, Topics (nhóm theo topic), not yet finished, All Resources.

Công cụ giống trang Tasks:
- **Tab view:** kéo để đổi thứ tự, dùng nút **+** để thêm view mới. Bấm vào tab đang mở để đổi tên, nhân bản, ẩn/xoá view hoặc đưa view về mặc định.
- **Thanh công cụ:**
  - Bố cục Bảng / Thẻ.
  - Cột: kéo thứ tự, ẩn/hiện.
  - Sắp xếp nhiều mức.
  - Nhóm theo Loại / Topics / Projects / Areas / Reviews / Xong / Creator. Nhóm thu gọn được và hiện tổng thời gian.
  - Bộ lọc theo mọi trường. Thêm bộ lọc là ô chọn giá trị mở ra ngay.
- **Bảng:**
  - Sửa tại chỗ mọi ô.
  - Bấm tiêu đề cột để sắp xếp, dời trái/phải hoặc ẩn cột. Kéo tiêu đề để đổi chỗ cột.
  - Chọn nhiều dòng (giữ Shift để chọn dải) rồi đánh dấu xong, lưu trữ hoặc xoá.
- **Dòng "Mới":**
  - Gõ tên rồi Enter là thêm tài nguyên. Tài nguyên mới tự nhận giá trị theo bộ lọc của view và theo nhóm đang đứng: ở Videos thì Loại = Video, ở nhóm Fitness thì Area = Fitness.
  - Dán link cũng được: app tự đoán loại (YouTube → Video, Udemy/Coursera → Course…). Với link video, app tự điền tên và kênh qua noembed.com. Không lấy được thì giữ link rút gọn làm tên.
- **Trang chi tiết (nút "Mở" hoặc nút "Mới"):**
  - Có ảnh xem trước YouTube, sao đánh giá, ô ghi chú.
  - Nút **Tạo task** tạo task "Xem: …" hoặc "Đọc: …", kèm link.
- **Cấu hình và lưu trữ:**
  - Cấu hình các view lưu trong `ui_prefs` (key `resources-view`), nên đồng bộ giữa các máy.
  - Tài nguyên đã lưu trữ không hiện trong các view. Muốn khôi phục thì vào trang **Archives**.

### 9.30. Tìm task trong view + Task lặp lại ("Duplicate every…")

**Tìm task.** Mỗi mục của trang Tasks (Tasks List, Work Schedule, Work Summary) và khối Tasks trong trang Project/Area đều có ô **Tìm task trong view**:
- Tìm theo tên và ghi chú, không phân biệt dấu ("viet bao" vẫn ra "Viết báo cáo").
- Chỉ lọc trong view đang mở; phần tiêu đề hiện dạng "2/6 task khớp".
- Phím **/** để nhảy vào ô tìm, **Esc** để xoá.
- Đang tìm thì không kéo sắp xếp task được, để tránh xếp sai thứ tự.

**Task lặp lại.** Cần chạy migration `0016_recurring_tasks.sql`.
- Trong trang chi tiết task có trường **Lặp lại**. Các chu kỳ: Mỗi ngày · Ngày thường (T2–T6) · Mỗi tuần · 2 tuần · Mỗi tháng · 3 tháng · 6 tháng · Mỗi năm. Chọn xong sẽ hiện "Lần tới: …". Muốn tắt thì chọn **Không lặp nữa**.
- Bảng task có thêm cột **Lặp lại**, mặc định ẩn; bật trong menu Cột. Tên task lặp có icon 🔁. Bản sao có icon mờ và dòng "Bản lặp lại ngày …".
- Cách tạo bản sao: mỗi khi mở app, quay lại tab (tối đa 5 phút/lần) hoặc cứ 30 phút, app gọi hàm `generate_recurring_tasks(p_tz, p_offset_min)`. Hàm tính ngày theo múi giờ trình duyệt; nếu database không biết tên múi giờ thì dùng độ lệch phút.
  - Bản sao giữ tên, ghi chú, Area, Project, Quan trọng, Gấp, Năng lượng. Ngày bắt đầu và hạn được dời sang ngày lặp, giữ nguyên giờ.
  - Task gốc không có ngày → bản sao có hạn là cuối ngày lặp.
  - Lâu không mở app → chỉ tạo **bản gần nhất**, không dồn cả chục bản quá hạn.
  - Không bao giờ tạo trùng: có `repeat_last_on` và unique index. Xoá một bản sao thì bản đó không bị tạo lại.
- Cột mới trong bảng `tasks`:

  | Cột | Ý nghĩa |
  |---|---|
  | `repeat_rule` | Chu kỳ lặp |
  | `repeat_anchor` | Mốc tính chu kỳ; trigger tự đặt khi chọn hoặc đổi chu kỳ |
  | `repeat_last_on` | Ngày của bản sao gần nhất đã tạo |
  | `repeat_parent_id` | Bản sao trỏ về task gốc |
  | `repeat_on` | Ngày lặp của bản sao |

### 9.31. Thêm task trong view → Bắt đầu = bây giờ

Thêm task ngay trong view, ở dòng "+ Thêm task" của bảng, trong một nhóm, ở danh sách mobile hay khối Tasks của trang Project/Area, thì task mới có **Bắt đầu = thời điểm thêm**. Hạn vẫn suy ra từ view như trước.
- View đang lọc "Bắt đầu trống" thì task mới không được gán ngày bắt đầu.
- Trên lịch xếp theo Hạn: ngày bắt đầu cũng là bây giờ. Nếu thêm vào một ngày đã qua thì ngày bắt đầu là đầu ngày đó, để không bắt đầu sau hạn.
- Trên lịch xếp theo Bắt đầu: ngày bắt đầu là ngày đã chọn, như trước.

### 9.32. Task lặp chạy trên server + Channel (bot Telegram đẩy thông báo task)

**Cài đặt, làm 1 lần trong Supabase:**
1. Bật **pg_cron**: Dashboard → Integrations → Cron → Enable.
2. Bật **pg_net**: Dashboard → Database → Extensions → pg_net.
3. Chạy `0017_recurring_on_server.sql` rồi `0018_telegram_channel.sql` trong SQL Editor. Chưa bật extension thì 2 file vẫn chạy được, chỉ chưa lên lịch; bật xong thì chạy lại.
4. Kiểm tra lịch đã có chưa: `select jobname, schedule, active from cron.job;`. Kết quả cần có `paradonext-recurring` (mỗi 10 phút), `paradonext-telegram` (mỗi phút) và `paradonext-cleanup` (mỗi ngày).

**Task lặp trên server (0017).**
- `cron_generate_recurring()` chạy mỗi 10 phút, tạo bản sao cho mọi người dùng theo múi giờ của từng người. Nhờ vậy bản sao có đúng giờ kể cả khi không mở app.
- Múi giờ lưu trong `user_settings`; app tự lưu mỗi khi mở. Nếu database không biết tên múi giờ (vd `Asia/Saigon`) thì dùng độ lệch phút.
- Hàm lõi `generate_recurring_for` và hàm cron đã bị thu quyền gọi từ app. App chỉ gọi được `generate_recurring_tasks`, và hàm này chỉ làm việc với tài khoản đang đăng nhập.
- Thêm cột `tasks.remind_at` cho trường "Nhắc lúc". Bản sao của task lặp cũng dời giờ nhắc theo.

**Channel (0018, trang `/channel` trên sidebar).**
- **Kết nối:**
  - Dán token bot (tạo với @BotFather) → **Kiểm tra** (gọi `getMe`).
  - Mở bot trên Telegram, bấm Start → **Tìm chat** (gọi `getUpdates`). Chat ID nhập tay cũng được, kể cả nhóm hoặc kênh.
  - **Gửi tin thử** → **Lưu kết nối**. Ba bước này gọi thẳng Telegram từ trình duyệt.
- **Lịch thông báo:**
  - Tóm tắt theo nhiều giờ, mỗi giờ chọn "Việc hôm nay" (có cả quá hạn) hoặc "Việc ngày mai".
  - Chọn ngày trong tuần, và có thể bỏ qua khi không có task.
  - Nhắc trước hạn: Tắt, đúng giờ, hoặc 5 phút → 1 ngày; chỉ áp dụng cho task có giờ hạn cụ thể.
  - Nhắc khi tới giờ bắt đầu; bỏ qua task vừa tạo với "bắt đầu = bây giờ".
  - **Nhắc lúc** riêng từng task: đặt trong trang chi tiết task.
- **Cách gửi:** `push_task_notifications()` chạy mỗi phút, gửi bằng `pg_net` tới `api.telegram.org`.
  - Mỗi thông báo ghi vào `notification_log` trước khi gửi, nên không bao giờ gửi trùng. Đổi giờ hạn/nhắc thì sẽ nhắc lại theo giờ mới.
  - Tóm tắt chỉ gửi trong 30 phút sau giờ đặt, để lỡ lịch lâu thì không gửi dồn.
  - Mỗi người tối đa 15 tin mỗi phút.
- **Đã gửi gần đây:** 20 tin mới nhất, kèm kết quả Telegram trả về (chấm xanh = đã tới, chấm đỏ = lỗi, bấm để xem chi tiết). Nút **Gửi tóm tắt hôm nay ngay** gửi qua đường server để kiểm tra pg_net.
- **Bảo mật:** token nằm trong bảng `telegram_channels` có RLS, chỉ chính bạn đọc được. Các hàm gửi tin và hàm cron không gọi được từ app.

### 9.33. Habits · Weekly Review · Stats

Chạy `0019_habits_review.sql` trong SQL Editor. Phần Telegram trong file này cần 0018; nếu chưa có 0018 thì file tự bỏ qua phần đó.

**Habits (`/habits`)**
- Bảng tuần T2 → CN, bấm ô tròn để tick. Ô viền nét đứt là ngày nghỉ (không bắt buộc). Có nút xem tuần trước/sau và tiến độ "Hôm nay x/y".
- 🔥 **Chuỗi** chỉ đếm những ngày cần làm liên tiếp đã tick. Ngày nghỉ không làm đứt chuỗi, và hôm nay chưa tick cũng chưa tính là đứt. Có thêm tỉ lệ 30 ngày và chuỗi dài nhất.
- Bấm tên thói quen để mở chi tiết:
  - Bản đồ nhiệt 16 tuần (rê chuột xem ngày, bấm để tick bù).
  - Đổi icon, tên, ngày cần làm (T2–T6 / Mỗi ngày / tuỳ chọn), Area.
  - Lưu trữ hoặc xoá.
- Bảng `habits` (thói quen) và `habit_logs` (1 dòng = 1 ngày đã làm).

**Weekly Review (`/review`)**: sổ review mỗi tuần, không liên quan tới bot.
- **Viết review tuần này** mở trang viết. Dùng ‹ › để chuyển sang tuần khác, kể cả viết bù tuần cũ.
- Mỗi bài review gồm: đánh giá 1–5 sao, và 4 ô "Điều gì tốt?", "Cần làm khác đi?", "Tuần tới tập trung vào đâu?", "Ghi chú thêm".
- Số liệu tuần (task xong, thời gian ghi nhận, % thói quen) tính tự động và được lưu kèm, nên xem lại về sau vẫn còn.
- **Xem lại theo 3 chế độ:**
  - **Thẻ:** mỗi tuần 1 thẻ.
  - **Bảng:** các cột Tuần / Đánh giá / Điều tốt / Cần làm khác / Trọng tâm / Task xong.
  - **Dòng thời gian:** nhóm theo tháng, hiện đủ nội dung.
- Có ô tìm kiếm (gõ không dấu cũng được), lọc theo năm, và đổi thứ tự mới ↔ cũ. Chế độ xem được lưu và đồng bộ giữa các máy (key `reviews-view` trong `ui_prefs`).
- Bảng `weekly_reviews`, mỗi tuần 1 dòng. Các cột mới: `rating`, `notes`, `stats`.

**Stats (`/stats`)**
- Bộ lọc 7 ngày / 30 ngày / 12 tuần, và chọn số liệu Số task hoặc Thời gian. Bộ lọc áp dụng cho mọi số liệu trên trang.
- Các ô số liệu: task hoàn thành và thời gian (có % so với kỳ trước), trung bình mỗi ngày, % thói quen đạt, số task đang quá hạn.
- Biểu đồ:
  - Cột theo ngày/tuần; rê chuột xem số, có nút "Xem dạng bảng".
  - Phân bổ theo Area / Project / Năng lượng (tối đa 8 dòng, còn lại gộp vào "Khác").
  - Giờ trong ngày và ngày trong tuần bạn hay hoàn thành việc.
- Biểu đồ vẽ bằng HTML thuần, không thêm thư viện. Dùng 1 màu `--chart`, đã kiểm tra độ tương phản với nền ở cả chế độ sáng và tối.

**Telegram (Channel)**
- Bản tóm tắt "Việc hôm nay" có thêm phần 🔁 Thói quen (✅/⬜); tắt được bằng công tắc "Kèm thói quen".
- Bản trước từng có tính năng nhắc Weekly Review qua bot; đã gỡ bỏ. Chạy lại `0019` thì file tự xoá lịch, hàm và cột cũ nếu đã cài.

### 9.34. Review: tab "Tổng quan tuần" (view Task & Project) + bộ lọc ngày mới

Chạy `0020_review_views.sql` trong SQL Editor.

Trang Review có 2 tab: **Tổng quan tuần** (mặc định) và **Sổ review** (xem 9.33).

**Tổng quan tuần** gồm:
- **Ô số liệu:** task đã xong, thời gian ghi nhận, task đang quá hạn, số project hoàn thành trong tuần, % thói quen đạt.
- **Task:** bộ view riêng (section `review`), dùng đầy đủ công cụ như trang Tasks (lọc, sắp xếp, nhóm, ẩn/kéo cột, kéo tab, tìm, lịch, lưu view mới). 7 view có sẵn:

  | View | Hiện gì |
  |---|---|
  | Xong tuần này | Task hoàn thành trong tuần, mới xong trước |
  | Chưa xong tuần này | Task có hạn trong tuần mà chưa xong |
  | Quá hạn | Task chưa xong đã qua hạn |
  | Xong tuần trước | Để so sánh với tuần này |
  | Xong theo Area | Task xong tuần này, nhóm theo Area |
  | Lịch tuần · Lịch tháng | Mọi task theo hạn |

- **Projects** có 5 view: Đang chạy · Hoàn thành tuần này · Đã hoàn thành · Quá deadline · Chưa có việc tiếp theo.
  - Mỗi dòng có Area, Deadline, Status (đổi ngay tại chỗ), tiến độ task và giờ hoàn thành.
  - Cột mới `projects.completed_at` được trigger tự điền khi project chuyển sang Completed và tự xoá khi bỏ Completed. Project đã hoàn thành từ trước lấy lần sửa cuối làm mốc.
- **Thói quen tuần này:** lưới T2 → CN kèm % đạt.
- **Ghi chú tuần này:** kèm cảnh báo những ghi chú chưa gắn Area/Project.
- **Tài nguyên tuần này:** tài nguyên mới lưu hoặc đã xem xong trong tuần.

**Bộ lọc ngày mới** dùng được cho mọi view Task, kể cả trang Tasks, cho các trường Hạn, Bắt đầu, Kết thúc: Hôm qua · Tuần trước · Tháng này · Tháng trước. View lọc theo khoảng thời gian đã qua (hôm qua, tuần trước, tháng trước) thì không cho thêm task nhanh.

### 9.3. Trạng thái hiện tại

| Phần | Trạng thái |
|---|---|
| Schema Supabase (`supabase/migrations/`) | ✅ Đã viết (0001 → 0020), cần tự chạy trong SQL Editor theo thứ tự |
| Kết nối Supabase qua Settings UI | ✅ Xong |
| Auth (đăng nhập/đăng ký) | ✅ Xong (email/password) |
| Task View query engine | ✅ Xong, đọc được dữ liệu thật |
| Tạo/sửa/xoá Task (CRUD) | ✅ Xong — thao tác kiểu Notion (xem 9.4) |
| Tự tính thời gian làm | ✅ Xong (xem 9.5) |
| Bộ lọc & sắp xếp, lưu view | ✅ Xong (xem 9.6) |
| Chọn nhiều, nhân bản, xoá hàng loạt + hoàn tác | ✅ Xong (xem 9.7) |
| Inbox + AI xử lý (mục 5.1) | ⏳ Chưa làm |
| Quick Start / Focus (mục 5.2, 5.4) | ⏳ Chưa làm |
| Kéo thả sắp thứ tự (1 hoặc nhiều task) | ✅ Xong (xem 9.8) |
| Ghi chú cho từng view | ✅ Xong (xem 9.9) |
| 📅 Work Schedule (lịch tuần/tháng) | ✅ Xong (xem 9.10) |
| ✅ Tasks List + nhóm task (Group by) | ✅ Xong (xem 9.11) |
| ⚡ Năng lượng Flow/Quick/Easy/Personal | ✅ Xong (xem 9.12) |
| Kéo sắp xếp / ẩn hiện cột, kéo tab view | ✅ Xong (xem 9.13) |
| Sidebar thu gọn, vùng làm việc rộng hơn | ✅ Xong (xem 9.14) |
| Bộ chọn ngày giờ kiểu Notion | ✅ Xong (xem 9.15) |
| Nút "Làm ngay" (bắt đầu = bây giờ) | ✅ Xong (xem 9.16) |
| Notes + Ghi chú nhanh (phím N) | ✅ Xong (xem 9.17) |
| Thanh "Đang làm" với đồng hồ | ✅ Xong (xem 9.18) |
| Areas / Projects / Archives | ✅ Xong (xem 9.19) |
| Ghi chú → Task | ✅ Xong (xem 9.20) |
| Projects: 7 view, dạng thẻ, Hạn | ✅ Xong (xem 9.21) |
| Trang Project kiểu Notion (Status chọn nhiều) | ✅ Xong (xem 9.22) |
| Icon emoji/ảnh + khối view Tasks/Notes trong trang | ✅ Xong (xem 9.23) |
| Khối Tasks trong Project/Area đầy đủ tính năng view | ✅ Xong (xem 9.24) |
| Trang Areas: lọc, sắp xếp, kéo/ẩn cột, bảng/thẻ | ✅ Xong (xem 9.25) |
| Đồng bộ cấu hình view Areas/Projects giữa các máy | ✅ Xong (xem 9.26) |
| Sửa: Project mới không hiện ở trang Projects | ✅ Xong (xem 9.27) |
| Projects: thẻ/bảng hiện Area·Deadline·Status; Status chọn 1 | ✅ Xong (xem 9.28) |
| Resources: 7 view, lọc/sắp xếp/nhóm/cột, dán link tự điền | ✅ Xong (xem 9.29) |
| Tìm task trong view · Task lặp lại (Day/Week/Month…) | ✅ Xong (xem 9.30) |
| Thêm task trong view: Bắt đầu = bây giờ | ✅ Xong (xem 9.31) |
| Task lặp trên server (pg_cron) · Channel Telegram nhắc việc | ✅ Xong (xem 9.32) |
| Habits · Weekly Review · Stats | ✅ Xong (xem 9.33) |
| Review: Tổng quan tuần (view Task/Project, thói quen, ghi chú) | ✅ Xong (xem 9.34) |

---

## 10. Các Bước Tiếp Theo (Đề Xuất)

1. ~~Scaffold code (Vite + React + Tailwind + Supabase)~~ ✅
2. ~~Viết schema database + RLS~~ ✅
3. ~~Auth (đăng nhập/đăng ký)~~ ✅
4. ~~Task View query engine~~ ✅
5. ~~Thêm/sửa/xoá Task (CRUD)~~ ✅
6. Xây Inbox + luồng AI xử lý (mục 5.1)
7. Định nghĩa cụ thể hành vi "Quick Start" và "Focus" (mục 5.2, 5.4), thiết kế prompt AI
8. ~~Dựng Projects/Areas/Resources CRUD~~ ✅
9. ~~Drag & Drop~~ ✅
