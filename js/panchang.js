/* ==========================================================================
   Sufiology panchang maths: the real position of the Moon and Sun.

   Used by the "Moon right now" section (js/visuals.js). Nothing here touches the page.

   Method (all in the browser, nothing is sent anywhere):
   - Moon longitude: the main terms of the lunar theory in Jean Meeus, "Astronomical
     Algorithms", chapter 47. Good to about 0.01 degree (the Moon moves 0.5 degree an hour,
     so that is about a minute of time).
   - Sun longitude: Meeus chapter 25, good to about 0.01 degree.
   - Sidereal sign and star: the Lahiri (Chitrapaksha) ayanamsa, the one most Indian panchangs use.
   - Tithi: every 12 degrees the Moon gets ahead of the Sun is one tithi.
   - Nakshatra: 27 stars of 13 degrees 20 minutes each, 4 padas of 3 degrees 20 minutes each.

   Public interface: window.SufPanchang
     moonNow(date)       -> phase, sidereal sign, birth star, pada and tithi at that moment
     tithiEndsAt(date)   -> when the running tithi ends
   ========================================================================== */
(function () {
  "use strict";

  const DEGREES_PER_RASHI = 30;
  const DEGREES_PER_NAKSHATRA = 360 / 27;           // 13 degrees 20 minutes
  const DEGREES_PER_PADA = DEGREES_PER_NAKSHATRA / 4;
  const DEGREES_PER_TITHI = 12;
  const JULIAN_DAY_OF_J2000 = 2451545.0;
  const LAHIRI_AYANAMSA_AT_J2000 = 23.853056;       // 23 degrees 51 minutes 11 seconds, 1 Jan 2000

  const toRadians = (degrees) => degrees * Math.PI / 180;
  const wrap360 = (degrees) => ((degrees % 360) + 360) % 360;
  const sinDegrees = (degrees) => Math.sin(toRadians(degrees));


  /* ---------- Time ---------- */

  function julianDay(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  // The difference between the clock Earth turns by (UT) and the clock the planets follow (TD), in seconds.
  // A rough fit is plenty: 30 seconds of error moves the Moon only 0.004 degree.
  function deltaTSeconds(year) {
    if (year >= 2005) { const t = year - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    if (year >= 1986) { const t = year - 2000; return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
    if (year >= 1961) { const t = year - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
    return 30;
  }

  // Julian centuries since J2000, on the planets' clock
  function centuriesSinceJ2000(date) {
    const dynamicalDay = julianDay(date) + deltaTSeconds(date.getUTCFullYear()) / 86400;
    return (dynamicalDay - JULIAN_DAY_OF_J2000) / 36525;
  }


  /* ---------- The Moon (Meeus ch. 47, longitude only) ---------- */

  // Each row: [D, M, M', F, size of the term in millionths of a degree]
  const MOON_LONGITUDE_TERMS = [
    [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618],
    [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066],
    [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
    [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980],
    [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
    [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
    [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689],
    [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390], [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236],
    [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
    [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892],
    [2, 1, 1, 0, -810], [4, -1, -2, 0, 759], [0, 2, -1, 0, -713], [2, 2, -1, 0, -700],
    [2, 1, -2, 0, 691], [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
    [4, -1, 0, 0, 520], [1, 0, -2, 0, -487], [2, 1, 0, -2, -399], [0, 0, 2, -2, -381],
    [1, 1, 1, 0, 351], [3, 0, -2, 0, -340], [4, 0, -3, 0, 330], [2, -1, 2, 0, 327],
    [0, 2, 1, 0, -323], [1, 1, -1, 0, 299], [2, 0, 3, 0, 294]
  ];

  // Tropical longitude of the Moon in degrees (measured from the equinox of the date)
  function moonTropicalLongitude(date) {
    const t = centuriesSinceJ2000(date);
    const meanLongitude = wrap360(218.3164477 + 481267.88123421 * t - 0.0015786 * t * t + t ** 3 / 538841 - t ** 4 / 65194000);
    const elongation    = wrap360(297.8501921 + 445267.1114034 * t - 0.0018819 * t * t + t ** 3 / 545868 - t ** 4 / 113065000);
    const sunAnomaly    = wrap360(357.5291092 + 35999.0502909 * t - 0.0001536 * t * t + t ** 3 / 24490000);
    const moonAnomaly   = wrap360(134.9633964 + 477198.8675055 * t + 0.0087414 * t * t + t ** 3 / 69699 - t ** 4 / 14712000);
    const latitudeArg   = wrap360(93.2720950 + 483202.0175233 * t - 0.0036539 * t * t - t ** 3 / 3526000 + t ** 4 / 863310000);
    const eccentricity  = 1 - 0.002516 * t - 0.0000074 * t * t;       // shrinks the terms that use the Sun's anomaly

    let sum = 0;
    for (const [d, m, mPrime, f, size] of MOON_LONGITUDE_TERMS) {
      const argument = d * elongation + m * sunAnomaly + mPrime * moonAnomaly + f * latitudeArg;
      const scale = m === 0 ? 1 : (Math.abs(m) === 1 ? eccentricity : eccentricity * eccentricity);
      sum += size * scale * sinDegrees(argument);
    }
    // Small extra terms (Venus, Jupiter and the flattening of the Earth)
    const venus = wrap360(119.75 + 131.849 * t);
    const jupiter = wrap360(53.09 + 479264.290 * t);
    sum += 3958 * sinDegrees(venus) + 1962 * sinDegrees(meanLongitude - latitudeArg) + 318 * sinDegrees(jupiter);

    return wrap360(meanLongitude + sum / 1e6);
  }


  /* ---------- The Sun (Meeus ch. 25) ---------- */

  // Tropical longitude of the Sun in degrees, corrected for the light's travel time (aberration)
  function sunTropicalLongitude(date) {
    const t = centuriesSinceJ2000(date);
    const meanLongitude = 280.46646 + 36000.76983 * t + 0.0003032 * t * t;
    const anomaly = 357.52911 + 35999.05029 * t - 0.0001537 * t * t;
    const equationOfCentre =
      (1.914602 - 0.004817 * t - 0.000014 * t * t) * sinDegrees(anomaly) +
      (0.019993 - 0.000101 * t) * sinDegrees(2 * anomaly) +
      0.000289 * sinDegrees(3 * anomaly);
    return wrap360(meanLongitude + equationOfCentre - 0.00569);
  }


  /* ---------- Lahiri ayanamsa ---------- */

  // How far the zodiac of the stars (sidereal) is behind the zodiac of the seasons (tropical), in degrees
  function lahiriAyanamsa(date) {
    const t = centuriesSinceJ2000(date);
    const precessionArcSeconds = 5028.796195 * t + 1.1054348 * t * t;
    return LAHIRI_AYANAMSA_AT_J2000 + precessionArcSeconds / 3600;
  }


  /* ---------- Everything about the Moon at one moment ---------- */

  function moonNow(date) {
    const moonTropical = moonTropicalLongitude(date);
    const sunTropical = sunTropicalLongitude(date);
    const siderealMoon = wrap360(moonTropical - lahiriAyanamsa(date));
    const elongation = wrap360(moonTropical - sunTropical);       // 0 = new moon, 180 = full moon
    const tithiNumber = Math.floor(elongation / DEGREES_PER_TITHI) + 1;   // 1 to 30

    return {
      siderealMoon,
      elongation,
      litFraction: (1 - Math.cos(toRadians(elongation))) / 2,
      isWaxing: elongation < 180,
      rashiIndex: Math.floor(siderealMoon / DEGREES_PER_RASHI),               // 0 = Mesha
      degreesInRashi: siderealMoon % DEGREES_PER_RASHI,
      nakshatraIndex: Math.floor(siderealMoon / DEGREES_PER_NAKSHATRA),       // 0 = Ashwini
      pada: Math.floor((siderealMoon % DEGREES_PER_NAKSHATRA) / DEGREES_PER_PADA) + 1,
      tithiNumber,                                                            // 1 to 30
      tithiInPaksha: tithiNumber > 15 ? tithiNumber - 15 : tithiNumber,       // 1 to 15
      isShukla: tithiNumber <= 15
    };
  }

  // When does the tithi that is running at `date` end? Steps forward, then narrows it down to a minute.
  function tithiEndsAt(date) {
    const STEP_MINUTES = 20;
    const currentTithi = moonNow(date).tithiNumber;
    let before = date.getTime();
    for (let step = 0; step < 100; step++) {                        // a tithi never lasts more than about 27 hours
      const after = before + STEP_MINUTES * 60000;
      if (moonNow(new Date(after)).tithiNumber !== currentTithi) {
        let low = before, high = after;
        while (high - low > 30000) {
          const middle = (low + high) / 2;
          if (moonNow(new Date(middle)).tithiNumber === currentTithi) low = middle; else high = middle;
        }
        return new Date(high);
      }
      before = after;
    }
    return null;
  }


  window.SufPanchang = {
    moonNow, tithiEndsAt,
    // exposed for testing
    moonTropicalLongitude, sunTropicalLongitude, lahiriAyanamsa
  };
})();
