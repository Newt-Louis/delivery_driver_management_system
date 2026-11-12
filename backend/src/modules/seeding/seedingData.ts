/**
 * Static sample data for simulation seeding. Vendor codes are fixed so testers
 * can copy any of them into the Auto Warehouse vendor list of a unit; matching
 * registrations then resolve to AUTO_WAREHOUSE exactly like the real flow.
 */
export const DEMO_VENDORS: ReadonlyArray<{ vendorCode: string; vendorName: string }> = [
  { vendorCode: 'NCC10001', vendorName: 'Công ty TNHH Thực Phẩm Sài Gòn Xanh' },
  { vendorCode: 'NCC10002', vendorName: 'Công ty CP Sữa Đồng Nai' },
  { vendorCode: 'NCC10003', vendorName: 'Công ty TNHH Rau Sạch Đà Lạt' },
  { vendorCode: 'NCC10004', vendorName: 'Công ty CP Thủy Hải Sản Miền Tây' },
  { vendorCode: 'NCC10005', vendorName: 'Công ty TNHH Thịt Sạch Bình Dương' },
  { vendorCode: 'NCC10006', vendorName: 'Công ty CP Bánh Kẹo Hoàng Gia' },
  { vendorCode: 'NCC10007', vendorName: 'Công ty TNHH Nước Giải Khát Phương Nam' },
  { vendorCode: 'NCC10008', vendorName: 'Công ty CP Hóa Mỹ Phẩm Sao Mai' },
  { vendorCode: 'NCC10009', vendorName: 'Công ty TNHH Gia Dụng Minh Phát' },
  { vendorCode: 'NCC10010', vendorName: 'Công ty CP Trứng Gia Cầm Long An' },
  { vendorCode: 'NCC10011', vendorName: 'Công ty TNHH Trái Cây Nhiệt Đới' },
  { vendorCode: 'NCC10012', vendorName: 'Công ty CP Gạo Đồng Tháp' },
  { vendorCode: 'NCC10013', vendorName: 'Công ty TNHH Văn Phòng Phẩm An Khang' },
  { vendorCode: 'NCC10014', vendorName: 'Công ty CP Điện Máy Thành Đạt' },
  { vendorCode: 'NCC10015', vendorName: 'Công ty TNHH Thời Trang Việt Tiến Phát' },
  { vendorCode: 'NCC10016', vendorName: 'Công ty CP Đồ Chơi Trẻ Em Tuổi Thơ' },
  { vendorCode: 'NCC10017', vendorName: 'Công ty TNHH Bao Bì Phú Thịnh' },
  { vendorCode: 'NCC10018', vendorName: 'Công ty CP Nội Thất Hòa Bình' },
  { vendorCode: 'NCC10019', vendorName: 'Công ty TNHH Xây Dựng Nam Việt' },
  { vendorCode: 'NCC10020', vendorName: 'Công ty CP Cơ Điện Lạnh Toàn Cầu' },
  { vendorCode: 'NCC10021', vendorName: 'Công ty TNHH Trang Trí Nội Thất Ánh Dương' },
  { vendorCode: 'NCC10022', vendorName: 'Công ty CP Kem Lạnh Bắc Cực' },
  { vendorCode: 'NCC10023', vendorName: 'Công ty TNHH Bánh Mì Tươi Mỗi Ngày' },
  { vendorCode: 'NCC10024', vendorName: 'Công ty CP Gia Vị Hương Quê' },
  { vendorCode: 'NCC10025', vendorName: 'Công ty TNHH Nước Mắm Phú Quốc' },
  { vendorCode: 'NCC10026', vendorName: 'Công ty CP Dầu Ăn Tường An Phát' },
  { vendorCode: 'NCC10027', vendorName: 'Công ty TNHH Giấy Tissue Sài Gòn' },
  { vendorCode: 'NCC10028', vendorName: 'Công ty CP Thiết Bị Vệ Sinh Hoàng Long' },
  { vendorCode: 'NCC10029', vendorName: 'Công ty TNHH Logistics Đông Á' },
  { vendorCode: 'NCC10030', vendorName: 'Công ty CP Hàng Tiêu Dùng Việt Hưng' },
];

export const FAMILY_NAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'] as const;
export const MIDDLE_NAMES = ['Văn', 'Hữu', 'Minh', 'Đức', 'Thanh', 'Quốc', 'Công', 'Ngọc', 'Hoàng', 'Thị', 'Gia', 'Anh'] as const;
export const GIVEN_NAMES = ['An', 'Bình', 'Cường', 'Dũng', 'Hải', 'Hùng', 'Khang', 'Long', 'Minh', 'Nam', 'Phúc', 'Quang', 'Sơn', 'Tài', 'Thắng', 'Toàn', 'Trung', 'Tuấn', 'Vinh', 'Hòa', 'Lan', 'Hương', 'Mai', 'Trang'] as const;

export const PHONE_PREFIXES = ['090', '091', '093', '094', '096', '097', '098', '086', '032', '033', '035', '037', '038', '039', '070', '076', '077', '078', '079', '081', '083', '084', '085', '088'] as const;

export const PLATE_PROVINCES = ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '70', '72', '29', '30', '43', '92'] as const;
export const TRUCK_PLATE_SERIES = ['C', 'D', 'H', 'LD'] as const;
export const MOTORBIKE_PLATE_SERIES = ['B', 'D', 'F', 'G', 'H', 'K', 'L', 'M', 'N', 'P', 'S', 'T', 'U', 'V', 'X', 'Y', 'Z'] as const;

export const CONSTRUCTION_CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CONSTRUCTION_CODE_CHARS = `${CONSTRUCTION_CODE_LETTERS}23456789`;
