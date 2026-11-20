import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  categories,
  coupons,
  customers,
  inventory,
  inventoryMovements,
  orderItems,
  orders,
  productImages,
  products,
  productVariants,
  reviews,
  roles,
  shippingZones,
  storeSettings,
  whatsappTemplates,
} from './schema.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureDatabaseSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  // 1. Seed Roles
  const roleSeeds = [
    { name: 'super_admin', description: 'Full platform ownership and security control' },
    { name: 'admin', description: 'Store, inventory, orders, and WhatsApp administration' },
    { name: 'staff', description: 'Order fulfillment and WhatsApp support' },
    { name: 'customer', description: 'Registered storefront customer' },
  ];
  for (const r of roleSeeds) {
    await db.insert(roles).values(r).onConflictDoNothing({ target: roles.name });
  }

  // 2. Seed Store Settings if empty
  const [{ value: settingsCount }] = await db.select({ value: count() }).from(storeSettings);
  if (settingsCount === 0) {
    await db.insert(storeSettings).values({
      storeNameAr: 'الشمالي شوب',
      storeNameEn: 'CHAMALI SHOP',
      taglineAr: 'دار الأزياء المغربية المعاصرة',
      taglineFr: 'Maison de Mode Marocaine Contemporaine',
      taglineEn: 'Contemporary Moroccan Fashion House',
      primaryColor: '#141413',
      accentColor: '#9A7B4F',
      phone: '+212 600 000 000',
      whatsappNumber: '212600000000',
      email: 'contact@chamalishop.ma',
      facebookUrl: 'https://facebook.com',
      instagramUrl: 'https://instagram.com',
      currency: 'MAD',
      defaultLanguage: 'ar',
      heroTitleAr: 'أناقة مغربية معاصرة بتوقيع الشمالي شوب',
      heroTitleFr: 'Élégance Marocaine Contemporaine',
      heroTitleEn: 'Contemporary Moroccan Craft & Style',
      heroSubtitleAr:
        'تشكيلة مختارة من الأحذية الجلدية، الأزياء الراقية، والحقائب المصنوعة بعناية — مع الدفع عند الاستلام في جميع مدن المغرب.',
      heroSubtitleFr:
        'Chaussures en cuir, prêt-à-porter et maroquinerie d’exception — Paiement à la livraison partout au Maroc.',
      heroSubtitleEn:
        'Curated leather footwear, tailored apparel, and signature bags — Cash on Delivery across Morocco.',
      heroImageUrl: '/src/assets/images/hero_chamali_campaign_1795208518014.jpg',
      heroCtaUrl: '#collection',
      announcementAr: 'توصيل سريع لجميع مدن المغرب · الدفع عند الاستلام متاح',
      announcementFr: 'Livraison rapide partout au Maroc · Paiement à la livraison',
      announcementEn: 'Fast delivery across Morocco · Cash on Delivery available',
      homeSectionOrder: ['hero', 'categories', 'collection', 'editorial', 'reviews'],
    });
  }

  // 3. Seed Shipping Zones if empty
  const [{ value: zonesCount }] = await db.select({ value: count() }).from(shippingZones);
  if (zonesCount === 0) {
    await db.insert(shippingZones).values([
      {
        cityNameAr: 'الدار البيضاء',
        cityNameFr: 'Casablanca',
        cityNameEn: 'Casablanca',
        shippingFee: '25.00',
        estimatedDays: '24h',
        freeShippingThreshold: '600.00',
        carrierName: 'Chamali Express',
        isActive: true,
        sortOrder: 1,
      },
      {
        cityNameAr: 'الرباط - سلا',
        cityNameFr: 'Rabat - Salé',
        cityNameEn: 'Rabat',
        shippingFee: '30.00',
        estimatedDays: '24-48h',
        freeShippingThreshold: '600.00',
        carrierName: 'Chamali Express',
        isActive: true,
        sortOrder: 2,
      },
      {
        cityNameAr: 'طنجة - تطوان',
        cityNameFr: 'Tanger - Tétouan',
        cityNameEn: 'Tangier',
        shippingFee: '30.00',
        estimatedDays: '24-48h',
        freeShippingThreshold: '600.00',
        carrierName: 'Chamali Nord Express',
        isActive: true,
        sortOrder: 3,
      },
      {
        cityNameAr: 'مراكش',
        cityNameFr: 'Marrakech',
        cityNameEn: 'Marrakech',
        shippingFee: '35.00',
        estimatedDays: '24-48h',
        freeShippingThreshold: '700.00',
        carrierName: 'Amana Express',
        isActive: true,
        sortOrder: 4,
      },
      {
        cityNameAr: 'فاس - مكناس',
        cityNameFr: 'Fès - Meknès',
        cityNameEn: 'Fes',
        shippingFee: '35.00',
        estimatedDays: '48h',
        freeShippingThreshold: '700.00',
        carrierName: 'Amana Express',
        isActive: true,
        sortOrder: 5,
      },
      {
        cityNameAr: 'أكادير',
        cityNameFr: 'Agadir',
        cityNameEn: 'Agadir',
        shippingFee: '40.00',
        estimatedDays: '48-72h',
        freeShippingThreshold: '800.00',
        carrierName: 'Amana Express',
        isActive: true,
        sortOrder: 6,
      },
      {
        cityNameAr: 'وجدة',
        cityNameFr: 'Oujda',
        cityNameEn: 'Oujda',
        shippingFee: '45.00',
        estimatedDays: '48-72h',
        freeShippingThreshold: '800.00',
        carrierName: 'Amana Express',
        isActive: true,
        sortOrder: 7,
      },
      {
        cityNameAr: 'باقي مدن المغرب',
        cityNameFr: 'Autres Villes (Maroc)',
        cityNameEn: 'Other Moroccan Cities',
        shippingFee: '45.00',
        estimatedDays: '48-72h',
        freeShippingThreshold: '800.00',
        carrierName: 'Amana Maroc',
        isActive: true,
        sortOrder: 8,
      },
    ]);
  }

  // 4. Seed Coupons if empty
  const [{ value: couponsCount }] = await db.select({ value: count() }).from(coupons);
  if (couponsCount === 0) {
    await db.insert(coupons).values([
      {
        code: 'CHAMALI10',
        discountType: 'percent',
        discountValue: '10.00',
        minOrderAmount: '200.00',
        maxUses: 500,
        usedCount: 0,
        isActive: true,
      },
      {
        code: 'MARHABA50',
        discountType: 'fixed',
        discountValue: '50.00',
        minOrderAmount: '450.00',
        maxUses: 200,
        usedCount: 0,
        isActive: true,
      },
    ]);
  }

  // 5. Seed WhatsApp Templates if empty
  const [{ value: tplCount }] = await db.select({ value: count() }).from(whatsappTemplates);
  if (tplCount === 0) {
    await db.insert(whatsappTemplates).values([
      {
        eventKey: 'order_confirmed',
        metaTemplateName: 'chamali_order_confirmed',
        languageCode: 'ar',
        bodyAr:
          'مرحباً {{customer_name}}، تم تأكيد طلبك من الشمالي شوب (#{{order_number}}).\nالمنتجات: {{items_summary}}\nمصاريف التوصيل: {{shipping_fee}} درهم\nالمجموع عند الاستلام: {{total_amount}} درهم\nالعنوان: {{address}}',
        bodyFr:
          'Bonjour {{customer_name}}, votre commande CHAMALI SHOP (#{{order_number}}) est confirmée.\nArticles: {{items_summary}}\nLivraison: {{shipping_fee}} MAD\nTotal à la livraison: {{total_amount}} MAD\nAdresse: {{address}}',
        bodyEn:
          'Hello {{customer_name}}, your CHAMALI SHOP order (#{{order_number}}) is confirmed.\nItems: {{items_summary}}\nDelivery: {{shipping_fee}} MAD\nTotal COD: {{total_amount}} MAD\nAddress: {{address}}',
      },
      {
        eventKey: 'order_preparing',
        metaTemplateName: 'chamali_order_preparing',
        languageCode: 'ar',
        bodyAr:
          'مرحباً {{customer_name}}، طلبك رقم #{{order_number}} في الشمالي شوب قيد التجهيز الآن بعناية وسيتم شحنه قريباً.',
        bodyFr:
          'Bonjour {{customer_name}}, votre commande #{{order_number}} chez CHAMALI SHOP est en cours de préparation.',
        bodyEn:
          'Hello {{customer_name}}, your CHAMALI SHOP order #{{order_number}} is now being carefully prepared.',
      },
      {
        eventKey: 'order_shipped',
        metaTemplateName: 'chamali_order_shipped',
        languageCode: 'ar',
        bodyAr:
          'خبر سار {{customer_name}}! تم شحن طلبك #{{order_number}} من الشمالي شوب. المبلغ المطلوب عند الاستلام: {{total_amount}} درهم.',
        bodyFr:
          'Bonne nouvelle {{customer_name}} ! Votre commande #{{order_number}} CHAMALI SHOP a été expédiée. Montant à régler à la livraison: {{total_amount}} MAD.',
        bodyEn:
          'Great news {{customer_name}}! Your CHAMALI SHOP order #{{order_number}} has been shipped. COD amount: {{total_amount}} MAD.',
      },
      {
        eventKey: 'order_delivered',
        metaTemplateName: 'chamali_order_delivered',
        languageCode: 'ar',
        bodyAr:
          'شكراً لتسوقك من الشمالي شوب {{customer_name}}! تم تسليم طلبك #{{order_number}} بنجاح. نتمنى لك تجربة رائعة.',
        bodyFr:
          'Merci pour votre confiance {{customer_name}} ! Votre commande #{{order_number}} CHAMALI SHOP a été livrée.',
        bodyEn:
          'Thank you for shopping with CHAMALI SHOP, {{customer_name}}! Your order #{{order_number}} has been delivered.',
      },
      {
        eventKey: 'order_cancelled',
        metaTemplateName: 'chamali_order_cancelled',
        languageCode: 'ar',
        bodyAr:
          'مرحباً {{customer_name}}، تم إلغاء طلبك رقم #{{order_number}} من الشمالي شوب. لأي استفسار نحن دائماً في خدمتك.',
        bodyFr:
          'Bonjour {{customer_name}}, votre commande #{{order_number}} CHAMALI SHOP a été annulée. N’hésitez pas à nous contacter.',
        bodyEn:
          'Hello {{customer_name}}, your CHAMALI SHOP order #{{order_number}} has been cancelled. Reach out anytime if you need help.',
      },
    ]);
  }

  // 6. Seed Categories & Products if empty
  const [{ value: catCount }] = await db.select({ value: count() }).from(categories);
  if (catCount === 0) {
    const insertedCats = await db
      .insert(categories)
      .values([
        {
          slug: 'shoes-sandals',
          nameAr: 'الأحذية والصنادل',
          nameFr: 'Chaussures & Sandales',
          nameEn: 'Shoes & Sandals',
          imageUrl: '/src/assets/images/product_leather_sandal_1795208519056.jpg',
          sortOrder: 1,
          isActive: true,
        },
        {
          slug: 'mens-clothing',
          nameAr: 'الملابس الرجالية',
          nameFr: 'Mode Homme',
          nameEn: "Men's Clothing",
          imageUrl: '/src/assets/images/product_men_overshirt_1795208518424.jpg',
          sortOrder: 2,
          isActive: true,
        },
        {
          slug: 'womens-clothing',
          nameAr: 'الملابس النسائية',
          nameFr: 'Mode Femme',
          nameEn: "Women's Clothing",
          imageUrl: '/src/assets/images/product_women_dress_1795208518081.jpg',
          sortOrder: 3,
          isActive: true,
        },
        {
          slug: 'bags',
          nameAr: 'الحقائب',
          nameFr: 'Sacs & Maroquinerie',
          nameEn: 'Bags',
          imageUrl: '/src/assets/images/product_leather_tote_1795208518493.jpg',
          sortOrder: 4,
          isActive: true,
        },
        {
          slug: 'accessories',
          nameAr: 'الإكسسوارات',
          nameFr: 'Accessoires',
          nameEn: 'Accessories',
          imageUrl: '/src/assets/images/product_accessories_set_1795208518368.jpg',
          sortOrder: 5,
          isActive: true,
        },
        {
          slug: 'fashion',
          nameAr: 'منتجات الموضة',
          nameFr: 'Tendances Mode',
          nameEn: 'Fashion Edits',
          imageUrl: '/src/assets/images/product_women_crossbody_1795208518602.jpg',
          sortOrder: 6,
          isActive: true,
        },
      ])
      .returning();

    const catBySlug = Object.fromEntries(insertedCats.map((c) => [c.slug, c.id]));

    const productCatalog = [
      {
        slug: 'atlas-leather-sandal',
        sku: 'CHM-SND-001',
        nameAr: 'صندل الأطلس الجلدي الفاخر',
        nameFr: 'Sandale Atlas en Cuir Artisanal',
        nameEn: 'Atlas Artisanal Leather Sandal',
        descriptionAr:
          'صندل جلدي فاخر مصنوع يدوياً من الجلد الطبيعي المدبوغ بعناية، بنعل مريح وخياطة متقنة تناسب الإطلالات اليومية والصيفية الأنيقة في المغرب.',
        descriptionFr:
          'Sandale confectionnée à la main en cuir pleine fleur souple avec coutures renforcées et semelle ergonomique.',
        descriptionEn:
          'Handcrafted Moroccan slide sandal in supple full-grain leather with tonal stitching and cushioned footbed.',
        categoryId: catBySlug['shoes-sandals'],
        originalPrice: '249.00',
        salePrice: '179.00',
        discountPercent: 28,
        status: 'active',
        isFeatured: true,
        isNewArrival: true,
        isBestSeller: true,
        images: [
          '/src/assets/images/product_leather_sandal_1795208519056.jpg',
          '/src/assets/images/hero_chamali_campaign_1795208518014.jpg',
        ],
        variants: [
          { colorNameAr: 'بني كونياك', colorNameFr: 'Cognac', colorNameEn: 'Cognac', colorHex: '#7C4728', size: '40', skuSuffix: 'COG-40', qty: 4 },
          { colorNameAr: 'بني كونياك', colorNameFr: 'Cognac', colorNameEn: 'Cognac', colorHex: '#7C4728', size: '41', skuSuffix: 'COG-41', qty: 6 },
          { colorNameAr: 'بني كونياك', colorNameFr: 'Cognac', colorNameEn: 'Cognac', colorHex: '#7C4728', size: '42', skuSuffix: 'COG-42', qty: 5 },
          { colorNameAr: 'أسود', colorNameFr: 'Noir', colorNameEn: 'Black', colorHex: '#141413', size: '40', skuSuffix: 'BLK-40', qty: 5 },
          { colorNameAr: 'أسود', colorNameFr: 'Noir', colorNameEn: 'Black', colorHex: '#141413', size: '41', skuSuffix: 'BLK-41', qty: 3 },
          { colorNameAr: 'أسود', colorNameFr: 'Noir', colorNameEn: 'Black', colorHex: '#141413', size: '42', skuSuffix: 'BLK-42', qty: 7 },
          { colorNameAr: 'أبيض', colorNameFr: 'Blanc', colorNameEn: 'White', colorHex: '#F3F1EC', size: '42', skuSuffix: 'WHT-42', qty: 7 },
        ],
      },
      {
        slug: 'tangier-suede-loafers',
        sku: 'CHM-SHU-002',
        nameAr: 'موکاسان طنجة من الجلد المخملي',
        nameFr: 'Mocassin Tanger en Daim',
        nameEn: 'Tangier Suede Penny Loafers',
        descriptionAr:
          'حذاء موكاسان رجالي كلاسيكي من جلد السويد الفاخر مع نعل كريب طبيعي يمنحك ثباتاً وراحة طوال اليوم.',
        descriptionFr:
          'Mocassin intemporel en daim velours véritable monté sur une semelle en crêpe naturel souple.',
        descriptionEn:
          'Refined suede penny loafers crafted with natural crepe soles for effortless all-day sophistication.',
        categoryId: catBySlug['shoes-sandals'],
        originalPrice: '490.00',
        salePrice: '389.00',
        discountPercent: 21,
        status: 'active',
        isFeatured: true,
        isNewArrival: false,
        isBestSeller: true,
        images: [
          '/src/assets/images/product_suede_loafers_1795208518328.jpg',
          '/src/assets/images/hero_chamali_campaign_1795208518014.jpg',
        ],
        variants: [
          { colorNameAr: 'أسود فحمي', colorNameFr: 'Noir Charbon', colorNameEn: 'Charcoal', colorHex: '#1C1C1B', size: '40', skuSuffix: 'CHR-40', qty: 4 },
          { colorNameAr: 'أسود فحمي', colorNameFr: 'Noir Charbon', colorNameEn: 'Charcoal', colorHex: '#1C1C1B', size: '41', skuSuffix: 'CHR-41', qty: 6 },
          { colorNameAr: 'أسود فحمي', colorNameFr: 'Noir Charbon', colorNameEn: 'Charcoal', colorHex: '#1C1C1B', size: '42', skuSuffix: 'CHR-42', qty: 5 },
          { colorNameAr: 'أسود فحمي', colorNameFr: 'Noir Charbon', colorNameEn: 'Charcoal', colorHex: '#1C1C1B', size: '43', skuSuffix: 'CHR-43', qty: 2 },
          { colorNameAr: 'زيتوني', colorNameFr: 'Olive', colorNameEn: 'Olive', colorHex: '#4E5641', size: '41', skuSuffix: 'OLV-41', qty: 3 },
          { colorNameAr: 'زيتوني', colorNameFr: 'Olive', colorNameEn: 'Olive', colorHex: '#4E5641', size: '42', skuSuffix: 'OLV-42', qty: 4 },
        ],
      },
      {
        slug: 'rif-linen-overshirt',
        sku: 'CHM-MEN-003',
        nameAr: 'جاكيت قميص الكتان الشمالي للرجال',
        nameFr: 'Surchemise en Lin du Rif',
        nameEn: 'Rif Tailored Linen Overshirt',
        descriptionAr:
          'جاكيت قميص رجالي بقصة معاصرة من مزيج الكتان والقطن العضوي المسامي، مثالي للمواسم المعتدلة والإطلالات الراقية.',
        descriptionFr:
          'Surchemise structurée en mélange lin et coton biologique, coupe contemporaine et finitions tailleur.',
        descriptionEn:
          'Structured menswear overshirt tailored from breathable organic cotton-linen weave with horn buttons.',
        categoryId: catBySlug['mens-clothing'],
        originalPrice: '420.00',
        salePrice: null,
        discountPercent: 0,
        status: 'active',
        isFeatured: true,
        isNewArrival: true,
        isBestSeller: false,
        images: ['/src/assets/images/product_men_overshirt_1795208518424.jpg'],
        variants: [
          { colorNameAr: 'بيج رملي', colorNameFr: 'Beige Sable', colorNameEn: 'Sand', colorHex: '#C9B99F', size: 'M', skuSuffix: 'SND-M', qty: 6 },
          { colorNameAr: 'بيج رملي', colorNameFr: 'Beige Sable', colorNameEn: 'Sand', colorHex: '#C9B99F', size: 'L', skuSuffix: 'SND-L', qty: 8 },
          { colorNameAr: 'بيج رملي', colorNameFr: 'Beige Sable', colorNameEn: 'Sand', colorHex: '#C9B99F', size: 'XL', skuSuffix: 'SND-XL', qty: 4 },
          { colorNameAr: 'رمادي داكن', colorNameFr: 'Anthracite', colorNameEn: 'Anthracite', colorHex: '#2C2C2A', size: 'M', skuSuffix: 'ANT-M', qty: 4 },
          { colorNameAr: 'رمادي داكن', colorNameFr: 'Anthracite', colorNameEn: 'Anthracite', colorHex: '#2C2C2A', size: 'L', skuSuffix: 'ANT-L', qty: 5 },
        ],
      },
      {
        slug: 'andalus-silk-midi-dress',
        sku: 'CHM-WMN-004',
        nameAr: 'فستان الأندلس الميدي من الحرير والكتان',
        nameFr: 'Robe Midi Andalous Soie & Lin',
        nameEn: 'Andalus Silk-Linen Midi Dress',
        descriptionAr:
          'فستان نسائي أنيق منسوج من الحرير والكتان الفاخر بتفاصيل تطريز دقيقة مستوحاة من الحرفية المغربية الراقية.',
        descriptionFr:
          'Robe midi fluide en soie et lin rehaussée d’une passementerie ton sur ton d’inspiration marocaine.',
        descriptionEn:
          'Flowing women’s midi dress in luminous silk-linen blend finished with delicate tonal artisanal trim.',
        categoryId: catBySlug['womens-clothing'],
        originalPrice: '650.00',
        salePrice: '520.00',
        discountPercent: 20,
        status: 'active',
        isFeatured: true,
        isNewArrival: true,
        isBestSeller: true,
        images: ['/src/assets/images/product_women_dress_1795208518081.jpg'],
        variants: [
          { colorNameAr: 'عاجي', colorNameFr: 'Ivoire', colorNameEn: 'Ivory', colorHex: '#F4EFE6', size: 'S', skuSuffix: 'IVR-S', qty: 4 },
          { colorNameAr: 'عاجي', colorNameFr: 'Ivoire', colorNameEn: 'Ivory', colorHex: '#F4EFE6', size: 'M', skuSuffix: 'IVR-M', qty: 6 },
          { colorNameAr: 'عاجي', colorNameFr: 'Ivoire', colorNameEn: 'Ivory', colorHex: '#F4EFE6', size: 'L', skuSuffix: 'IVR-L', qty: 3 },
          { colorNameAr: 'رمادي دافئ', colorNameFr: 'Taupe Doux', colorNameEn: 'Warm Taupe', colorHex: '#A89B8C', size: 'S', skuSuffix: 'TPE-S', qty: 2 },
          { colorNameAr: 'رمادي دافئ', colorNameFr: 'Taupe Doux', colorNameEn: 'Warm Taupe', colorHex: '#A89B8C', size: 'M', skuSuffix: 'TPE-M', qty: 4 },
        ],
      },
      {
        slug: 'medina-structured-tote',
        sku: 'CHM-BAG-005',
        nameAr: 'حقيبة المدينة الكبيرة من الجلد الطبيعي',
        nameFr: 'Cabas Médina Cuir Pleine Fleur',
        nameEn: 'Medina Full-Grain Leather Tote',
        descriptionAr:
          'حقيبة يد نسائية فاخرة من الجلد الطبيعي المحبب بإكسسوارات ذهبية مصقولة ومساحة داخلية واسعة للعمل والخرجات اليومية.',
        descriptionFr:
          'Cabas structuré en cuir grainé pleine fleur avec bouclerie dorée brossée et compartiment intérieur généreux.',
        descriptionEn:
          'Architectural full-grain leather tote bag featuring brushed brass hardware and spacious lined interior.',
        categoryId: catBySlug['bags'],
        originalPrice: '780.00',
        salePrice: '640.00',
        discountPercent: 18,
        status: 'active',
        isFeatured: true,
        isNewArrival: false,
        isBestSeller: true,
        images: [
          '/src/assets/images/product_leather_tote_1795208518493.jpg',
          '/src/assets/images/hero_chamali_campaign_1795208518014.jpg',
        ],
        variants: [
          { colorNameAr: 'بني إسبريسو', colorNameFr: 'Expresso', colorNameEn: 'Espresso', colorHex: '#3D281E', size: 'Standard', skuSuffix: 'ESP-STD', qty: 7 },
          { colorNameAr: 'أسود', colorNameFr: 'Noir', colorNameEn: 'Black', colorHex: '#141413', size: 'Standard', skuSuffix: 'BLK-STD', qty: 4 },
        ],
      },
      {
        slug: 'fassi-crossbody-bag',
        sku: 'CHM-BAG-006',
        nameAr: 'حقيبة فاسية كروس جلدية بمشبك ذهبي',
        nameFr: 'Sac Bandoulière Fassi en Cuir',
        nameEn: 'Fassi Ivory Crossbody Bag',
        descriptionAr:
          'حقيبة كتف وكروس أنيقة بتصميم هندسي نقي من الجلد العاجي الفاخر وقفل معدني ذهبي بتوقيع الشمالي شوب.',
        descriptionFr:
          'Sac bandoulière minimaliste en cuir lisse ivoire doté d’un fermoir architectural doré.',
        descriptionEn:
          'Minimalist calfskin crossbody bag with geometric gold-tone clasp and adjustable leather strap.',
        categoryId: catBySlug['fashion'],
        originalPrice: '540.00',
        salePrice: null,
        discountPercent: 0,
        status: 'active',
        isFeatured: true,
        isNewArrival: true,
        isBestSeller: true,
        images: ['/src/assets/images/product_women_crossbody_1795208518602.jpg'],
        variants: [
          { colorNameAr: 'أبيض عاجي', colorNameFr: 'Ivoire', colorNameEn: 'Ivory', colorHex: '#F6F2EA', size: 'Standard', skuSuffix: 'IVR-STD', qty: 5 },
          { colorNameAr: 'بني كونياك', colorNameFr: 'Cognac', colorNameEn: 'Cognac', colorHex: '#7C4728', size: 'Standard', skuSuffix: 'COG-STD', qty: 2 },
        ],
      },
      {
        slug: 'chamali-signature-watch-eyewear',
        sku: 'CHM-ACC-007',
        nameAr: 'طقم ساعة ونظارات الشمالي الكلاسيكي',
        nameFr: 'Coffret Montre & Lunettes Chamali',
        nameEn: 'Chamali Signature Watch & Eyewear',
        descriptionAr:
          'طقم إكسسوارات راقٍ يجمع بين نظارات الأسيتات الكلاسيكية وساعة بميناء عاجي وسوار جلدي فاخر في علبة هدايا مميزة.',
        descriptionFr:
          'Ensemble raffiné associant lunettes en acétate écaille et montre minimaliste à bracelet en cuir véritable.',
        descriptionEn:
          'Curated accessory duo pairing sculpted tortoise-shell sunglasses with a brushed-gold dress watch.',
        categoryId: catBySlug['accessories'],
        originalPrice: '590.00',
        salePrice: '449.00',
        discountPercent: 24,
        status: 'active',
        isFeatured: true,
        isNewArrival: false,
        isBestSeller: false,
        images: ['/src/assets/images/product_accessories_set_1795208518368.jpg'],
        variants: [
          { colorNameAr: 'سلحفاة وذهبي', colorNameFr: 'Écaille & Or', colorNameEn: 'Tortoise Gold', colorHex: '#5C3B24', size: 'Standard', skuSuffix: 'TRT-STD', qty: 8 },
          { colorNameAr: 'أسود وذهبي', colorNameFr: 'Noir & Or', colorNameEn: 'Black Gold', colorHex: '#181818', size: 'Standard', skuSuffix: 'BLK-STD', qty: 3 },
        ],
      },
    ];

    const createdProductIds: number[] = [];
    for (const p of productCatalog) {
      const [insertedProd] = await db
        .insert(products)
        .values({
          slug: p.slug,
          sku: p.sku,
          nameAr: p.nameAr,
          nameFr: p.nameFr,
          nameEn: p.nameEn,
          descriptionAr: p.descriptionAr,
          descriptionFr: p.descriptionFr,
          descriptionEn: p.descriptionEn,
          categoryId: p.categoryId,
          originalPrice: p.originalPrice,
          salePrice: p.salePrice,
          discountPercent: p.discountPercent,
          status: p.status,
          isFeatured: p.isFeatured,
          isNewArrival: p.isNewArrival,
          isBestSeller: p.isBestSeller,
          metaTitle: `${p.nameAr} | الشمالي شوب - CHAMALI SHOP`,
          metaDescription: p.descriptionAr,
        })
        .returning();

      createdProductIds.push(insertedProd.id);

      for (let i = 0; i < p.images.length; i++) {
        await db.insert(productImages).values({
          productId: insertedProd.id,
          url: p.images[i],
          altText: p.nameEn,
          sortOrder: i,
          isPrimary: i === 0,
        });
      }

      for (const v of p.variants) {
        const [insertedVar] = await db
          .insert(productVariants)
          .values({
            productId: insertedProd.id,
            colorNameAr: v.colorNameAr,
            colorNameFr: v.colorNameFr,
            colorNameEn: v.colorNameEn,
            colorHex: v.colorHex,
            size: v.size,
            skuSuffix: v.skuSuffix,
            isActive: true,
          })
          .returning();

        await db.insert(inventory).values({
          variantId: insertedVar.id,
          quantity: v.qty,
          lowStockThreshold: 3,
        });

        await db.insert(inventoryMovements).values({
          variantId: insertedVar.id,
          changeAmount: v.qty,
          reason: 'Initial catalog stock',
          referenceType: 'restock',
          referenceId: p.sku,
        });
      }
    }

    // Link related products
    for (let i = 0; i < createdProductIds.length; i++) {
      const pid = createdProductIds[i];
      const related = createdProductIds.filter((id) => id !== pid).slice(0, 3);
      await db
        .update(products)
        .set({ relatedProductIds: related })
        .where(eq(products.id, pid));
    }
  }

  // 7. Seed Reviews if empty
  const [{ value: revCount }] = await db.select({ value: count() }).from(reviews);
  if (revCount === 0) {
    await db.insert(reviews).values([
      {
        customerName: 'سلمى العلمي',
        city: 'الدار البيضاء',
        rating: 5,
        commentAr: 'جودة الجلد في حقيبة المدينة تفوق التوقعات. وصلتني في أقل من 24 ساعة والدفع عند الاستلام كان سلساً جداً.',
        commentFr: 'Qualité du cuir exceptionnelle sur le cabas Médina. Livraison en 24h à Casablanca.',
        commentEn: 'The leather quality on the Medina Tote exceeded expectations. Delivered in under 24 hours.',
        productName: 'حقيبة المدينة الكبيرة من الجلد الطبيعي',
        isApproved: true,
      },
      {
        customerName: 'يوسف بنجلون',
        city: 'طنجة',
        rating: 5,
        commentAr: 'طلبت صندل الأطلس وموكاسان طنجة عبر الواتساب، المساعد الذكي ساعدني في اختيار المقاس الصحيح بدقة.',
        commentFr: 'Commandé via WhatsApp avec des conseils précis sur la pointure. Finitions impeccables.',
        commentEn: 'Ordered via WhatsApp and got exact sizing guidance immediately. Superb craftsmanship.',
        productName: 'صندل الأطلس الجلدي الفاخر',
        isApproved: true,
      },
      {
        customerName: 'نادية التازي',
        city: 'الرباط',
        rating: 5,
        commentAr: 'فستان الأندلس خفيف وأنيق جداً في اللبس. التغليف فاخر ويشرف كهدية.',
        commentFr: 'La robe Andalous est fluide et très élégante. Emballage soigné digne d’une grande maison.',
        commentEn: 'The Andalus dress drapes beautifully. Packaging feels like a luxury boutique.',
        productName: 'فستان الأندلس الميدي من الحرير والكتان',
        isApproved: true,
      },
    ]);
  }

  // 8. Seed 1 real sample customer & order if orders empty so analytics is grounded
  const [{ value: orderCount }] = await db.select({ value: count() }).from(orders);
  if (orderCount === 0) {
    const firstProd = await db.query.products.findFirst({
      with: { variants: true },
    });
    if (firstProd && firstProd.variants[0]) {
      const [cust] = await db
        .insert(customers)
        .values({
          fullName: 'كريم الفاسي',
          phone: '212661234567',
          city: 'الدار البيضاء',
          address: 'شارع أنفا، إقامة النخيل رقم 14',
          totalOrders: 1,
          totalSpent: '204.00',
        })
        .onConflictDoNothing({ target: customers.phone })
        .returning();

      if (cust) {
        const [ord] = await db
          .insert(orders)
          .values({
            orderNumber: 'CHM-2026-1001',
            customerId: cust.id,
            customerName: cust.fullName,
            customerPhone: cust.phone,
            city: cust.city,
            address: cust.address,
            paymentMethod: 'cod',
            status: 'delivered',
            subtotal: '179.00',
            shippingFee: '25.00',
            discountAmount: '0.00',
            totalAmount: '204.00',
            source: 'web',
            idempotencyKey: 'seed-chm-2026-1001',
          })
          .returning();

        await db.insert(orderItems).values({
          orderId: ord.id,
          productId: firstProd.id,
          variantId: firstProd.variants[0].id,
          productName: firstProd.nameAr,
          colorName: firstProd.variants[0].colorNameAr,
          size: firstProd.variants[0].size,
          unitPrice: '179.00',
          quantity: 1,
          totalPrice: '179.00',
        });
      }
    }
  }
}
