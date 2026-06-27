import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { validate, type ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';

// ── Report shapes (tự nằm trong { data } do TransformInterceptor) ──
export type ImportAction = 'create' | 'update' | 'error';

export interface ImportRowReport {
  /** Số thứ tự dòng dữ liệu (1-based, đã loại header) */
  rowNo: number;
  /** SKU cell gốc — để định danh dòng dù lỗi */
  sku: string;
  /** Tên SP cell gốc */
  name: string;
  action: ImportAction;
  /** Rỗng khi action là create/update */
  errors: string[];
}

export interface ImportReport {
  summary: {
    total: number;
    valid: number;
    invalid: number;
    created: number; // preview = 0
    updated: number; // preview = 0
    failed: number;
    skipped: number; // dự phòng, hiện = 0
  };
  rows: ImportRowReport[];
}

type CellPrimitive = string | number | boolean | null;

type ImportFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
};

const MAX_ROWS = 500;

/**
 * Định nghĩa cột mẫu Excel: header tiếng Việt (không dấu cho dễ khớp) → field.
 * `categoryName` là field trung gian để resolve sang `categoryId`.
 */
const COLUMNS = [
  { field: 'name', header: 'Ten san pham', required: true },
  { field: 'description', header: 'Mo ta', required: true },
  { field: 'price', header: 'Gia ban', required: true },
  { field: 'sku', header: 'SKU', required: true },
  { field: 'categoryName', header: 'Danh muc', required: true },
  { field: 'stock', header: 'Ton kho', required: true },
  { field: 'salePrice', header: 'Gia khuyen mai', required: false },
  { field: 'shortDesc', header: 'Mo ta ngan', required: false },
  { field: 'tags', header: 'Tags', required: false },
  { field: 'allergens', header: 'Di ung', required: false },
  { field: 'origin', header: 'Xuat xu', required: false },
  { field: 'ingredients', header: 'Nguyen lieu', required: false },
  { field: 'images', header: 'Hinh anh', required: false },
  { field: 'minStock', header: 'Ton kho toi thieu', required: false },
  { field: 'unit', header: 'Don vi', required: false },
  { field: 'isActive', header: 'Dang ban', required: false },
] as const;

type ColumnField = (typeof COLUMNS)[number]['field'];

