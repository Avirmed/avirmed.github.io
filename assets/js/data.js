/*
 * Site content. Edit this file to add publications, research topics or courses.
 * Strings that differ by language are { mn, en } objects.
 */
window.SITE = {
  me: "Avirmed Enkhbat",

  stats: [
    { value: 11, label: { mn: "Бүтээл", en: "Publications" } },
    { value: 68, label: { mn: "Ишлэл (Scholar)", en: "Citations (Scholar)" } },
    { value: 6, label: { mn: "IEEE / MDPI сэтгүүл", en: "IEEE / MDPI journals" } },
    { value: 2024, label: { mn: "Ph.D., NCU Тайвань", en: "Ph.D., NCU Taiwan" }, plain: true },
  ],

  // Topic keys used by publications and research cards.
  topics: {
    hci: { mn: "Гарын дохио & HCI", en: "Hand Gesture & HCI" },
    action: { mn: "Үйлдэл таних", en: "Action Recognition" },
    vision: { mn: "Компьютер хараа", en: "Computer Vision" },
    data: { mn: "Өгөгдлийн олборлолт", en: "Data Mining" },
  },

  publications: [
    {
      year: 2025, type: "journal", topics: ["vision"],
      title: "Hyperspectral Image Classification on a Multiscale 3D Convolutional Neural Network",
      authors: ["Duy Quy Thai", "Thi Ngoc Thao Tran", "Avirmed Enkhbat"],
      venue: "Dalat University Journal of Science", pages: "171–185",
      doi: "10.37569/DalatUniversity.15.3.1381(2025)",
    },
    {
      year: 2025, type: "conference", topics: ["data"],
      title: "Forecasting Stock Prices with Sequential Deep Learning: A Long Short-Term Memory Approach",
      authors: ["Ervin Yohannes", "Aldin Febriansyah", "Nisa Dwi Septiyanti", "Suparji", "Agus Wiyono", "Aries Dwi Indriyanti", "Fitri Utaminingrum", "Chih-Yang Lin", "Kahlil Muchtar", "Avirmed Enkhbat"],
      venue: "8th International Conference on Vocational Education and Electrical Engineering (ICVEE)", pages: "177–183",
      doi: "10.1109/ICVEE66651.2025.11281457",
    },
    {
      year: 2024, type: "journal", topics: ["action", "hci"], featured: true,
      title: "Human Action Recognition and Note Recognition: A Deep Learning Approach Using STA-GCN",
      authors: ["Avirmed Enkhbat", "Timothy K. Shih", "Pimpa Cheewaprakobkit"],
      venue: "Sensors", volume: "24", pages: "2519",
      doi: "10.3390/s24082519",
    },
    {
      year: 2024, type: "journal", topics: ["action", "hci"], featured: true,
      title: "Using Hybrid Models for Action Correction in Instrument Learning Based on AI",
      authors: ["Avirmed Enkhbat", "Timothy K. Shih", "Munkhjargal Gochoo", "Pimpa Cheewaprakobkit", "Wisnu Aditya", "Thai Duy Quy", "Hsinchih Lin", "Yu-Ting Lin"],
      venue: "IEEE Access", volume: "12", pages: "125319–125331",
      doi: "10.1109/ACCESS.2024.3454170",
    },
    {
      year: 2023, type: "journal", topics: ["vision"],
      title: "An Improved Speed Estimation Using Deep Homography Transformation Regression Network on Monocular Videos",
      authors: ["Ervin Yohannes", "Chih-Yang Lin", "Timothy K. Shih", "Tipajin Thaipisutikul", "Avirmed Enkhbat", "Fitri Utaminingrum"],
      venue: "IEEE Access", volume: "11", pages: "5955–5965",
      doi: "10.1109/ACCESS.2023.3236512",
    },
    {
      year: 2023, type: "journal", topics: ["vision"],
      title: "Enhancing Single Object Tracking With a Hybrid Approach: Temporal Convolutional Networks, Attention Mechanisms, and Spatial-Temporal Memory",
      authors: ["Pimpa Cheewaprakobkit", "Chih-Yang Lin", "Timothy K. Shih", "Avirmed Enkhbat"],
      venue: "IEEE Access", volume: "11", pages: "139211–139222",
      doi: "10.1109/ACCESS.2023.3330644",
    },
    {
      year: 2022, type: "conference", topics: ["data"],
      title: "Beyond Fear Go Viral: A Machine Learning Study on Infodemic Detection during COVID-19 Pandemic",
      authors: ["Tipajin Thaipisutikul", "Timothy K. Shih", "Avirmed Enkhbat", "Wisnu Aditya", "Huang-Chia Shih", "Pattanasak Mongkolwat"],
      venue: "14th International Conference on Knowledge and Smart Technology (KST)", pages: "1–6",
      doi: "10.1109/KST53302.2022.9729077",
    },
    {
      year: 2022, type: "journal", topics: ["data"],
      title: "Exploiting Long- and Short-Term Preferences for Deep Context-Aware Recommendations",
      authors: ["Tipajin Thaipisutikul", "Timothy K. Shih", "Avirmed Enkhbat", "Wisnu Aditya"],
      venue: "IEEE Transactions on Computational Social Systems", volume: "9", pages: "1237–1248",
      doi: "10.1109/TCSS.2021.3116059",
    },
    {
      year: 2021, type: "journal", topics: ["vision"],
      title: "Domain Adaptation Deep Attention Network for Automatic Logo Detection and Recognition in Google Street View",
      authors: ["Ervin Yohannes", "Chih-Yang Lin", "Timothy K. Shih", "Chen-Ya Hong", "Avirmed Enkhbat", "Fitri Utaminingrum"],
      venue: "IEEE Access", volume: "9", pages: "102623–102635",
      doi: "10.1109/ACCESS.2021.3098713",
    },
    {
      year: 2020, type: "conference", topics: ["hci"], featured: true,
      title: "HandKey: An Efficient Hand Typing Recognition using CNN for Virtual Keyboard",
      authors: ["Avirmed Enkhbat", "Timothy K. Shih", "Tipajin Thaipisutikul", "Noorkholis Luthfil Hakim", "Wisnu Aditya"],
      venue: "5th International Conference on Information Technology (InCIT)", pages: "315–319",
      doi: "10.1109/InCIT50588.2020.9310783",
    },
    {
      year: 2020, type: "conference", topics: ["hci"],
      title: "IC4Windows – Hand Gesture for Controlling MS Windows",
      authors: ["Wisnu Aditya", "Noorkholis Luthfil Hakim", "Timothy K. Shih", "Avirmed Enkhbat", "Tipajin Thaipisutikul"],
      venue: "5th International Conference on Information Technology (InCIT)", pages: "310–314",
      doi: "10.1109/InCIT50588.2020.9310967",
    },
  ],

  // Ongoing work shown at the top of the Research section.
  now: {
    title: { mn: "Хиймэл оюун ухаан ашиглан замын эвдрэл илрүүлэх", en: "Road Damage Detection Using Artificial Intelligence" },
    body: {
      mn: "Машины нэг камерын зургийг замын хавтгайн дээрээс харсан харагдац (BEV) руу хувиргаж, перспектив харагдацтай нэгтгэн YOLO26-аар замын эвдрэлийг илрүүлж, хэмжээг нь метрээр гаргана.",
      en: "Turning a single dashcam view into a bird’s-eye view of the road plane and fusing it with the perspective view, so YOLO26 detects road damage — and measures it in metres.",
    },
    stats: [
      { value: "0.633", label: { mn: "mAP50 · перспектив + BEV нэгтгэл", en: "mAP50 · perspective + BEV fusion" } },
      { value: "33,846", label: { mn: "сургалтын зураг · RDD2022, SVRDD", en: "training images · RDD2022, SVRDD" } },
      { value: "17–23", label: { mn: "FPS · бодит dashcam видео", en: "FPS · real dashcam video" } },
    ],
  },

  research: [
    {
      topic: "action", glyph: "skeleton",
      title: { mn: "Үе мөчний цэгт суурилсан үйлдэл таних", en: "Skeleton-based Action Recognition" },
      body: {
        mn: "Хүний биеийн үеийг граф болгон, орон зай-цаг хугацааны анхаарлын механизмтай граф нейрон сүлжээгээр (STA-GCN) үйлдлийг таньдаг. Хөгжмийн зэмсэг тоглох хөдөлгөөнийг таньж, алдааг засах систем дээр докторын ажлаа хийсэн.",
        en: "Modelling the body as a graph of joints and recognising actions with spatial-temporal attention graph networks (STA-GCN). Doctoral work on recognising, and correcting, the motions of playing a musical instrument.",
      },
    },
    {
      topic: "hci", glyph: "hand",
      title: { mn: "Гарын дохио & хүн-компьютерийн харилцаа", en: "Hand Gesture & Human–Computer Interaction" },
      body: {
        mn: "Ганц RGB камераар гарын хөдөлгөөнийг таньж, агаарт бичих виртуал гар (HandKey) болон Windows-ыг дохио зангаагаар удирдах (IC4Windows) системүүд.",
        en: "Single-RGB-camera hand tracking for typing on a virtual keyboard in mid-air (HandKey) and for controlling MS Windows with gestures (IC4Windows).",
      },
    },
    {
      topic: "vision", glyph: "eye",
      title: { mn: "Видео ба дүрсний ойлголт", en: "Video & Visual Understanding" },
      body: {
        mn: "Нэг объект мөрдөх, монокуляр видеоноос хурд тооцоолох, Google Street View дээр лого таних, гиперспектрал дүрс ангилах.",
        en: "Single object tracking, speed estimation from monocular video, logo detection in Google Street View, hyperspectral image classification.",
      },
    },
    {
      topic: "data", glyph: "graph",
      title: { mn: "Дараалсан өгөгдөл & олборлолт", en: "Sequential Data & Mining" },
      body: {
        mn: "Хэрэглэгчийн урт ба богино хугацааны сонирхолд суурилсан санал болгох систем, инфодемик илрүүлэх, LSTM-ээр хувьцааны үнэ таамаглах.",
        en: "Context-aware recommendation from long- and short-term preferences, infodemic detection, and stock forecasting with LSTMs.",
      },
    },
  ],

  courses: [
    {
      code: "ICSI201", credits: 3,
      title: { mn: "Объект хандлагат программчлал", en: "Object-Oriented Programming" },
      terms: { mn: "Намар 2025, 2026 · Хавар 2026", en: "Fall 2025, 2026 · Spring 2026" },
    },
    {
      code: "ICSI687", credits: 3,
      title: { mn: "Өгөгдлийн уурхай, олборлолт", en: "Data Mining" },
      terms: { mn: "Хавар 2026", en: "Spring 2026" },
    },
    {
      code: "CSII201", credits: 3,
      title: { mn: "Программчлалын хэл", en: "Programming Languages" },
      terms: { mn: "Хавар 2026", en: "Spring 2026" },
    },
    {
      code: "COMP100", credits: 3,
      title: { mn: "Компьютер тооцооллын үндэс", en: "Foundations of Computing" },
      terms: { mn: "Хавар 2025", en: "Spring 2025" },
    },
  ],

  links: [
    { key: "email", label: "avirmed.e@num.edu.mn", href: "mailto:avirmed.e@num.edu.mn" },
    { key: "num", label: { mn: "МУИС профайл", en: "NUM profile" }, href: "https://www.num.edu.mn/about/num-people/details?id=79713F65-5087-4661-9439-900506D01AE5&uid=1001298" },
    { key: "scopus", label: "Scopus", href: "https://www.scopus.com/authid/detail.uri?authorId=57221787377" },
    { key: "orcid", label: "ORCID", href: "https://orcid.org/0000-0002-9552-4784" },
    { key: "rg", label: "ResearchGate", href: "https://www.researchgate.net/profile/Avirmed-Enkhbat" },
    { key: "github", label: "GitHub", href: "https://github.com/Avirmed" },
  ],
};
