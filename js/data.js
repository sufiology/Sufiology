/* ==========================================================================
   Sufiology: all the content and constants in one place.
   To change a price, a Hindi spelling or a planet description, edit it here.
   Loaded first; the other scripts read window.SUF_DATA.
   ========================================================================== */
window.SUF_DATA = {

  /* ----- Sessions. Prices are in rupees. Also shown as text in index.html (service cards). ----- */
  sessions: {
    dwapara: { name: "Dwapara", price: 2000, length: "20 minutes" },
    treta:   { name: "Treta",   price: 3200, length: "30 minutes" },
    satya:   { name: "Satya",   price: 6000, length: "45 minutes" }
  },

  /* ----- Booking status. "key" is what the database stores (supabase/migrations/007_booking_status.sql).
         "label" is shown on buttons and pills. "note" is the sentence the client reads under their request.
         The admin picks one on the Dashboard. A new request always starts as not_seen. ----- */
  bookingStatuses: [
    { key: "not_seen",  label: "Not seen",  note: "Your request has been sent. Nishaad Sharma has not opened it yet." },
    { key: "seen",      label: "Seen",      note: "Nishaad Sharma has read your request. A reply by email or WhatsApp is coming." },
    { key: "scheduled", label: "Scheduled", note: "Your session is scheduled. Check your email or WhatsApp for the time, payment details and video call link." },
    { key: "done",      label: "Done",      note: "Your session is done. Thank you." }
  ],

  /* ----- Booking rules (the server enforces the same numbers in request-slot) ----- */
  maxRequestsPerWeek: 2,

  /* ----- Phone numbers: country code, name, and how many digits the number must have
         (without the country code). India is listed first and is the default.
         The server (supabase/functions/request-slot) has the same table. ----- */
  countries: [
    { code: "+91", name: "India", min: 10, max: 10 },
    { code: "+1", name: "USA / Canada", min: 10, max: 10 },
    { code: "+44", name: "UK", min: 10, max: 10 },
    { code: "+971", name: "UAE", min: 9, max: 9 },
    { code: "+65", name: "Singapore", min: 8, max: 8 },
    { code: "+61", name: "Australia", min: 9, max: 9 },
    { code: "+92", name: "Pakistan", min: 10, max: 10 },
    { code: "+880", name: "Bangladesh", min: 10, max: 10 },
    { code: "+977", name: "Nepal", min: 10, max: 10 },
    { code: "+94", name: "Sri Lanka", min: 9, max: 9 },
    { code: "+93", name: "Afghanistan", min: 9, max: 9 },
    { code: "+54", name: "Argentina", min: 10, max: 11 },
    { code: "+43", name: "Austria", min: 10, max: 11 },
    { code: "+973", name: "Bahrain", min: 8, max: 8 },
    { code: "+32", name: "Belgium", min: 9, max: 9 },
    { code: "+975", name: "Bhutan", min: 8, max: 8 },
    { code: "+55", name: "Brazil", min: 10, max: 11 },
    { code: "+673", name: "Brunei", min: 7, max: 7 },
    { code: "+855", name: "Cambodia", min: 8, max: 9 },
    { code: "+86", name: "China", min: 11, max: 11 },
    { code: "+420", name: "Czechia", min: 9, max: 9 },
    { code: "+45", name: "Denmark", min: 8, max: 8 },
    { code: "+20", name: "Egypt", min: 10, max: 10 },
    { code: "+251", name: "Ethiopia", min: 9, max: 9 },
    { code: "+679", name: "Fiji", min: 7, max: 7 },
    { code: "+358", name: "Finland", min: 9, max: 10 },
    { code: "+33", name: "France", min: 9, max: 9 },
    { code: "+49", name: "Germany", min: 10, max: 11 },
    { code: "+233", name: "Ghana", min: 9, max: 9 },
    { code: "+30", name: "Greece", min: 10, max: 10 },
    { code: "+852", name: "Hong Kong", min: 8, max: 8 },
    { code: "+36", name: "Hungary", min: 9, max: 9 },
    { code: "+62", name: "Indonesia", min: 9, max: 12 },
    { code: "+98", name: "Iran", min: 10, max: 10 },
    { code: "+964", name: "Iraq", min: 10, max: 10 },
    { code: "+353", name: "Ireland", min: 9, max: 9 },
    { code: "+972", name: "Israel", min: 9, max: 9 },
    { code: "+39", name: "Italy", min: 9, max: 10 },
    { code: "+81", name: "Japan", min: 10, max: 10 },
    { code: "+962", name: "Jordan", min: 9, max: 9 },
    { code: "+254", name: "Kenya", min: 9, max: 9 },
    { code: "+965", name: "Kuwait", min: 8, max: 8 },
    { code: "+961", name: "Lebanon", min: 7, max: 8 },
    { code: "+60", name: "Malaysia", min: 9, max: 10 },
    { code: "+960", name: "Maldives", min: 7, max: 7 },
    { code: "+230", name: "Mauritius", min: 8, max: 8 },
    { code: "+52", name: "Mexico", min: 10, max: 10 },
    { code: "+95", name: "Myanmar", min: 8, max: 10 },
    { code: "+31", name: "Netherlands", min: 9, max: 9 },
    { code: "+64", name: "New Zealand", min: 8, max: 10 },
    { code: "+234", name: "Nigeria", min: 10, max: 10 },
    { code: "+47", name: "Norway", min: 8, max: 8 },
    { code: "+968", name: "Oman", min: 8, max: 8 },
    { code: "+63", name: "Philippines", min: 10, max: 10 },
    { code: "+48", name: "Poland", min: 9, max: 9 },
    { code: "+351", name: "Portugal", min: 9, max: 9 },
    { code: "+974", name: "Qatar", min: 8, max: 8 },
    { code: "+40", name: "Romania", min: 9, max: 9 },
    { code: "+7", name: "Russia / Kazakhstan", min: 10, max: 10 },
    { code: "+966", name: "Saudi Arabia", min: 9, max: 9 },
    { code: "+248", name: "Seychelles", min: 7, max: 7 },
    { code: "+27", name: "South Africa", min: 9, max: 9 },
    { code: "+82", name: "South Korea", min: 9, max: 10 },
    { code: "+34", name: "Spain", min: 9, max: 9 },
    { code: "+46", name: "Sweden", min: 9, max: 9 },
    { code: "+41", name: "Switzerland", min: 9, max: 9 },
    { code: "+255", name: "Tanzania", min: 9, max: 9 },
    { code: "+66", name: "Thailand", min: 9, max: 9 },
    { code: "+90", name: "Turkey", min: 10, max: 10 },
    { code: "+256", name: "Uganda", min: 9, max: 9 },
    { code: "+380", name: "Ukraine", min: 9, max: 9 },
    { code: "+84", name: "Vietnam", min: 9, max: 9 }
  ],

  /* ----- Twelve rashis. hi = Devanagari, en = Sanskrit name in English letters ----- */
  rashis: [
    { hi: "मेष",     en: "Mesha",      sign: "Aries",       ruler: "Mangala (Mars)",   element: "fire"  },
    { hi: "वृषभ",    en: "Vrishabha",  sign: "Taurus",      ruler: "Shukra (Venus)",   element: "earth" },
    { hi: "मिथुन",   en: "Mithuna",    sign: "Gemini",      ruler: "Budha (Mercury)",  element: "air"   },
    { hi: "कर्क",    en: "Karka",      sign: "Cancer",      ruler: "Chandra (Moon)",   element: "water" },
    { hi: "सिंह",    en: "Simha",      sign: "Leo",         ruler: "Surya (Sun)",      element: "fire"  },
    { hi: "कन्या",   en: "Kanya",      sign: "Virgo",       ruler: "Budha (Mercury)",  element: "earth" },
    { hi: "तुला",    en: "Tula",       sign: "Libra",       ruler: "Shukra (Venus)",   element: "air"   },
    { hi: "वृश्चिक", en: "Vrishchika", sign: "Scorpio",     ruler: "Mangala (Mars)",   element: "water" },
    { hi: "धनु",     en: "Dhanu",      sign: "Sagittarius", ruler: "Guru (Jupiter)",   element: "fire"  },
    { hi: "मकर",     en: "Makara",     sign: "Capricorn",   ruler: "Shani (Saturn)",   element: "earth" },
    { hi: "कुंभ",    en: "Kumbha",     sign: "Aquarius",    ruler: "Shani (Saturn)",   element: "air"   },
    { hi: "मीन",     en: "Meena",      sign: "Pisces",      ruler: "Guru (Jupiter)",   element: "water" }
  ],

  /* ----- The nine grahas drawn in the orbit animation.
         orbit = size of the orbit (0 to 1), speed = how fast it circles (negative = backwards),
         size = planet radius in pixels at full size. ----- */
  /* The Sun sits in the middle of the orbit animation (it is not one of the circling grahas). */
  sun: { name: "Surya", english: "Sun", about: "Soul, vitality, authority, and the father." },

  grahas: [
    { name: "Chandra", english: "Moon",       orbit: .19, speed:  2.4,  color: "#fffaf0", size: 13, about: "Mind, emotions, and the mother." },
    { name: "Budha",   english: "Mercury",    orbit: .28, speed:  1.7,  color: "#5a4733", size: 11, about: "Speech, analysis, trade, and learning." },
    { name: "Shukra",  english: "Venus",      orbit: .37, speed:  1.25, color: "#c7121c", size: 15, about: "Love, art, comfort, and pleasure." },
    { name: "Mangala", english: "Mars",       orbit: .46, speed:  .95,  color: "#9e0d15", size: 13, about: "Drive, courage, and conflict." },
    { name: "Guru",    english: "Jupiter",    orbit: .55, speed:  .6,   color: "#fbefd6", size: 22, about: "Wisdom, teachers, growth, and fortune.", ring: "thin" },
    { name: "Shani",   english: "Saturn",     orbit: .64, speed:  .4,   color: "#120d09", size: 18, about: "Discipline, delay, duty, and endurance.", ring: "wide" },
    { name: "Rahu",    english: "North node", orbit: .73, speed: -.27,  color: "#5a4733", size: 12, about: "Ambition, obsession, and the unfamiliar." },
    { name: "Ketu",    english: "South node", orbit: .82, speed: -.27,  color: "#120d09", size: 12, about: "Detachment, insight, and what you have outgrown.", oppositeOf: "Rahu" }
  ],

  /* ----- Weekday finder. Index 0 = Sunday. ----- */
  weekdays: [
    { day: "Sunday",    hi: "सूर्य",   name: "Surya",   english: "Sun",     about: "Soul, vitality, authority, and the father." },
    { day: "Monday",    hi: "चंद्र",   name: "Chandra", english: "Moon",    about: "Mind, emotions, and the mother." },
    { day: "Tuesday",   hi: "मंगल",   name: "Mangala", english: "Mars",    about: "Drive, courage, and conflict." },
    { day: "Wednesday", hi: "बुध",    name: "Budha",   english: "Mercury", about: "Speech, analysis, trade, and learning." },
    { day: "Thursday",  hi: "गुरु",   name: "Guru",    english: "Jupiter", about: "Wisdom, teachers, growth, and fortune." },
    { day: "Friday",    hi: "शुक्र",   name: "Shukra",  english: "Venus",   about: "Love, art, comfort, and pleasure." },
    { day: "Saturday",  hi: "शनि",    name: "Shani",   english: "Saturn",  about: "Discipline, delay, duty, and endurance." }
  ],

  /* ----- "What is stuck in your life?" buttons: [label, answer, heading] ----- */
  concerns: [
    ["Career",     "The tenth house, Karma, covers work and public standing.",                           "Tenth house: Karma"],
    ["Money",      "The second and eleventh houses cover income, savings and gains.",                    "Second and eleventh houses"],
    ["Love",       "The seventh house, Kalatra, covers marriage and one-to-one bonds.",                  "Seventh house: Kalatra"],
    ["Timing",     "The dasha periods show when a stretch of life tends to open or stall.",              "The dasha periods"],
    ["Home",       "The fourth house, Sukha, covers home, family and inner peace.",                      "Fourth house: Sukha"],
    ["Everything", "When it is not one area but a pattern, the whole chart needs reading.",              "The whole chart"]
  ],

  /* ----- The 27 nakshatras (birth stars), in order from Ashwini. hi = Devanagari, en = Sanskrit name in English letters.
         The ruling graha of each one follows the Vimshottari order, repeated three times (nakshatraLords below). ----- */
  nakshatras: [
    { hi: "अश्विनी",        en: "Ashwini" },        { hi: "भरणी",          en: "Bharani" },
    { hi: "कृत्तिका",       en: "Krittika" },       { hi: "रोहिणी",        en: "Rohini" },
    { hi: "मृगशिरा",        en: "Mrigashira" },     { hi: "आर्द्रा",       en: "Ardra" },
    { hi: "पुनर्वसु",       en: "Punarvasu" },      { hi: "पुष्य",         en: "Pushya" },
    { hi: "आश्लेषा",        en: "Ashlesha" },       { hi: "मघा",           en: "Magha" },
    { hi: "पूर्व फाल्गुनी",  en: "Purva Phalguni" }, { hi: "उत्तर फाल्गुनी", en: "Uttara Phalguni" },
    { hi: "हस्त",           en: "Hasta" },          { hi: "चित्रा",        en: "Chitra" },
    { hi: "स्वाती",         en: "Swati" },          { hi: "विशाखा",        en: "Vishakha" },
    { hi: "अनुराधा",        en: "Anuradha" },       { hi: "ज्येष्ठा",       en: "Jyeshtha" },
    { hi: "मूल",            en: "Mula" },           { hi: "पूर्वाषाढा",     en: "Purva Ashadha" },
    { hi: "उत्तराषाढा",      en: "Uttara Ashadha" }, { hi: "श्रवण",         en: "Shravana" },
    { hi: "धनिष्ठा",        en: "Dhanishta" },      { hi: "शतभिषा",        en: "Shatabhisha" },
    { hi: "पूर्वभाद्रपद",    en: "Purva Bhadrapada" }, { hi: "उत्तरभाद्रपद",   en: "Uttara Bhadrapada" },
    { hi: "रेवती",          en: "Revati" }
  ],
  nakshatraLords: ["Ketu", "Shukra (Venus)", "Surya (Sun)", "Chandra (Moon)", "Mangala (Mars)",
                   "Rahu", "Guru (Jupiter)", "Shani (Saturn)", "Budha (Mercury)"],

  /* ----- Moon section: tithi names (Purnima and Amavasya are handled separately) ----- */
  tithis: ["Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami",
           "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi"],

  /* ----- Words in the second (dark) marquee ----- */
  marqueeWords: ["Karma", "Dhana", "Kalatra", "Sukha", "Labha", "Dharma"]
};
