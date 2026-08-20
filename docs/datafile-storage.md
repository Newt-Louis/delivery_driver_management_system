# Datafile Storage

## Mục Tiêu

Hệ thống có storage nội bộ để lưu logo/avatar của `BusinessLocation`, logo của `UnitConfig`, và các file upload khác có thể phát sinh sau này.

Storage này không thay thế cấu hình hiển thị hiện tại:

- `business_locations.logo_url` và `business_locations.avatar_url` vẫn là ảnh đang được location sử dụng.
- `unit_configs.logo_url` vẫn là ảnh đang được đơn vị sử dụng.
- `uploaded_files` là bảng metadata quản lý file đã upload để sau này có thể xây giao diện xem/chọn/xóa/audit file.

## Cấu Hình

Biến môi trường backend:

```env
DATAFILE_ROOT=../datafile
DATAFILE_MAX_UPLOAD_BYTES=104857600
JSON_BODY_LIMIT=15mb
```

Nếu không set `DATAFILE_ROOT`, backend mặc định dùng thư mục `datafile` ở root repo. Khi chạy Docker production, mount volume host vào container, ví dụ:

```yaml
DATAFILE_ROOT: /app/datafile
volumes:
  - ./datafile:/app/datafile
```

Backend tạo sẵn ba thư mục gốc:

```text
datafile/
  tmp/
  uploads/
  templates/
```

## Cấu Trúc Upload

File thuộc khu vực:

```text
uploads/<locationCode>/<yyyy>/<mm>/<dd>/<storedFileName>
```

File thuộc đơn vị:

```text
uploads/<locationCode>/<unitCode>/<yyyy>/<mm>/<dd>/<storedFileName>
```

Ví dụ:

```text
uploads/THISKY_Q7/2026/08/20/20260820103022-a1b2c3d4-logo.png
uploads/THISKY_Q7/EMART/2026/08/20/20260820103110-e5f6a7b8-emart.png
```

API trả `publicUrl` dạng:

```text
/datafile/uploads/THISKY_Q7/EMART/2026/08/20/20260820103110-e5f6a7b8-emart.png
```

Frontend Docker/nginx và Vite dev proxy `/datafile` về backend giống `/api`.

Khi Superadmin tạo mới `BusinessLocation`, backend tạo sẵn thư mục `uploads/<locationCode>`. Khi tạo mới `UnitConfig`, backend tạo sẵn thư mục `uploads/<locationCode>/<unitCode>`. Các thư mục năm/tháng/ngày được tạo khi file đầu tiên được upload vào scope đó.

## API

Route upload:

```http
POST /api/files/upload
Content-Type: multipart/form-data
```

Quyền:

- `SUPERADMIN`: upload cho mọi location/unit.
- `ADMIN_LOC`: upload cho location/unit thuộc `businessLocationId` của mình.

Multipart fields:

```text
scope=UNIT_CONFIG
category=LOGO
unitConfigId=unit_config_id
originalName=emart-logo.png
file=<binary file field>
```

Với file location:

```text
scope=BUSINESS_LOCATION
category=AVATAR
businessLocationId=business_location_id
originalName=avatar.png
file=<binary file field>
```

Logo/avatar hiện chỉ nhận PNG, JPG, WebP hoặc GIF. Không nhận SVG upload để tránh rủi ro script trong SVG public cùng origin. File upload dùng multipart streaming, không dùng JSON/base64; `JSON_BODY_LIMIT` không chi phối file upload.

## Database

Model chính:

- `UploadedFile`
  - `scope`: `BUSINESS_LOCATION` hoặc `UNIT_CONFIG`
  - `category`: `LOGO`, `AVATAR`, `DOCUMENT`, `TEMPLATE`, `TMP`, `OTHER`
  - `businessLocationId`
  - `unitConfigId`
  - `uploadedById`
  - `originalName`, `storedName`, `mimeType`, `sizeBytes`
  - `relativePath`: ví dụ `uploads/THISKY_Q7/EMART/2026/08/20/logo.png`
  - `publicUrl`: ví dụ `/datafile/uploads/THISKY_Q7/EMART/2026/08/20/logo.png`
  - `checksumSha256`
  - `metadata`

`relativePath` là unique để tránh metadata trỏ trùng một file vật lý.
