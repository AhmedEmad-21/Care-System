require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/care-system';

const run = async () => {
  try {
    console.log('🔌 Connecting to MongoDB at:', MONGO_URI.replace(/\/\/.*@/, '//<credentials>@'));
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB successfully.');

    const db = mongoose.connection.db;
    const now = new Date();
    const defaultPasswordHash = "$2b$10$EViMBOYADcCDHyrP.ToUOO8bWdbVbCISlXzvp75/8t42wmhyGyGZS"; // Care@123456

    console.log('🚀 Seeding Fayoum data with ZERO initial ratings (rating: 0, totalReviews: 0)...');

    // 1. Admin
    const adminId = new mongoose.Types.ObjectId("66f000000000000000000001");
    await db.collection('users').updateOne(
      { _id: adminId },
      {
        $set: {
          role: "Admin",
          name: "مدير النظام",
          email: "admin@caresystem.com",
          passwordHash: defaultPasswordHash,
          phoneNumber: "01000000000",
          address: "محافظة الفيوم - المقر الرئيسي",
          location: { type: "Point", coordinates: [30.8428, 29.3084] },
          accountStatus: "active",
          vettingStatus: "approved",
          createdAt: now,
          updatedAt: now
        }
      },
      { upsert: true }
    );
    console.log('✅ Admin user created / updated');

    // تنظيف الحسابات التجريبية السابقة لمنع أي تعارض في الفهارس الفريدة (Phone / Email)
    await db.collection('users').deleteMany({ email: { $regex: /@(care\.com)$/i } });
    await db.collection('doctors').deleteMany({ phoneNumber: { $regex: /^0101111/ } });
    await db.collection('nurses').deleteMany({ phoneNumber: { $regex: /^0102222/ } });
    console.log('🧹 Cleaned existing test seed accounts');

    // 2. 20 Doctors in Fayoum matching official 15 specialties with rating: 0
    const doctorsRaw = [
      { idNum: 1, name: "د. أحمد محمود العشيري", email: "dr.ahmed.ashiry@care.com", specialization: "باطنة", address: "الفيوم - المسلة - بجوار المستشفى العام", coords: [30.8425, 29.3090], basePrice: 200, urgentPrice: 350, desc: "استشاري الأمراض الباطنية ومتابعة السكر والقدم السكري" },
      { idNum: 2, name: "د. سارة عبد الرحمن يوسف", email: "dr.sara.abdelrahman@care.com", specialization: "أطفال وحديثي الولادة", address: "الفيوم - كيمان فارس - شارع الورشة", coords: [30.8350, 29.3140], basePrice: 180, urgentPrice: 300, desc: "أخصائية طب الأطفال ومتابعة المبتسرين والتغذية العلاجية" },
      { idNum: 3, name: "د. منى كمال الشريف", email: "dr.mona.sherif@care.com", specialization: "أمراض النساء والتوليد وتأخر الإنجاب", address: "الفيوم - ميدان السواقي - برج الأطباء", coords: [30.8410, 29.3075], basePrice: 220, urgentPrice: 380, desc: "استشارية النساء والتوليد وعلاج العقم ومتابعة الحمل الحرج" },
      { idNum: 4, name: "د. محمد فتحي إبراهيم", email: "dr.mohamed.fathy@care.com", specialization: "العظام والمفاصل والعمود الفقري", address: "الفيوم - حي دلة - شارع النبوي المهندس", coords: [30.8480, 29.3180], basePrice: 250, urgentPrice: 400, desc: "استشاري جراحة العظام والمفاصل والإصابات والكسور" },
      { idNum: 5, name: "د. محمود حسن القاضي", email: "dr.mahmoud.qadi@care.com", specialization: "القلب والأوعية الدموية", address: "الفيوم - حي الحواتم - شارع المدارس", coords: [30.8520, 29.3020], basePrice: 300, urgentPrice: 500, desc: "استشاري أمراض القلب وقسطرة الشرايين وارتفاع ضغط الدم" },
      { idNum: 6, name: "د. هبة سامي عبد العزيز", email: "dr.heba.samy@care.com", specialization: "الصدر والجهاز التنفسي", address: "مركز سنورس - مدخل المدينة على طريق مصر الفيوم", coords: [30.8620, 29.4020], basePrice: 190, urgentPrice: 300, desc: "أخصائية أمراض الصدر والجهاز التنفسي وحساسية المناعة" },
      { idNum: 7, name: "د. نهى صابر الزهيري", email: "dr.noha.zohairy@care.com", specialization: "المخ والأعصاب والطب النفسي", address: "الفيوم - منطقة لطف الله - خلف الاستاد الرياضي", coords: [30.8395, 29.3125], basePrice: 280, urgentPrice: 450, desc: "استشارية أمراض المخ والأعصاب والجلطات الدماغية والطب النفسي" },
      { idNum: 8, name: "د. دينا مصطفى المنشاوي", email: "dr.dina.menshawy@care.com", specialization: "جهاز هضمي وكبد ومناظير", address: "مركز إطسا - طريق دفنو الرئيسي", coords: [30.7950, 29.2320], basePrice: 200, urgentPrice: 320, desc: "أخصائية أمراض الجهاز الهضمي والكبد ومناظير المعدة والقولون" },
      { idNum: 9, name: "د. شيماء ممدوح الصاوي", email: "dr.shaimaa.sawy@care.com", specialization: "الأنف والأذن والحنجرة", address: "الفيوم - حي باغوص - ميدان الشيخ حسن", coords: [30.8380, 29.3050], basePrice: 180, urgentPrice: 280, desc: "أخصائية جراحة ومناظير الأنف والأذن والحنجرة" },
      { idNum: 10, name: "د. إسلام نبيل الورداني", email: "dr.islam.wardany@care.com", specialization: "الجلدية والتناسلية والتجميل", address: "الفيوم - شارع البحر أمام الغرفة التجارية", coords: [30.8440, 29.3110], basePrice: 190, urgentPrice: 300, desc: "أخصائي الأمراض الجلدية والتناسلية والعلاج بالليزر والتجميل" },
      { idNum: 11, name: "د. عمر خالد البحيري", email: "dr.omar.boheiry@care.com", specialization: "الرمد", address: "الفيوم - حي الجون - شارع الحرية", coords: [30.8465, 29.3150], basePrice: 200, urgentPrice: 320, desc: "استشاري طب وجراحة العيون والرمد والليزك والمياه البيضاء" },
      { idNum: 12, name: "د. يوسف مجدي الغمري", email: "dr.youssef.ghamry@care.com", specialization: "الأسنان", address: "مركز طامية - شارع المحطة الرئيسي", coords: [30.9670, 29.4790], basePrice: 180, urgentPrice: 280, desc: "أخصائي جراحة الفم والأسنان وزراعة الأسنان والتركيبات" },
      { idNum: 13, name: "د. وليد سمير عبد العال", email: "dr.waleed.samir@care.com", specialization: "الجراحة العامة وجراحة المناظير", address: "مركز سنورس - شارع المركز القديم", coords: [30.8680, 29.4080], basePrice: 220, urgentPrice: 360, desc: "استشاري الجراحة العامة وجراحة المناظير واستئصال الأورام" },
      { idNum: 14, name: "د. كريم عاطف الجندي", email: "dr.karim.gendy@care.com", specialization: "الكلى والمسالك البولية", address: "مركز إطسا - وسط المدينة بجوار مجمع المصالح", coords: [30.7890, 29.2380], basePrice: 210, urgentPrice: 340, desc: "استشاري جراحة المسالك البولية وتفتيت الحصوات وأمراض الكلى" },
      { idNum: 15, name: "د. أشرف رضوان عبد القادر", email: "dr.ashraf.radwan@care.com", specialization: "العلاج الطبيعي والتأهيل", address: "مركز إبشواي - شارع الجمهورية", coords: [30.6820, 29.3610], basePrice: 170, urgentPrice: 270, desc: "استشاري العلاج الطبيعي والتأهيل الحركي والعمود الفقري" },
      { idNum: 16, name: "د. رانيا فاروق الخولي", email: "dr.rania.kholy@care.com", specialization: "باطنة", address: "مركز إبشواي - طريق بحيرة قارون السياحي", coords: [30.6780, 29.3560], basePrice: 230, urgentPrice: 360, desc: "استشارية الأمراض الباطنية والرعاية الصحية للمسنين والحالات المزمنة" },
      { idNum: 17, name: "د. مريم عادل نصر الله", email: "dr.maryam.adel@care.com", specialization: "أطفال وحديثي الولادة", address: "مركز طامية - الميدان العام بجوار مجلس المدينة", coords: [30.9610, 29.4740], basePrice: 240, urgentPrice: 380, desc: "استشارية طب الأطفال ورعاية حديثي الولادة وحساسية الصدر للأطفال" },
      { idNum: 18, name: "د. حازم طارق البنا", email: "dr.hazem.banna@care.com", specialization: "العظام والمفاصل والعمود الفقري", address: "مركز يوسف الصديق - الشواشنة بجوار الوحدة الصحية", coords: [30.4920, 29.3520], basePrice: 150, urgentPrice: 240, desc: "أخصائي جراحة العظام والمفاصل ومناظير الركبة والعمود الفقري" },
      { idNum: 19, name: "د. نادين هاني علام", email: "dr.nadeen.allam@care.com", specialization: "أمراض النساء والتوليد وتأخر الإنجاب", address: "مدينة الفيوم الجديدة - الحي السكني الثاني", coords: [30.9210, 29.2620], basePrice: 250, urgentPrice: 400, desc: "استشارية أمراض النساء والتوليد ومتابعة التبويض والحقن المجهري" },
      { idNum: 20, name: "د. تامر عصام هلال", email: "dr.tamer.helal@care.com", specialization: "القلب والأوعية الدموية", address: "مدينة الفيوم الجديدة - المنطقة الطبية والخدمية", coords: [30.9250, 29.2580], basePrice: 260, urgentPrice: 420, desc: "استشاري أمراض القلب والأوعية الدموية ورسم القلب الإيكو" }
    ];

    for (const d of doctorsRaw) {
      const pad = String(d.idNum).padStart(2, '0');
      const userId = new mongoose.Types.ObjectId(`66f0000000000000000001${pad}`);
      const docId = new mongoose.Types.ObjectId(`66f0000000000000000002${pad}`);
      const phone = `010111100${pad}`;

      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            role: "Doctor",
            name: d.name,
            email: d.email,
            passwordHash: defaultPasswordHash,
            phoneNumber: phone,
            address: d.address,
            location: { type: "Point", coordinates: d.coords },
            accountStatus: "active",
            vettingStatus: "approved",
            createdByAdminID: adminId,
            createdAt: now,
            updatedAt: now
          }
        },
        { upsert: true }
      );

      await db.collection('doctors').updateOne(
        { _id: docId },
        {
          $set: {
            name: d.name,
            userId: userId,
            phoneNumber: phone,
            address: d.address,
            specialization: d.specialization,
            location: { type: "Point", coordinates: d.coords },
            basePrice: d.basePrice,
            urgentPrice: d.urgentPrice,
            commissionRate: 10,
            rating: 0,
            totalReviews: 0,
            addedBy: adminId,
            workingHours: { start: "09:00", end: "21:00" },
            offDays: [5],
            isAvailable: true,
            description: d.desc,
            unavailableDates: [],
            createdAt: now,
            updatedAt: now
          }
        },
        { upsert: true }
      );
    }
    console.log('✅ 20 Doctors updated with rating: 0, totalReviews: 0');

    // 3. 20 Nurses in Fayoum with rating: 0
    const nursesRaw = [
      { idNum: 1, name: "م. محمود علي إسماعيل", email: "nurse.mahmoud.ismail@care.com", address: "الفيوم - كيمان فارس - شارع الجامعة", coords: [30.8360, 29.3130], desc: "أخصائي تمريض عناية مركزة ورعاية منزلية وتركيب كانيولا ومحاليل" },
      { idNum: 2, name: "م. فاطمة عادل الجوهري", email: "nurse.fatma.gawhary@care.com", address: "الفيوم - المسلة - خلف التأمين الصحي", coords: [30.8430, 29.3085], desc: "أخصائية تمريض أطفال وحديثي ولادة ورعاية ما بعد العمليات" },
      { idNum: 3, name: "م. عبد الله سيد بركات", email: "nurse.abdullah.barakat@care.com", address: "الفيوم - شارع السلخانة", coords: [30.8490, 29.3040], desc: "تمريض جراحي وغيار على الجروح المفتوحة والقدم السكري" },
      { idNum: 4, name: "م. إسراء جمال البدري", email: "nurse.esraa.badry@care.com", address: "الفيوم - منطقة السواقي", coords: [30.8405, 29.3068], desc: "تمريض عام وقياس علامات حيوية وإعطاء جميع أنواع الحقن" },
      { idNum: 5, name: "م. مصطفى رجب خليل", email: "nurse.mostafa.ragab@care.com", address: "الفيوم - حي دلة - شارع جمال عبد الناصر", coords: [30.8475, 29.3175], desc: "أخصائي تخدير ورعاية حرجة وتركيب قساطر وأنابيب تغذية" },
      { idNum: 6, name: "م. هاجر عثمان متولي", email: "nurse.hagar.metwally@care.com", address: "الفيوم - حي الحواتم", coords: [30.8510, 29.3015], desc: "رعاية كبار السن وحالات الزهايمر والتمريض المنزلي الممتد" },
      { idNum: 7, name: "م. حسام الدين ممدوح", email: "nurse.hossam.mamdouh@care.com", address: "الفيوم - باغوص - شارع الورشة", coords: [30.8375, 29.3045], desc: "أخصائي تمريض وسحب عينات مخبرية وتخطيط قلب منزلي" },
      { idNum: 8, name: "م. أمنية صابر عبد المجيد", email: "nurse.omneya.saber@care.com", address: "الفيوم - منطقة لطف الله", coords: [30.8390, 29.3135], desc: "تمريض باطني ورعاية مرضى السكر والضغط والجلطات" },
      { idNum: 9, name: "م. أيمن طلعت توفيق", email: "nurse.ayman.talaat@care.com", address: "الفيوم - ميدان التدريب الفني", coords: [30.8450, 29.3160], desc: "رعاية تمريضية وإسعافات أولية وجلسات استنشاق بخار" },
      { idNum: 10, name: "م. نورهان سعيد حسنين", email: "nurse.nourhan.saeed@care.com", address: "الفيوم - حي الصوفي", coords: [30.8540, 29.3055], desc: "أخصائية تمريض منزلي ورعاية الأمهات بعد الولادة القيصرية" },
      { idNum: 11, name: "م. بيتر ميخائيل غالي", email: "nurse.peter.ghali@care.com", address: "مركز سنورس - السوق القديم", coords: [30.8650, 29.4050], desc: "أخصائي تمريض جروح وحروق متقدمة وتركيب رايل وقساطر" },
      { idNum: 12, name: "م. ريهام أنور زكي", email: "nurse.reham.anwar@care.com", address: "مركز سنورس - شارع المحكمة", coords: [30.8695, 29.4095], desc: "ممرضة رعاية منزلية وشفتات مسائية لكبار السن" },
      { idNum: 13, name: "م. علي رشاد عبد التواب", email: "nurse.ali.rashad@care.com", address: "مركز إطسا - شارع البحر الرئيسي", coords: [30.7870, 29.2360], desc: "أخصائي تمريض عناية قلبية ومتابعة مرضى الفشل الكلوي" },
      { idNum: 14, name: "م. سلمى إبراهيم عز الدين", email: "nurse.salma.ezz@care.com", address: "مركز إطسا - قرية قصر الباسل", coords: [30.7780, 29.2250], desc: "تمريض صحة مجتمع وتقديم التطعيمات والحقن الوريدية" },
      { idNum: 15, name: "م. طارق وجيه الفقي", email: "nurse.tarek.feqy@care.com", address: "مركز إبشواي - حي الشيخ علي", coords: [30.6800, 29.3590], desc: "أخصائي تمريض جراحي وفك الغرز ورعاية قرح الفراش" },
      { idNum: 16, name: "م. ولاء عصام حنفي", email: "nurse.walaa.hanafy@care.com", address: "مركز إبشواي - قرية السنجأ", coords: [30.6850, 29.3640], desc: "رعاية الحالات غير القادرة على الحركة ومتابعة الأدوية الدورية" },
      { idNum: 17, name: "م. زياد مدحت الشاهد", email: "nurse.zeyad.shahed@care.com", address: "مركز طامية - شارع المستشفى", coords: [30.9650, 29.4770], desc: "أخصائي تمريض طوارئ وسحب تحاليل وإعطاء محاليل تغذية" },
      { idNum: 18, name: "م. دينا شعبان النجار", email: "nurse.dina.naggar@care.com", address: "مركز طامية - كفر محفوظ", coords: [30.9580, 29.4710], desc: "تمريض عام وقياس السكر والضغط ونبض القلب وجلسات بخار" },
      { idNum: 19, name: "م. عماد فوزي مرزوق", email: "nurse.emad.fawzy@care.com", address: "مركز يوسف الصديق - الشواشنة", coords: [30.4980, 29.3550], desc: "تمريض حالات حرجة ورعاية تنفسية وتركيب قساطر وريدية مركزية" },
      { idNum: 20, name: "م. مروة صلاح الشيمي", email: "nurse.marwa.shimy@care.com", address: "مدينة الفيوم الجديدة - عمارات الإسكان الاجتماعي", coords: [30.9230, 29.2600], desc: "أخصائية تمريض منزلي ورعاية صحية شاملة شفتات 6 و 12 ساعة" }
    ];

    for (const n of nursesRaw) {
      const pad = String(n.idNum).padStart(2, '0');
      const userId = new mongoose.Types.ObjectId(`66f0000000000000000003${pad}`);
      const nurseId = new mongoose.Types.ObjectId(`66f0000000000000000004${pad}`);
      const phone = `010222200${pad}`;

      await db.collection('users').updateOne(
        { _id: userId },
        {
          $set: {
            role: "Nurse",
            name: n.name,
            email: n.email,
            passwordHash: defaultPasswordHash,
            phoneNumber: phone,
            address: n.address,
            location: { type: "Point", coordinates: n.coords },
            accountStatus: "active",
            vettingStatus: "approved",
            createdByAdminID: adminId,
            createdAt: now,
            updatedAt: now
          }
        },
        { upsert: true }
      );

      await db.collection('nurses').updateOne(
        { _id: nurseId },
        {
          $set: {
            name: n.name,
            userId: userId,
            phoneNumber: phone,
            location: { type: "Point", coordinates: n.coords },
            commissionRate: 10,
            rating: 0,
            totalReviews: 0,
            isAvailable: true,
            offDays: [5],
            description: n.desc,
            unavailableDates: [],
            addedBy: adminId,
            createdAt: now,
            updatedAt: now
          }
        },
        { upsert: true }
      );
    }
    console.log('✅ 20 Nurses updated with rating: 0, totalReviews: 0');

    // التأكد من تفريغ جدول المراجعات reviews
    const deletedReviews = await db.collection('reviews').deleteMany({});
    console.log(`🧹 Cleaned reviews collection: deleted ${deletedReviews.deletedCount} reviews`);

    const docCount = await db.collection('doctors').countDocuments();
    const nurseCount = await db.collection('nurses').countDocuments();
    const specialtiesInDb = await db.collection('doctors').distinct('specialization');

    console.log('\n=======================================');
    console.log('🎉 Seed completed with ZERO ratings!');
    console.log(`- Doctors: ${docCount} (all rating = 0, totalReviews = 0)`);
    console.log(`- Nurses: ${nurseCount} (all rating = 0, totalReviews = 0)`);
    console.log('Specialties in DB:', specialtiesInDb);
    console.log('=======================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during seeding:', err);
    process.exit(1);
  }
};

run();