@Injectable()
export class ProductsImportService {
  private readonly logger = new Logger(ProductsImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  // ── TEMPLATE ──────────────────────────────────────────────────────
  /** Sinh buffer .xlsx mẫu: sheet "SanPham" (header) + sheet "HuongDan". */
  async generateImportTemplateBuffer(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'VegiFlow Admin';
    wb.created = new Date();

    const ws = wb.addWorksheet('SanPham');
    ws.columns = COLUMNS.map((c) => ({
      header: c.header,
      key: c.field,
      width: 20,
    }));
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle' };
    // Tô màu header bắt buộc để người dùng nhận biết.
    COLUMNS.forEach((c) => {
      if (c.required) {
        const colIndex = COLUMNS.indexOf(c) + 1;
        const cell = headerRow.getCell(colIndex);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF3CD' },
        };
      }
    });

    // Sheet hướng dẫn + danh mục hợp lệ (lấy live từ DB).
    const guide = wb.addWorksheet('HuongDan');
    guide.getColumn(1).width = 26;
    guide.getColumn(2).width = 70;
    const title = guide.addRow(['HƯỚNG DẪN ĐIỀN', '']);
    title.font = { bold: true, size: 13 };
    guide.addRow([]);
    guide.addRow(['Cột', 'Mô tả']);
    guide.addRow([
      'Ten san pham (*)',
      'Tên sản phẩm (bắt buộc). slug tự sinh từ tên.',
    ]);
    guide.addRow(['Mo ta (*)', 'Mô tả chi tiết (bắt buộc).']);
    guide.addRow(['Gia ban (*)', 'Giá VND, số ≥ 0 (bắt buộc).']);
    guide.addRow(['SKU (*)', 'Mã sản phẩm, duy nhất (bắt buộc). Trùng → ghi đè.']);
    guide.addRow(['Danh muc (*)', 'TÊN danh mục, đúng như danh sách bên dưới.']);
    guide.addRow(['Ton kho (*)', 'Tồn kho, số ≥ 0 (bắt buộc).']);
    guide.addRow(['Gia khuyen mai', 'Giá KM VND, số ≥ 0 (để trống nếu không).']);
    guide.addRow(['Mo ta ngan', 'Mô tả ngắn cho chatbot.']);
    guide.addRow(['Tags', 'Phân tách bởi dấu phẩy. VD: organic, vegan']);
    guide.addRow(['Di ung', 'Chất gây dị ứng, phân tách bởi dấu phẩy.']);
    guide.addRow(['Xuat xu', 'Nguồn gốc.']);
    guide.addRow(['Nguyen lieu', 'Thành phần.']);
    guide.addRow([
      'Hinh anh',
      'URL ảnh, phân tách bởi dấu phẩy. Phải là URL đầy đủ.',
    ]);
    guide.addRow(['Ton kho toi thieu', 'Ngưỡng tồn kho tối thiểu (mặc định 10).']);
    guide.addRow(['Don vi', 'Đơn vị (mặc định "cái").']);
    guide.addRow(['Dang ban', 'true/false (mặc định true).']);
    guide.addRow([]);
    const catTitle = guide.addRow([
      'DANH MỤC HỢP LỆ (điền đúng một tên sau vào cột "Danh muc")',
      '',
    ]);
    catTitle.font = { bold: true };
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    categories.forEach((c) => guide.addRow([c.name, '']));

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ── PREVIEW (dry-run, KHÔNG ghi DB) ───────────────────────────────
  async previewImport(file: ImportFile | undefined): Promise<ImportReport> {
    const { workbook } = await this.loadWorkbook(file);
    return this.parseAndValidate(workbook, { persist: false });
  }

  // ── CONFIRM (parse + validate + persist upsert theo SKU) ──────────
  async confirmImport(file: ImportFile | undefined): Promise<ImportReport> {
    const { workbook } = await this.loadWorkbook(file);
    return this.parseAndValidate(workbook, { persist: true });
  }

  // ── Core: parse + validate (+ tùy chọn persist) ───────────────────
  private async parseAndValidate(
    workbook: ExcelJS.Workbook,
    opts: { persist: boolean },
  ): Promise<ImportReport> {
    const ws = workbook.worksheets[0];
    if (!ws) {
      throw new BadRequestException('File không có sheet dữ liệu');
    }

    const headerMap = this.readHeaderMap(ws);
    const dataRows = this.readDataRows(ws, headerMap);

    const categoryMap = await this.buildCategoryMap();

    const rows: ImportRowReport[] = [];
    let created = 0;
    let updated = 0;

    for (const dataRow of dataRows) {
      const mapped = this.mapRowToDto(dataRow.cells, categoryMap);
      const report: ImportRowReport = {
        rowNo: dataRow.rowNo,
        sku: mapped.rawSku,
        name: mapped.rawName,
        action: 'error',
        errors: [],
      };

      // Lỗi thân thiện cho các trường bắt buộc dạng chuỗi (class-validator
      // cho phép chuỗi rỗng nên phải kiểm tra tay).
      if (!mapped.rawName) report.errors.push('Thiếu "Ten san pham"');
      if (!mapped.rawDescription) report.errors.push('Thiếu "Mo ta"');
      if (!mapped.rawSku) report.errors.push('Thiếu "SKU"');
      if (mapped.categoryError) report.errors.push(mapped.categoryError);

      // Validate qua đúng CreateProductDto (số, URL, mảng, ...).
      const validationErrors = await validate(mapped.dto, { whitelist: true });
      if (validationErrors.length) {
        report.errors.push(...this.flattenErrors(validationErrors));
      }

      if (report.errors.length) {
        rows.push(report);
        continue;
      }

      // Hợp lệ.
      if (opts.persist) {
        try {
          const existing = await this.prisma.product.findUnique({
            where: { sku: mapped.dto.sku },
            select: { id: true },
          });
          if (existing) {
            await this.productsService.updateNoBlock(existing.id, mapped.dto);
            report.action = 'update';
            updated++;
          } else {
            await this.productsService.createNoBlock(mapped.dto);
            report.action = 'create';
            created++;
          }
        } catch (error) {
          report.action = 'error';
          report.errors.push(
            error instanceof Error ? error.message : String(error),
          );
        }
      } else {
        // Preview: chỉ đọc để phân loại create/update, không ghi.
        const existing = await this.prisma.product.findUnique({
          where: { sku: mapped.dto.sku },
          select: { id: true },
        });
        report.action = existing ? 'update' : 'create';
      }

      rows.push(report);
    }

    const invalid = rows.filter((r) => r.action === 'error').length;
    return {
      summary: {
        total: rows.length,
        valid: rows.length - invalid,
        invalid,
        created: opts.persist ? created : 0,
        updated: opts.persist ? updated : 0,
        failed: invalid,
        skipped: 0,
      },
      rows,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private async loadWorkbook(
    file: ImportFile | undefined,
  ): Promise<{ workbook: ExcelJS.Workbook }> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Vui lòng chọn file Excel (.xlsx)');
    }
    const name = (file.originalname ?? '').toLowerCase();
    const isXlsxMime =
      file.mimetype?.includes('spreadsheet') ||
      file.mimetype?.includes('excel') ||
      file.mimetype === 'application/octet-stream';
    if (!name.endsWith('.xlsx') && !isXlsxMime) {
      throw new BadRequestException(
        'Chỉ hỗ trợ file Excel .xlsx (không hỗ trợ .xls hay .csv)',
      );
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file.buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('File Excel không hợp lệ hoặc bị hỏng');
    }
    return { workbook };
  }

  /** Đọc dòng header → map chỉ-số-cột (1-based) → field. Kiểm tra đủ cột bắt buộc. */
  private readHeaderMap(ws: ExcelJS.Worksheet): Map<number, ColumnField> {
    const headerRow = ws.getRow(1);
    const map = new Map<number, ColumnField>();
    const present = new Set<ColumnField>();

    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const text = String(this.cellValue(cell.value) ?? '').trim();
      const key = this.normKey(text);
      const col = COLUMNS.find((c) => this.normKey(c.header) === key);
      if (col && !present.has(col.field)) {
        map.set(colNumber, col.field);
        present.add(col.field);
      }
    });

