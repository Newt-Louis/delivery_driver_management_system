---
name: task-workflow
description: Workflow quy tắc quản lý và báo cáo nhiệm vụ lớn qua PLAN.md / DETAIL_PLAN.md / AGENTS.md trong dự án này.
source: auto-skill
extracted_at: '2026-07-03T09:17:15.853Z'
---

## Quy tắc

Mỗi **nhiệm vụ lớn** trong `PLAN.md` khi bắt đầu thực hiện sẽ có một **kế hoạch chi tiết** trong `DETAIL_PLAN.md`. Sau khi hoàn thành tất cả bước chi tiết, đánh dấu `[COMPLETED]` trong PLAN.md và ghi báo cáo ngắn vào AGENTS.md.

## Trước khi bắt đầu

1. Đọc `PLAN.md` để xác định nhiệm vụ lớn tiếp theo (chưa có `[COMPLETED]`).
2. Đọc `AGENTS.md` để hiểu bối cảnh và quy tắc dự án.
3. Quét cấu trúc project và các file liên quan trước khi code.

## Kế hoạch chi tiết — DETAIL_PLAN.md

Mỗi dòng đầu việc dùng ký hiệu trạng thái:

- `[]` — Chưa thực hiện
- `[v]` — Đã hoàn thành
- `[x]` — Không thể hoàn thành

Ví dụ:

```markdown
# Nhiệm vụ N: <tên nhiệm vụ>

## Kế hoạch chi tiết

- [] Bước 1: <mô tả>
- [] Bước 2: <mô tả>
- [] Bước 3: <mô tả>

## Files cần sửa

- `path/to/file1`
- `path/to/file2`
```

## Sau khi hoàn thành

1. Đánh dấu `[COMPLETED]` ở cuối dòng nhiệm vụ lớn trong `PLAN.md`.
2. **Clear** toàn bộ nội dung `DETAIL_PLAN.md` (để trống cho nhiệm vụ tiếp theo).
3. Ghi báo cáo ngắn gọn vào AGENTS.md trong section `### Báo Cáo Tính Năng Đã Hoàn Thành`, theo format:

```markdown
### YYYY-MM-DD - <tên tính năng>

- Bullet point mô tả thay đổi chính.
- Đã chạy `npm run build` trong <backend/frontend>.
```
