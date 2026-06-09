import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // ── Clean existing data ──
  await prisma.chatMessage.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.storeConfig.deleteMany();
  await prisma.category.deleteMany();
  await prisma.admin.deleteMany();

  // ── Admin ──
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.admin.create({
    data: {
      username: 'admin',
      passwordHash,
      name: 'Quản trị viên',
      role: 'admin',
    },
  });
  console.log(`✅ Admin created: ${admin.username}`);

  // ── Store Config ──
  const storeConfigs = [
    { key: 'store_name', value: 'VegiFlow', label: 'Tên cửa hàng' },
    { key: 'address', value: '123 Nguyễn Huệ, Quận 1, TP.HCM', label: 'Địa chỉ' },
    { key: 'phone', value: '0900 123 456', label: 'Số điện thoại' },
    { key: 'hotline', value: '1800 6868', label: 'Hotline' },
    { key: 'email', value: 'hello@vegiflow.vn', label: 'Email' },
    { key: 'open_hours', value: 'Thứ 2 - Thứ 7: 8:00 - 21:00\nChủ nhật: 9:00 - 18:00', label: 'Giờ mở cửa' },
    { key: 'fanpage', value: 'https://facebook.com/vegiflow', label: 'Fanpage Facebook' },
    { key: 'zalo_oa', value: 'https://zalo.me/vegiflow', label: 'Zalo OA' },
    { key: 'website', value: 'https://vegiflow.vn', label: 'Website' },
    { key: 'return_policy', value: 'Đổi trả trong vòng 7 ngày nếu sản phẩm còn nguyên hộp, chưa sử dụng. Liên hệ hotline 1800 6868 để được hỗ trợ.', label: 'Chính sách đổi trả' },
    { key: 'shipping_policy', value: 'Giao hàng nội thành TP.HCM trong 2-4 giờ. Các tỉnh thành khác 2-5 ngày. Freeship đơn từ 300.000đ.', label: 'Chính sách giao hàng' },
  ];

  for (const config of storeConfigs) {
    await prisma.storeConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    });
  }
  console.log(`✅ ${storeConfigs.length} store configs created`);

  // ── Categories ──
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Thực phẩm tươi',
        slug: 'thuc-pham-tuoi',
        description: 'Rau củ, trái cây sạch đạt chuẩn VietGAP',
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Thực phẩm khô',
        slug: 'thuc-pham-kho',
        description: 'Hạt, đậu, nấm khô các loại',
        image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Gia vị',
        slug: 'gia-vi',
        description: 'Nước mắm chay, tương, gia vị khô nhập khẩu',
        image: 'https://images.unsplash.com/photo-1596547609652-9cf5d8d76921?w=200',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Thực phẩm đông lạnh',
        slug: 'dong-lanh',
        description: 'Thịt thực vật, cá chay, há cảo chay cấp đông',
        image: 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=200',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Đồ uống',
        slug: 'do-uong',
        description: 'Nước ép, trà thảo mộc, sinh tố xanh',
        image: 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=200',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Đồ ăn vặt',
        slug: 'do-an-vat',
        description: 'Snack chay, bánh healthy, hạt rang',
        image: 'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?w=200',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Thực phẩm bổ sung',
        slug: 'bo-sung',
        description: 'Vitamin, protein thực vật, siêu thực phẩm',
        image: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=200',
        isActive: true,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Món ăn sẵn',
        slug: 'mon-an-san',
        description: 'Đồ hộp chay, mì gói chay, thực phẩm tiện lợi',
        image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200',
        isActive: false,
      },
    }),
  ]);
  console.log(`✅ ${categories.length} categories created`);

  // Helper: random date in past N days
  const randomDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
    return d;
  };

  // ── Products (25+ products) ──
  const productsData = [
    // Thực phẩm tươi
    { name: 'Xà lách thủy canh', slug: 'xa-lach-thuy-canh', price: 25000, stock: 150, minStock: 50, sku: 'TP-001', unit: 'kg', tags: ['organic', 'fresh'], categoryId: categories[0].id, shortDesc: 'Xà lách thủy canh sạch, trồng không đất', origin: 'Đà Lạt' },
    { name: 'Cà rốt hữu cơ', slug: 'ca-rot-huu-co', price: 35000, stock: 45, minStock: 100, sku: 'TP-002', unit: 'kg', tags: ['organic', 'fresh'], categoryId: categories[0].id, shortDesc: 'Cà rốt hữu cơ Đà Lạt, ngọt và giòn', origin: 'Đà Lạt' },
    { name: 'Nấm đùi gà loại 1', slug: 'nam-dui-ga-loai-1', price: 55000, stock: 30, minStock: 50, sku: 'TP-003', unit: 'kg', tags: ['fresh', 'mushroom'], categoryId: categories[0].id, shortDesc: 'Nấm đùi gà tươi, giòn, ngọt', origin: 'Mộc Châu' },
    { name: 'Đậu phụ hữu cơ', slug: 'dau-phu-huu-co', price: 18000, stock: 200, minStock: 50, sku: 'TP-004', unit: 'miếng', tags: ['organic', 'tofu', 'protein'], categoryId: categories[0].id, shortDesc: 'Đậu phụ hữu cơ, làm từ đậu nành không GMO', origin: 'Việt Nam' },
    { name: 'Bắp cải xanh sạch', slug: 'bap-cai-xanh-sach', price: 20000, stock: 300, minStock: 100, sku: 'TP-005', unit: 'kg', tags: ['fresh', 'vegetable'], categoryId: categories[0].id, shortDesc: 'Bắp cải xanh VietGAP', origin: 'Đà Lạt' },
    { name: 'Súp lơ xanh Export', slug: 'sup-lo-xanh-export', price: 45000, stock: 0, minStock: 50, sku: 'TP-006', unit: 'kg', tags: ['fresh', 'export'], categoryId: categories[0].id, shortDesc: 'Súp lơ xanh xuất khẩu, chất lượng cao', origin: 'Đà Lạt' },

    // Thực phẩm khô
    { name: 'Đậu xanh nguyên vỏ', slug: 'dau-xanh-nguyen-vo', price: 42000, stock: 500, minStock: 100, sku: 'K-001', unit: 'kg', tags: ['dry', 'beans', 'protein'], categoryId: categories[1].id, shortDesc: 'Đậu xanh nguyên vỏ, nấu chè, làm bánh', origin: 'Miền Tây' },
    { name: 'Hạt chia hữu cơ', slug: 'hat-chia-huu-co', price: 120000, stock: 200, minStock: 50, sku: 'K-002', unit: 'hộp 500g', tags: ['organic', 'superfood'], categoryId: categories[1].id, shortDesc: 'Hạt chia hữu cơ, giàu omega-3', origin: 'Úc' },
    { name: 'Nấm hương khô loại đặc biệt', slug: 'nam-huong-kho-dac-biet', price: 280000, stock: 80, minStock: 30, sku: 'K-003', unit: 'kg', tags: ['dry', 'mushroom'], categoryId: categories[1].id, shortDesc: 'Nấm hương khô loại đặc biệt, nụ to, thơm', origin: 'Nhật Bản' },
    { name: 'Yến mạch cán dày', slug: 'yen-mach-can-day', price: 65000, stock: 350, minStock: 100, sku: 'K-004', unit: 'kg', tags: ['dry', 'oats', 'breakfast'], categoryId: categories[1].id, shortDesc: 'Yến mạch cán dày, ăn kiêm, giảm cân', origin: 'Úc' },

    // Gia vị
    { name: 'Nước mắm chay Phú Quốc', slug: 'nuoc-mam-chay-phu-quoc', price: 75000, stock: 150, minStock: 50, sku: 'GV-001', unit: 'chai 500ml', tags: ['vegan', 'sauce'], categoryId: categories[2].id, shortDesc: 'Nước mắm chay lên men tự nhiên', origin: 'Phú Quốc' },
    { name: 'Tương ớt chay Sriracha', slug: 'tuong-ot-chay-sriracha', price: 35000, stock: 250, minStock: 100, sku: 'GV-002', unit: 'chai 350ml', tags: ['vegan', 'spicy', 'sauce'], categoryId: categories[2].id, shortDesc: 'Tương ớt chay Sriracha, cay nồng', origin: 'Việt Nam' },
    { name: 'Muối hồng Himalaya', slug: 'muoi-hong-himalaya', price: 55000, stock: 400, minStock: 100, sku: 'GV-003', unit: 'hộp 500g', tags: ['salt', 'mineral'], categoryId: categories[2].id, shortDesc: 'Muối hồng Himalaya tinh khiết', origin: 'Pakistan' },

    // Đông lạnh
    { name: 'Thịt heo thực vật', slug: 'thit-heo-thuc-vat', price: 95000, stock: 100, minStock: 50, sku: 'DL-001', unit: 'gói 500g', tags: ['vegan', 'meat-substitute', 'frozen'], categoryId: categories[3].id, shortDesc: 'Thịt heo thực vật, structure giống thịt thật', origin: 'Đài Loan' },
    { name: 'Tôm chay đông lạnh', slug: 'tom-chay-dong-lanh', price: 85000, stock: 60, minStock: 30, sku: 'DL-002', unit: 'gói 300g', tags: ['vegan', 'seafood-substitute', 'frozen'], categoryId: categories[3].id, shortDesc: 'Tôm chay giòn dai, hương vị tự nhiên', origin: 'Đài Loan' },
    { name: 'Há cảo chay', slug: 'ha-cao-chay', price: 68000, stock: 120, minStock: 50, sku: 'DL-003', unit: 'gói 400g', tags: ['vegan', 'dim-sum', 'frozen'], categoryId: categories[3].id, shortDesc: 'Há cảo chay nhân nấm, rau củ', origin: 'Việt Nam' },

    // Đồ uống
    { name: 'Nước ép lựu đỏ', slug: 'nuoc-ep-luu-do', price: 45000, stock: 180, minStock: 50, sku: 'DU-001', unit: 'chai 350ml', tags: ['juice', 'antioxidant'], categoryId: categories[4].id, shortDesc: 'Nước ép lựu nguyên chất, không đường', origin: 'Việt Nam' },
    { name: 'Trà xanh matcha Nhật Bản', slug: 'tra-xanh-matcha-nhat-ban', price: 185000, stock: 70, minStock: 30, sku: 'DU-002', unit: 'hộp 100g', tags: ['tea', 'matcha', 'japanese'], categoryId: categories[4].id, shortDesc: 'Matcha ceremonial grade từ Uji, Nhật Bản', origin: 'Nhật Bản' },

    // Đồ ăn vặt
    { name: 'Hạt hạnh nhân rang muối', slug: 'hat-hanh-nhan-rang-muoi', price: 95000, stock: 200, minStock: 80, sku: 'AV-001', unit: 'gói 250g', tags: ['nuts', 'roasted', 'snack'], categoryId: categories[5].id, shortDesc: 'Hạnh nhân rang muối giòn rụm', origin: 'Mỹ' },
    { name: 'Chips khoai lang tím', slug: 'chips-khoai-lang-tim', price: 38000, stock: 300, minStock: 100, sku: 'AV-002', unit: 'gói 120g', tags: ['chips', 'snack', 'baked'], categoryId: categories[5].id, shortDesc: 'Khoai lang tím nướng giòn, không chiên', origin: 'Việt Nam' },
    { name: 'Chocolate đen 72% vegan', slug: 'chocolate-den-72-vegan', price: 65000, stock: 150, minStock: 50, sku: 'AV-003', unit: 'thanh 100g', tags: ['chocolate', 'vegan', 'dark'], categoryId: categories[5].id, shortDesc: 'Chocolate đen 72% cacao, hoàn toàn thực vật', origin: 'Bỉ' },

    // Thực phẩm bổ sung
    { name: 'Protein đậu peas isolate', slug: 'protein-dau-peas-isolate', price: 350000, stock: 90, minStock: 30, sku: 'BS-001', unit: 'hộp 1kg', tags: ['protein', 'supplement', 'fitness'], categoryId: categories[6].id, shortDesc: 'Protein thực vật từ đậu vàng, 25g protein/phần', origin: 'Canada' },
    { name: 'Spirulina hữu cơ', slug: 'spirulina-huu-co', price: 220000, stock: 110, minStock: 40, sku: 'BS-002', unit: 'hộp 200 viên', tags: ['superfood', 'supplement', 'organic'], categoryId: categories[6].id, shortDesc: 'Tảo spirulina hữu cơ, giàu sắt và vitamin B12', origin: 'Việt Nam' },
    { name: 'Vitamin D3 thực vật', slug: 'vitamin-d3-thuc-vat', price: 180000, stock: 130, minStock: 50, sku: 'BS-003', unit: 'hộp 60 viên', tags: ['vitamin', 'supplement'], categoryId: categories[6].id, shortDesc: 'Vitamin D3 2000IU chiết xuất từ địa y', origin: 'Anh' },
  ];

  const products = [];
  for (const p of productsData) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.shortDesc + '. Sản phẩm chất lượng cao từ VegiFlow.',
        shortDesc: p.shortDesc,
        price: p.price,
        categoryId: p.categoryId,
        tags: p.tags,
        origin: p.origin || null,
        images: [],
        stock: p.stock,
        minStock: p.minStock,
        sku: p.sku,
        unit: p.unit,
        allergens: [],
        isActive: p.stock > 0,
      },
    });
    products.push(product);
  }
  console.log(`✅ ${products.length} products created`);

  // ── Customers (12) ──
  const customersData = [
    { name: 'Nguyễn Văn Hùng', phone: '0901234567', email: 'hung.nv@email.com', address: '123 Nguyễn Huệ, Quận 1, TP.HCM' },
    { name: 'Trần Thị Thảo', phone: '0912345678', email: 'thao.tt@email.com', address: '456 Lê Lợi, Quận 3, TP.HCM' },
    { name: 'Lê Minh', phone: '0923456789', email: 'minh.le@email.com', address: '789 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội' },
    { name: 'Phạm Tuấn', phone: '0934567890', email: 'tuan.pham@email.com', address: '12 Hai Bà Trưng, Quận 1, TP.HCM' },
    { name: 'Kiều Vũ', phone: '0945678901', email: 'vu.kieu@email.com', address: '34 Phố Huế, Ba Đình, Hà Nội' },
    { name: 'Hoàng Nam', phone: '0956789012', email: 'nam.hoang@email.com', address: '56 Cách Mạng Tháng 8, Quận 10, TP.HCM' },
    { name: 'Vân Ý', phone: '0967890123', email: 'vy.van@email.com', address: '78 Điện Biên Phủ, Bình Thạnh, TP.HCM' },
    { name: 'Anh Lê', phone: '0978901234', email: 'le.anh@email.com', address: '90 Nguyễn Trãi, Thanh Xuân, Hà Nội' },
    { name: 'Mai Phương', phone: '0989012345', email: 'phuong.mai@email.com', address: '23 Võ Văn Tần, Quận 3, TP.HCM' },
    { name: 'Đức Anh', phone: '0990123456', email: 'anh.duc@email.com', address: '45 Lý Thường Kiệt, Hoàn Kiếm, Hà Nội' },
    { name: 'Thanh Hà', phone: '0911122334', email: 'ha.thanh@email.com', address: '67 Nguyễn Đình Chiểu, Quận 3, TP.HCM' },
    { name: 'Bảo Ngọc', phone: '0922233445', email: 'ngoc.bao@email.com', address: '89 Hoàng Quốc Việt, Cầu Giấy, Hà Nội' },
  ];

  const customers = [];
  for (const c of customersData) {
    const customer = await prisma.customer.create({ data: c });
    customers.push(customer);
  }
  console.log(`✅ ${customers.length} customers created`);

  // ── Orders (30+ với nhiều trạng thái) ──
  const statuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'DELIVERED', 'DELIVERED', 'CONFIRMED', 'SHIPPED'];
  const paymentMethods = ['COD', 'BANK_TRANSFER', 'MOMO', 'VNPAY'];

  for (let i = 0; i < 35; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const status = statuses[i % statuses.length] as any;
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)] as any;
    const numItems = Math.floor(Math.random() * 4) + 1;
    const orderDate = randomDate(60);

    // Chọn random products cho order
    const selectedProducts: Array<{ id: string; price: number }> = [];
    for (let j = 0; j < numItems; j++) {
      const prod = products[Math.floor(Math.random() * products.length)];
      if (!selectedProducts.find(sp => sp.id === prod.id)) {
        selectedProducts.push(prod);
      }
    }

    const items = selectedProducts.map(p => ({
      productId: p.id,
      quantity: Math.floor(Math.random() * 5) + 1,
      unitPrice: p.price,
    }));

    const totalAmount = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discount = Math.random() > 0.7 ? Math.floor(totalAmount * 0.1) : 0;
    const finalAmount = totalAmount - discount;

    const orderCode = `VF-${String(9000 + i + 1).padStart(4, '0')}`;

    const order = await prisma.order.create({
      data: {
        orderCode,
        customerId: customer.id,
        totalAmount,
        discount,
        finalAmount,
        status,
        shippingAddress: customer.address || 'Chưa cập nhật',
        shippingPhone: customer.phone,
        note: Math.random() > 0.7 ? 'Giao giờ hành chính' : null,
        paymentMethod,
        paidAt: ['DELIVERED', 'SHIPPED'].includes(status) ? orderDate : null,
        shippedAt: status === 'SHIPPED' ? orderDate : null,
        deliveredAt: status === 'DELIVERED' ? orderDate : null,
        createdAt: orderDate,
        items: {
          create: items,
        },
      },
    });
  }
  console.log(`✅ 35 orders created`);

  // ── Chat Sessions + Messages ──
  const chatSessions = await Promise.all([
    prisma.chatSession.create({
      data: {
        platform: 'ZALO',
        platformUserId: 'zalo_user_001',
        customerId: customers[0].id,
        isActive: true,
        messages: {
          create: [
            { role: 'USER', content: 'Cho tôi hỏi có đậu phụ không?' },
            { role: 'ASSISTANT', content: 'Dạ có ạ! Shop em có Đậu phụ hữu cơ giá 18.000đ/miếng, làm từ đậu nành không GMO. Anh/chị muốn đặt bao nhiêu ạ?' },
            { role: 'USER', content: 'Cho tôi 5 miếng' },
            { role: 'ASSISTANT', content: 'Dạ em đã ghi nhận 5 miếng đậu phụ hữu cơ (18.000đ/miếng). Tổng: 90.000đ. Anh/chị muốn đặt hàng luôn hay xem thêm sản phẩm khác ạ?' },
          ],
        },
      },
    }),
    prisma.chatSession.create({
      data: {
        platform: 'MESSENGER',
        platformUserId: 'messenger_psid_001',
        customerId: customers[2].id,
        isActive: true,
        messages: {
          create: [
            { role: 'USER', content: 'Xin chào, shop có hạt chia không?' },
            { role: 'ASSISTANT', content: 'Chào bạn! Shop có Hạt chia hữu cơ giá 120.000đ/hộp 500g, giàu omega-3, nhập khẩu từ Úc. Bạn muốn tìm hiểu thêm không ạ?' },
            { role: 'USER', content: 'Giảm giá được không shop?' },
            { role: 'ASSISTANT', content: 'Hiện tại em chưa có chương trình giảm giá cho hạt chia ạ. Nhưng nếu mua 3 hộp trở lên, em có thể hỗ trợ freeship nội thành TP.HCM nhé! 🌱' },
          ],
        },
      },
    }),
    prisma.chatSession.create({
      data: {
        platform: 'ZALO',
        platformUserId: 'zalo_user_002',
        customerId: null,
        guestPhone: '0988777666',
        isActive: false,
        messages: {
          create: [
            { role: 'USER', content: 'Tra cứu đơn hàng VF-9001 giúp tôi' },
            { role: 'ASSISTANT', content: 'Dạ, em tìm thấy đơn hàng VF-9001. Đơn đang ở trạng thái "Đã giao". Tổng tiền: 250.000đ. Anh/chị cần hỗ trợ thêm gì không ạ?' },
            { role: 'USER', content: 'Ok cảm ơn shop' },
            { role: 'ASSISTANT', content: 'Dạ không có chi ạ! Cảm ơn anh/chị đã mua sắm tại VegiFlow. Chúc một ngày vui vẻ! 🌿' },
          ],
        },
      },
    }),
    prisma.chatSession.create({
      data: {
        platform: 'MESSENGER',
        platformUserId: 'messenger_psid_002',
        customerId: customers[4].id,
        isActive: true,
        messages: {
          create: [
            { role: 'USER', content: 'Shop ơi, có gì ngon gợi ý cho bữa tối không?' },
            { role: 'ASSISTANT', content: 'Dạ gợi ý cho bạn nè! 🍽️\n1. Thịt heo thực vật - 95.000đ/500g\n2. Há cảo chay - 68.000đ/400g\n3. Nấm hương khô - 280.000đ/kg\nKết hợp thêm xà lách và cà rốt cho bữa ăn đầy đủ nha! Bạn muốn xem chi tiết sản phẩm nào ạ?' },
          ],
        },
      },
    }),
    prisma.chatSession.create({
      data: {
        platform: 'ZALO',
        platformUserId: 'zalo_user_003',
        isActive: true,
        messages: {
          create: [
            { role: 'USER', content: 'Chào shop' },
            { role: 'ASSISTANT', content: 'Chào bạn! 🌿 Chào mừng đến với VegiFlow - Cửa hàng thực phẩm chay online.\n\nEm có thể giúp gì cho bạn ạ?\n• Tư vấn sản phẩm\n• Tra cứu đơn hàng\n• Xem danh mục sản phẩm' },
          ],
        },
      },
    }),
  ]);
  console.log(`✅ ${chatSessions.length} chat sessions with messages created`);

  console.log('\n🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