    const missing = COLUMNS.filter((c) => c.required && !present.has(c.field));
    if (missing.length) {
      throw new BadRequestException(
        `Thiếu cột bắt buộc: ${missing.map((m) => `"${m.header}"`).join(', ')}`,
      );
    }
    return map;
  }

  /** Đọc các dòng dữ liệu (bỏ header, bỏ dòng rỗng). Áp giới hạn MAX_ROWS. */
  private readDataRows(
    ws: ExcelJS.Worksheet,
    headerMap: Map<number, ColumnField>,
  ): Array<{ rowNo: number; cells: Record<ColumnField, CellPrimitive> }> {
    const rows: Array<{
      rowNo: number;
      cells: Record<ColumnField, CellPrimitive>;
    }> = [];

    const lastRow = ws.rowCount;
    for (let rowNum = 2; rowNum <= lastRow; rowNum++) {
      const xRow = ws.getRow(rowNum);
      const cells = {} as Record<ColumnField, CellPrimitive>;
      let hasAny = false;

      for (const [colNumber, field] of headerMap) {
        const raw = this.cellValue(xRow.getCell(colNumber).value);
        cells[field] = raw;
        if (raw !== null && raw !== '' && String(raw).trim() !== '') {
          hasAny = true;
        }
      }

      if (!hasAny) continue; // bỏ qua dòng rỗng
      rows.push({ rowNo: rowNum - 1, cells });
    }

    if (rows.length > MAX_ROWS) {
      throw new BadRequestException(
        `Tối đa ${MAX_ROWS} dòng dữ liệu mỗi file (file hiện có ${rows.length} dòng).`,
      );
    }
    return rows;
  }

  /** Map object cells (theo field) → CreateProductDto + metadata cho báo cáo. */
  private mapRowToDto(
    cells: Record<ColumnField, CellPrimitive>,
    categoryMap: Map<string, string>,
  ): {
    dto: CreateProductDto;
    rawSku: string;
    rawName: string;
    rawDescription: string;
    categoryError?: string;
  } {
    const rawName = this.asString(cells.name).trim();
    const rawDescription = this.asString(cells.description).trim();
    const rawSku = this.asString(cells.sku).trim();

    // Resolve danh mục theo TÊN (không phân biệt dấu/hoa-thường).
    const categoryName = this.asString(cells.categoryName).trim();
    const categoryId = categoryName ? categoryMap.get(this.normKey(categoryName)) : undefined;
    const categoryError = !categoryName
      ? 'Thiếu "Danh muc"'
      : !categoryId
        ? `Danh mục "${categoryName}" không tồn tại`
        : undefined;

    const obj: Record<string, unknown> = {
      name: rawName,
      description: rawDescription,
      sku: rawSku,
      categoryId: categoryId ?? '', // tránh lỗi @IsString; lỗi thật nằm trong categoryError
      price: this.asNumber(cells.price),
      stock: this.asNumber(cells.stock),
    };

    // Các trường tùy chọn: chỉ đưa vào nếu có giá trị (để DTO/default áp dụng).
    const salePrice = this.asNumber(cells.salePrice);
    if (salePrice !== undefined) obj.salePrice = salePrice;

    const shortDesc = this.asString(cells.shortDesc).trim();
    if (shortDesc) obj.shortDesc = shortDesc;

    const tags = this.asList(cells.tags);
    if (tags.length) obj.tags = tags;

    const allergens = this.asList(cells.allergens);
    if (allergens.length) obj.allergens = allergens;

    const origin = this.asString(cells.origin).trim();
    if (origin) obj.origin = origin;

    const ingredients = this.asString(cells.ingredients).trim();
    if (ingredients) obj.ingredients = ingredients;

    const images = this.asList(cells.images);
    if (images.length) obj.images = images;

    const minStock = this.asNumber(cells.minStock);
    if (minStock !== undefined) obj.minStock = minStock;

    const unit = this.asString(cells.unit).trim();
    if (unit) obj.unit = unit;

    const isActive = this.asBool(cells.isActive);
    if (isActive !== undefined) obj.isActive = isActive;

    const dto = plainToInstance(CreateProductDto, obj, {
      enableImplicitConversion: false,
    });
    return { dto, rawSku, rawName, rawDescription, categoryError };
  }

  /** Map lowercased + bỏ dấu + chuẩn hóa khoảng trắng → dùng làm key khớp. */
  private normKey(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async buildCategoryMap(): Promise<Map<string, string>> {
    const categories = await this.prisma.category.findMany({
      select: { id: true, name: true },
    });
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(this.normKey(c.name), c.id);
    }
    return map;
  }

  private flattenErrors(errors: ValidationError[]): string[] {
    const out: string[] = [];
    for (const e of errors) {
      if (e.constraints) out.push(...Object.values(e.constraints));
      if (e.children?.length) out.push(...this.flattenErrors(e.children));
    }
    return out;
  }

  // ── exceljs cell value → primitive ────────────────────────────────
  private cellValue(val: ExcelJS.CellValue): CellPrimitive {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      return val;
    }
    if (val instanceof Date) return val.toISOString();
    const v = val as unknown as Record<string, unknown>;
    if (Array.isArray(v['richText'])) {
      return (v['richText'] as Array<{ text?: string }>)
        .map((r) => r.text ?? '')
        .join('');
    }
    if (v['result'] !== undefined && v['result'] !== null) {
      return this.cellValue(v['result'] as ExcelJS.CellValue);
    }
    if (typeof v['text'] === 'string') return v['text'];
    if (typeof v['hyperlink'] === 'string') return v['hyperlink'];
    return null;
  }

  private asString(v: CellPrimitive): string {
    if (v === null || v === undefined) return '';
    return typeof v === 'string' ? v : String(v);
  }

  private asNumber(v: CellPrimitive): number | undefined {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
    const s = String(v).trim();
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  private asList(v: CellPrimitive): string[] {
    const s = this.asString(v);
    if (!s) return [];
    return s
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  private asBool(v: CellPrimitive): boolean | undefined {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    if (!s) return undefined;
    if (['true', '1', 'yes', 'co', 'có', 'dang ban', 'ban'].includes(s)) return true;
    if (['false', '0', 'no', 'khong', 'không', 'ngung'].includes(s)) return false;
    return undefined;
  }
}
