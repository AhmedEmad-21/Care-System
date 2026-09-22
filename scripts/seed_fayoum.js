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

    console.log('🚀 Seeding Fayoum data...');

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

    // 2. 20 Doctors in Fayoum
    const doctorsData = [
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000101"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000201"),
        name: "د. أحمد محمود العشيري",
        email: "dr.ahmed.ashiry@care.com",
        phone: "01011110001",
        specialization: "باطنة عامة وسكري",
        address: "الفيوم - المسلة - بجوار المستشفى العام",
        coords: [30.8425, 29.3090],
        basePrice: 200,
        urgentPrice: 350,
        rating: 4.9,
        reviews: 24,
        desc: "استشاري الأمراض الباطنية ومتابعة السكر والقدم السكري"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000102"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000202"),
        name: "د. سارة عبد الرحمن يوسف",
        email: "dr.sara.abdelrahman@care.com",
        phone: "01011110002",
        specialization: "طب الأطفال وحديثي الولادة",
        address: "الفيوم - كيمان فارس - شارع الورشة",
        coords: [30.8350, 29.3140],
        basePrice: 180,
        urgentPrice: 300,
        rating: 4.8,
        reviews: 19,
        desc: "أخصائية طب الأطفال ومتابعة المبتسرين والتغذية العلاجية"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000103"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000203"),
        name: "د. محمد فتحي إبراهيم",
        email: "dr.mohamed.fathy@care.com",
        phone: "01011110003",
        specialization: "جراحة العظام والمفاصل",
        address: "الفيوم - حي دلة - شارع النبوي المهندس",
        coords: [30.8480, 29.3180],
        basePrice: 250,
        urgentPrice: 400,
        rating: 4.9,
        reviews: 31,
        desc: "استشاري جراحة العظام والمفاصل والإصابات والكسور"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000104"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000204"),
        name: "د. محمود حسن القاضي",
        email: "dr.mahmoud.qadi@care.com",
        phone: "01011110004",
        specialization: "أمراض القلب والأوعية الدموية",
        address: "الفيوم - حي الحواتم - شارع المدارس",
        coords: [30.8520, 29.3020],
        basePrice: 300,
        urgentPrice: 500,
        rating: 4.9,
        reviews: 28,
        desc: "استشاري أمراض القلب وقسطرة الشرايين وارتفاع ضغط الدم"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000105"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000205"),
        name: "د. منى كمال الشريف",
        email: "dr.mona.sherif@care.com",
        phone: "01011110005",
        specialization: "النساء والتوليد",
        address: "الفيوم - ميدان السواقي - برج الأطباء",
        coords: [30.8410, 29.3075],
        basePrice: 220,
        urgentPrice: 380,
        rating: 4.7,
        reviews: 17,
        desc: "استشارية النساء والتوليد وعلاج العقم ومتابعة الحمل الحرج"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000106"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000206"),
        name: "د. إسلام نبيل الورداني",
        email: "dr.islam.wardany@care.com",
        phone: "01011110006",
        specialization: "الجلدية والتناسلية والليزر",
        address: "الفيوم - شارع البحر أمام الغرفة التجارية",
        coords: [30.8440, 29.3110],
        basePrice: 190,
        urgentPrice: 300,
        rating: 4.8,
        reviews: 22,
        desc: "أخصائي الأمراض الجلدية والعلاج بالليزر والتجميل"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000107"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000207"),
        name: "د. شيماء ممدوح الصاوي",
        email: "dr.shaimaa.sawy@care.com",
        phone: "01011110007",
        specialization: "أنف وأذن وحنجرة",
        address: "الفيوم - حي باغوص - ميدان الشيخ حسن",
        coords: [30.8380, 29.3050],
        basePrice: 180,
        urgentPrice: 280,
        rating: 4.6,
        reviews: 15,
        desc: "أخصائية جراحة ومناظير الأنف والأذن والحنجرة"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000108"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000208"),
        name: "د. عمر خالد البحيري",
        email: "dr.omar.boheiry@care.com",
        phone: "01011110008",
        specialization: "طب وجراحة العيون",
        address: "الفيوم - حي الجون - شارع الحرية",
        coords: [30.8465, 29.3150],
        basePrice: 200,
        urgentPrice: 320,
        rating: 4.9,
        reviews: 26,
        desc: "استشاري طب وجراحة العيون والليزك والمياه البيضاء"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000109"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000209"),
        name: "د. نهى صابر الزهيري",
        email: "dr.noha.zohairy@care.com",
        phone: "01011110009",
        specialization: "المخ والأعصاب",
        address: "الفيوم - منطقة لطف الله - خلف الاستاد الرياضي",
        coords: [30.8395, 29.3125],
        basePrice: 280,
        urgentPrice: 450,
        rating: 4.8,
        reviews: 21,
        desc: "استشارية أمراض المخ والأعصاب والجلطات الدماغية والصرع"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000110"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000210"),
        name: "د. وليد سمير عبد العال",
        email: "dr.waleed.samir@care.com",
        phone: "01011110010",
        specialization: "جراحة عامة ومناظير",
        address: "مركز سنورس - شارع المركز القديم",
        coords: [30.8680, 29.4080],
        basePrice: 220,
        urgentPrice: 360,
        rating: 4.7,
        reviews: 18,
        desc: "استشاري الجراحة العامة وجراحة المناظير والأورام"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000111"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000211"),
        name: "د. هبة سامي عبد العزيز",
        email: "dr.heba.samy@care.com",
        phone: "01011110011",
        specialization: "صدرية وحساسية",
        address: "مركز سنورس - مدخل المدينة على طريق مصر الفيوم",
        coords: [30.8620, 29.4020],
        basePrice: 190,
        urgentPrice: 300,
        rating: 4.8,
        reviews: 14,
        desc: "أخصائية أمراض الصدر والجهاز التنفسي وحساسية المناعة"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000112"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000212"),
        name: "د. كريم عاطف الجندي",
        email: "dr.karim.gendy@care.com",
        phone: "01011110012",
        specialization: "مسالك بولية وتناسلية",
        address: "مركز إطسا - وسط المدينة بجوار مجمع المصالح",
        coords: [30.7890, 29.2380],
        basePrice: 210,
        urgentPrice: 340,
        rating: 4.7,
        reviews: 20,
        desc: "استشاري جراحة المسالك البولية وتفتيت الحصوات والذكورة"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000113"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000213"),
        name: "د. دينا مصطفى المنشاوي",
        email: "dr.dina.menshawy@care.com",
        phone: "01011110013",
        specialization: "باطنة وجهاز هضمي وكبد",
        address: "مركز إطسا - طريق دفنو الرئيسي",
        coords: [30.7950, 29.2320],
        basePrice: 200,
        urgentPrice: 320,
        rating: 4.9,
        reviews: 23,
        desc: "أخصائية أمراض الجهاز الهضمي والكبد ومناظير المعدة والقولون"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000114"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000214"),
        name: "د. أشرف رضوان عبد القادر",
        email: "dr.ashraf.radwan@care.com",
        phone: "01011110014",
        specialization: "علاج طبيعي وروماتيزم",
        address: "مركز إبشواي - شارع الجمهورية",
        coords: [30.6820, 29.3610],
        basePrice: 170,
        urgentPrice: 270,
        rating: 4.8,
        reviews: 16,
        desc: "استشاري العلاج الطبيعي والتأهيل الحركي والعمود الفقري"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000115"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000215"),
        name: "د. رانيا فاروق الخولي",
        email: "dr.rania.kholy@care.com",
        phone: "01011110015",
        specialization: "طب الشيخوخة والمسنين",
        address: "مركز إبشواي - طريق بحيرة قارون السياحي",
        coords: [30.6780, 29.3560],
        basePrice: 230,
        urgentPrice: 360,
        rating: 4.9,
        reviews: 12,
        desc: "استشارية طب وصحة المسنين والرعاية الممتدة المنزلية"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000116"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000216"),
        name: "د. يوسف مجدي الغمري",
        email: "dr.youssef.ghamry@care.com",
        phone: "01011110016",
        specialization: "طب وجراحة الفم والأسنان",
        address: "مركز طامية - شارع المحطة الرئيسي",
        coords: [30.9670, 29.4790],
        basePrice: 180,
        urgentPrice: 280,
        rating: 4.7,
        reviews: 25,
        desc: "أخصائي جراحة الفم والأسنان وزراعة الأسنان والتركيبات"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000117"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000217"),
        name: "د. مريم عادل نصر الله",
        email: "dr.maryam.adel@care.com",
        phone: "01011110017",
        specialization: "روماتيزم ومناعة",
        address: "مركز طامية - الميدان العام بجوار مجلس المدينة",
        coords: [30.9610, 29.4740],
        basePrice: 240,
        urgentPrice: 380,
        rating: 4.8,
        reviews: 15,
        desc: "استشارية أمراض الروماتيزم والمناعة والذئبة الحمراء والمفاصل"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000118"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000218"),
        name: "د. حازم طارق البنا",
        email: "dr.hazem.banna@care.com",
        phone: "01011110018",
        specialization: "طب الأسرة والرعاية الأولية",
        address: "مركز يوسف الصديق - الشواشنة بجوار الوحدة الصحية",
        coords: [30.4920, 29.3520],
        basePrice: 150,
        urgentPrice: 240,
        rating: 4.9,
        reviews: 30,
        desc: "طبيب أسرة معتمد وتقديم الفحص الشامل ومتابعة الحالات المزمنة"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000119"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000219"),
        name: "د. نادين هاني علام",
        email: "dr.nadeen.allam@care.com",
        phone: "01011110019",
        specialization: "طب نفسي وعلاج الإدمان",
        address: "مدينة الفيوم الجديدة - الحي السكني الثاني",
        coords: [30.9210, 29.2620],
        basePrice: 250,
        urgentPrice: 400,
        rating: 4.9,
        reviews: 27,
        desc: "استشارية الطب النفسي والاضطرابات السلوكية والاستشارات الأسرية"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000120"),
        docId: new mongoose.Types.ObjectId("66f000000000000000000220"),
        name: "د. تامر عصام هلال",
        email: "dr.tamer.helal@care.com",
        phone: "01011110020",
        specialization: "أمراض الكلى والضغط",
        address: "مدينة الفيوم الجديدة - المنطقة الطبية والخدمية",
        coords: [30.9250, 29.2580],
        basePrice: 260,
        urgentPrice: 420,
        rating: 4.8,
        reviews: 19,
        desc: "استشاري أمراض الكلى ومتابعة الغسيل الكلوي وزلال البول"
      }
    ];

    for (const d of doctorsData) {
      await db.collection('users').updateOne(
        { _id: d.userId },
        {
          $set: {
            role: "Doctor",
            name: d.name,
            email: d.email,
            passwordHash: defaultPasswordHash,
            phoneNumber: d.phone,
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
        { _id: d.docId },
        {
          $set: {
            name: d.name,
            userId: d.userId,
            phoneNumber: d.phone,
            address: d.address,
            specialization: d.specialization,
            location: { type: "Point", coordinates: d.coords },
            basePrice: d.basePrice,
            urgentPrice: d.urgentPrice,
            commissionRate: 10,
            rating: d.rating,
            totalReviews: d.reviews,
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
    console.log('✅ 20 Doctors + 20 User accounts seeded');

    // 3. 20 Nurses in Fayoum
    const nursesData = [
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000301"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000401"),
        name: "م. محمود علي إسماعيل",
        email: "nurse.mahmoud.ismail@care.com",
        phone: "01022220001",
        address: "الفيوم - كيمان فارس - شارع الجامعة",
        coords: [30.8360, 29.3130],
        rating: 4.9,
        reviews: 35,
        desc: "أخصائي تمريض عناية مركزة ورعاية منزلية وتركيب كانيولا ومحاليل"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000302"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000402"),
        name: "م. فاطمة عادل الجوهري",
        email: "nurse.fatma.gawhary@care.com",
        phone: "01022220002",
        address: "الفيوم - المسلة - خلف التأمين الصحي",
        coords: [30.8430, 29.3085],
        rating: 4.8,
        reviews: 28,
        desc: "أخصائية تمريض أطفال وحديثي ولادة ورعاية ما بعد العمليات"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000303"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000403"),
        name: "م. عبد الله سيد بركات",
        email: "nurse.abdullah.barakat@care.com",
        phone: "01022220003",
        address: "الفيوم - شارع السلخانة",
        coords: [30.8490, 29.3040],
        rating: 4.9,
        reviews: 42,
        desc: "تمريض جراحي وغيار على الجروح المفتوحة والقدم السكري"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000304"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000404"),
        name: "م. إسراء جمال البدري",
        email: "nurse.esraa.badry@care.com",
        phone: "01022220004",
        address: "الفيوم - منطقة السواقي",
        coords: [30.8405, 29.3068],
        rating: 4.7,
        reviews: 20,
        desc: "تمريض عام وقياس علامات حيوية وإعطاء جميع أنواع الحقن"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000305"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000405"),
        name: "م. مصطفى رجب خليل",
        email: "nurse.mostafa.ragab@care.com",
        phone: "01022220005",
        address: "الفيوم - حي دلة - شارع جمال عبد الناصر",
        coords: [30.8475, 29.3175],
        rating: 4.9,
        reviews: 31,
        desc: "أخصائي تخدير ورعاية حرجة وتركيب قساطر وأنابيب تغذية"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000306"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000406"),
        name: "م. هاجر عثمان متولي",
        email: "nurse.hagar.metwally@care.com",
        phone: "01022220006",
        address: "الفيوم - حي الحواتم",
        coords: [30.8510, 29.3015],
        rating: 4.8,
        reviews: 24,
        desc: "رعاية كبار السن وحالات الزهايمر والتمريض المنزلي الممتد"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000307"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000407"),
        name: "م. حسام الدين ممدوح",
        email: "nurse.hossam.mamdouh@care.com",
        phone: "01022220007",
        address: "الفيوم - باغوص - شارع الورشة",
        coords: [30.8375, 29.3045],
        rating: 4.9,
        reviews: 38,
        desc: "أخصائي تمريض وسحب عينات مخبرية وتخطيط قلب منزلي"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000308"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000408"),
        name: "م. أمنية صابر عبد المجيد",
        email: "nurse.omneya.saber@care.com",
        phone: "01022220008",
        address: "الفيوم - منطقة لطف الله",
        coords: [30.8390, 29.3135],
        rating: 4.8,
        reviews: 19,
        desc: "تمريض باطني ورعاية مرضى السكر والضغط والجلطات"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000309"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000409"),
        name: "م. أيمن طلعت توفيق",
        email: "nurse.ayman.talaat@care.com",
        phone: "01022220009",
        address: "الفيوم - ميدان التدريب الفني",
        coords: [30.8450, 29.3160],
        rating: 4.6,
        reviews: 17,
        desc: "رعاية تمريضية وإسعافات أولية وجلسات استنشاق بخار"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000310"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000410"),
        name: "م. نورهان سعيد حسنين",
        email: "nurse.nourhan.saeed@care.com",
        phone: "01022220010",
        address: "الفيوم - حي الصوفي",
        coords: [30.8540, 29.3055],
        rating: 4.9,
        reviews: 29,
        desc: "أخصائية تمريض منزلي ورعاية الأمهات بعد الولادة القيصرية"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000311"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000411"),
        name: "م. بيتر ميخائيل غالي",
        email: "nurse.peter.ghali@care.com",
        phone: "01022220011",
        address: "مركز سنورس - السوق القديم",
        coords: [30.8650, 29.4050],
        rating: 4.8,
        reviews: 26,
        desc: "أخصائي تمريض جروح وحروق متقدمة وتركيب رايل وقساطر"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000312"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000412"),
        name: "م. ريهام أنور زكي",
        email: "nurse.reham.anwar@care.com",
        phone: "01022220012",
        address: "مركز سنورس - شارع المحكمة",
        coords: [30.8695, 29.4095],
        rating: 4.7,
        reviews: 18,
        desc: "ممرضة رعاية منزلية وشفتات مسائية لكبار السن"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000313"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000413"),
        name: "م. علي رشاد عبد التواب",
        email: "nurse.ali.rashad@care.com",
        phone: "01022220013",
        address: "مركز إطسا - شارع البحر الرئيسي",
        coords: [30.7870, 29.2360],
        rating: 4.9,
        reviews: 33,
        desc: "أخصائي تمريض عناية قلبية ومتابعة مرضى الفشل الكلوي"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000314"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000414"),
        name: "م. سلمى إبراهيم عز الدين",
        email: "nurse.salma.ezz@care.com",
        phone: "01022220014",
        address: "مركز إطسا - قرية قصر الباسل",
        coords: [30.7780, 29.2250],
        rating: 4.8,
        reviews: 21,
        desc: "تمريض صحة مجتمع وتقديم التطعيمات والحقن الوريدية"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000315"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000415"),
        name: "م. طارق وجيه الفقي",
        email: "nurse.tarek.feqy@care.com",
        phone: "01022220015",
        address: "مركز إبشواي - حي الشيخ علي",
        coords: [30.6800, 29.3590],
        rating: 4.9,
        reviews: 40,
        desc: "أخصائي تمريض جراحي وفك الغرز ورعاية قرح الفراش"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000316"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000416"),
        name: "م. ولاء عصام حنفي",
        email: "nurse.walaa.hanafy@care.com",
        phone: "01022220016",
        address: "مركز إبشواي - قرية السنجأ",
        coords: [30.6850, 29.3640],
        rating: 4.7,
        reviews: 16,
        desc: "رعاية الحالات غير القادرة على الحركة ومتابعة الأدوية الدورية"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000317"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000417"),
        name: "م. زياد مدحت الشاهد",
        email: "nurse.zeyad.shahed@care.com",
        phone: "01022220017",
        address: "مركز طامية - شارع المستشفى",
        coords: [30.9650, 29.4770],
        rating: 4.8,
        reviews: 27,
        desc: "أخصائي تمريض طوارئ وسحب تحاليل وإعطاء محاليل تغذية"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000318"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000418"),
        name: "م. دينا شعبان النجار",
        email: "nurse.dina.naggar@care.com",
        phone: "01022220018",
        address: "مركز طامية - كفر محفوظ",
        coords: [30.9580, 29.4710],
        rating: 4.8,
        reviews: 22,
        desc: "تمريض عام وقياس السكر والضغط ونبض القلب وجلسات بخار"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000319"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000419"),
        name: "م. عماد فوزي مرزوق",
        email: "nurse.emad.fawzy@care.com",
        phone: "01022220019",
        address: "مركز يوسف الصديق - الشواشنة",
        coords: [30.4980, 29.3550],
        rating: 4.9,
        reviews: 34,
        desc: "تمريض حالات حرجة ورعاية تنفسية وتركيب قساطر وريدية مركزية"
      },
      {
        userId: new mongoose.Types.ObjectId("66f000000000000000000320"),
        nurseId: new mongoose.Types.ObjectId("66f000000000000000000420"),
        name: "م. مروة صلاح الشيمي",
        email: "nurse.marwa.shimy@care.com",
        phone: "01022220020",
        address: "مدينة الفيوم الجديدة - عمارات الإسكان الاجتماعي",
        coords: [30.9230, 29.2600],
        rating: 4.8,
        reviews: 25,
        desc: "أخصائية تمريض منزلي ورعاية صحية شاملة شفتات 6 و 12 ساعة"
      }
    ];

    for (const n of nursesData) {
      await db.collection('users').updateOne(
        { _id: n.userId },
        {
          $set: {
            role: "Nurse",
            name: n.name,
            email: n.email,
            passwordHash: defaultPasswordHash,
            phoneNumber: n.phone,
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
        { _id: n.nurseId },
        {
          $set: {
            name: n.name,
            userId: n.userId,
            phoneNumber: n.phone,
            location: { type: "Point", coordinates: n.coords },
            commissionRate: 10,
            rating: n.rating,
            totalReviews: n.reviews,
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
    console.log('✅ 20 Nurses + 20 User accounts seeded');

    // 4. 20 Nursing Services
    const nursingServicesData = [
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000501"),
        name: "تركيب كانيولا وإعطاء محاليل وريدية",
        description: "تركيب كانيولا معقمة وتوصيل المحاليل والأدوية الوريدية ومتابعة تدفق السائل",
        basePrice: 80,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000502"),
        name: "إعطاء حقنة عضل أو تحت الجلد",
        description: "إعطاء الحقن العضلية أو تحت الجلد بأدوات معقمة واحترافية وبدون ألم",
        basePrice: 40,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000503"),
        name: "إعطاء حقنة وريد مباشرة",
        description: "حقن الأدوية والمضادات الحيوية في الوريد مباشرة وبدقة عالية",
        basePrice: 50,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000504"),
        name: "غيار معقم على جرح جراحي بسيط",
        description: "تنظيف وتطهير الجروح السطحية والعمليات البسيطة مع تطبيق ضمادات معقمة",
        basePrice: 100,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000505"),
        name: "غيار متقدم على جروح عميقة أو حروق",
        description: "تطهير وعناية متقدمة بالحروق والجروح العميقة باستخدام مضادات حيوية وشاش فازلين",
        basePrice: 180,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000506"),
        name: "قياس العلامات الحيوية والسكر والضغط",
        description: "فحص الضغط والنبض ونسبة الأكسجين بالدم وقياس سكر الدم العشوائي والصائم",
        basePrice: 50,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000507"),
        name: "تركيب قسطرة بولية للرجال والسيدات",
        description: "تركيب القسطرة البولية (Foley Catheter) تحت تعقيم كامل وربط كيس جمع البول",
        basePrice: 150,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000508"),
        name: "إزالة قسطرة بولية معقمة",
        description: "تفريغ البالون وإزالة القسطرة بأمان ومتابعة التبول الطبيعي للمريض",
        basePrice: 70,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000509"),
        name: "سحب عينات دم للتحاليل المخبرية",
        description: "سحب عينات الدم في أنابيب معقمة وحفظها بالشكل الصحيح للنقل إلى المعمل",
        basePrice: 70,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000510"),
        name: "تركيب أنبوب تغذية أنفي معدي (رايل)",
        description: "إدخال الرايل (NG Tube) بدقة لتغذية المريض أو إعطاء الأدوية للمرضى العاجزين",
        basePrice: 160,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000511"),
        name: "جلسة نيبولايزر (استنشاق بخار وموسعات شعب)",
        description: "إعداد جهاز الاستنشاق وإعطاء جرعات الفاركونلين والبالماكورت بأمان",
        basePrice: 60,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000512"),
        name: "إعطاء حقنة شرجية علاجية",
        description: "تنفيذ الحقنة الشرجية (Enema) لعلاج الإمساك الشديد أو للتحضير للفحوصات",
        basePrice: 120,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000513"),
        name: "فك وإزالة الغرز والدبابيس الجراحية",
        description: "إزالة الغرز أو الدبابيس بعد التئام الجرح الجراحي بدون ألم وتطهير المكان",
        basePrice: 90,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000514"),
        name: "عناية متقدمة بقرح الفراش",
        description: "تنظيف الأنسجة الميتة وتطبيق مراهم الغيار المتقدمة وتغيير وضعية المريض",
        basePrice: 200,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000515"),
        name: "غيار وتطهير جروح القدم السكري",
        description: "بروتوكول تعقيم دقيق لقدم مريض السكر لمنع العدوى والحفاظ على الأنسجة",
        basePrice: 180,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000516"),
        name: "تخطيط قلب منزلي متنقل (ECG)",
        description: "إجراء رسم قلب منزلي بأحدث جهاز متنقل وتسليم التقرير فوراً",
        basePrice: 250,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000517"),
        name: "رعاية تمريضية منزلية شفت 6 ساعات",
        description: "مرافقة تمريضية مكثفة تشمل إعطاء الأدوية ومتابعة العلامات الحيوية والنظافة الشخصية",
        basePrice: 400,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000518"),
        name: "رعاية تمريضية منزلية شفت 12 ساعة",
        description: "رعاية تمريضية شاملة للحالات الحرجة وما بعد العمليات الجراحية وكبار السن طوال الشفت",
        basePrice: 700,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000519"),
        name: "تفريغ وتطهير الدرنقة الجراحية",
        description: "قياس السوائل المفرغة من الدرنقة وتطهير موضع خروجها وتجديد التفريغ الهوائي",
        basePrice: 130,
        isActive: true
      },
      {
        _id: new mongoose.Types.ObjectId("66f000000000000000000520"),
        name: "علاج طبيعي تنفسي وتمارين للصدر",
        description: "تمارين توسيع الرئة ومساعدة المريض على التخلص من الإفرازات التنفسية بعد العمليات",
        basePrice: 220,
        isActive: true
      }
    ];

    for (const s of nursingServicesData) {
      await db.collection('nursingservices').updateOne(
        { _id: s._id },
        {
          $set: {
            name: s.name,
            description: s.description,
            basePrice: s.basePrice,
            isActive: s.isActive,
            createdAt: now,
            updatedAt: now
          }
        },
        { upsert: true }
      );
    }
    console.log('✅ 20 Nursing services seeded');

    // 5. Indexes
    try {
      await db.collection('doctors').createIndex({ location: "2dsphere" });
      await db.collection('nurses').createIndex({ location: "2dsphere" });
      await db.collection('users').createIndex({ location: "2dsphere" });
      await db.collection('bookings').createIndex({ requestLocation: "2dsphere" });
      await db.collection('nursingbookings').createIndex({ requestLocation: "2dsphere" });
      console.log('✅ Geospatial 2dsphere indexes confirmed');
    } catch (idxErr) {
      console.warn('Index note:', idxErr.message);
    }

    const docCount = await db.collection('doctors').countDocuments();
    const nurseCount = await db.collection('nurses').countDocuments();
    const serviceCount = await db.collection('nursingservices').countDocuments();
    const userCount = await db.collection('users').countDocuments();

    console.log('\n=======================================');
    console.log('🎉 Seed completed successfully!');
    console.log(`- Doctors: ${docCount}`);
    console.log(`- Nurses: ${nurseCount}`);
    console.log(`- Nursing Services: ${serviceCount}`);
    console.log(`- Total Users: ${userCount}`);
    console.log('Admin login: admin@caresystem.com / Care@123456');
    console.log('Doctor/Nurse login password: Care@123456');
    console.log('=======================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during seeding:', err);
    process.exit(1);
  }
};

run();
