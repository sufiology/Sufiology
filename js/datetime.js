/* Date and time fields (v32).
   Every <input type="date"> and <input type="time"> on the page gets two ways in:
   1. type it: dd/mm/yyyy for dates, hh:mm for times (the slashes and colon are added for you; the full keyboard opens and a pop-up explains any wrong character);
   2. tap the small calendar or clock icon to pick from the phone's own picker.

   The original input stays in the page, hidden, and always holds the clean value the rest of the site reads
   (yyyy-mm-dd and hh:mm). Only the visible text box shows dd/mm/yyyy and hh:mm. app.js and visuals.js did not change. */
(function () {
  "use strict";

  const MAX_YEAR = 2100;
  const CALENDAR_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  const CLOCK_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  const pad = (number) => String(number).padStart(2, "0");

  /* ----- Dates ----- */

  // "1990-04-07" -> "07/04/1990"
  function isoToDisplay(iso) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return parts ? `${parts[3]}/${parts[2]}/${parts[1]}` : "";
  }

  // "07/04/1990" -> "1990-04-07", or "" if it is not a real date (31/02/2020 is rejected)
  function displayToIso(text) {
    const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    if (!parts) return "";
    const day = +parts[1], month = +parts[2], year = +parts[3];
    const check = new Date(year, month - 1, day);
    const real = check.getFullYear() === year && check.getMonth() === month - 1 && check.getDate() === day;
    return real && year >= 1900 && year <= MAX_YEAR ? `${parts[3]}-${parts[2]}-${parts[1]}` : "";
  }

  // While typing: the slashes are added for you (07041990 -> 07/04/1990), and a slash you type yourself is kept
  // after the day or the month (12/ stays 12/, and 5/ becomes 05/). A slash anywhere else is dropped.
  function typeDate(raw) {
    const limit = [2, 2, 4], parts = ["", "", ""];
    let at = 0;
    for (const character of raw) {
      if (/\d/.test(character)) {
        if (parts[at].length >= limit[at]) { if (at === 2) continue; at++; }
        parts[at] += character;
      } else if (/[\/.\-\s]/.test(character) && parts[at] && at < 2) {
        if (parts[at].length === 1) parts[at] = "0" + parts[at];
        at++;
      }
    }
    let text = parts[0];
    if (at >= 1) text += "/" + parts[1];
    if (at >= 2) text += "/" + parts[2];
    return text;
  }

  /* ----- Times ----- */

  // Accepts 18:30, 6:30 pm, 06:30PM. Returns "18:30" (24-hour) or "" when it is not a real time.
  function displayToTime(text) {
    const parts = /^(\d{1,2}):(\d{2})\s*([ap]m)?$/i.exec(text.trim());
    if (!parts) return "";
    let hour = +parts[1];
    const minute = +parts[2], marker = (parts[3] || "").toLowerCase();
    if (minute > 59) return "";
    if (marker) {
      if (hour < 1 || hour > 12) return "";
      hour = hour % 12 + (marker === "pm" ? 12 : 0);
    } else if (hour > 23) {
      return "";
    }
    return `${pad(hour)}:${pad(minute)}`;
  }

  // While typing: a colon is added after the hour (1830 -> 18:30, 630 -> 6:30). A colon you type yourself is kept,
  // and a trailing a or p becomes AM or PM (6:30p -> 6:30 PM).
  function typeTime(raw) {
    const marker = (/([ap])\s*m?\s*$/i.exec(raw) || [])[1];
    const written = /^\s*(\d{1,2})[:.](\d{0,2})/.exec(raw);
    let text;
    if (written) {
      text = written[1] + ":" + written[2];
    } else {
      const digits = raw.replace(/[^\d]/g, "").slice(0, 4);
      const hourLength = +digits[0] > 2 ? 1 : 2;       // 6 can only be the hour 6; 1 or 2 may start 10 to 23
      text = digits.slice(0, hourLength);
      if (digits.length > hourLength) text += ":" + digits.slice(hourLength);
    }
    const hourNow = +text.split(":")[0];
    if (marker && text.length >= 3 && hourNow >= 1 && hourNow <= 12) text += " " + marker.toUpperCase() + "M";
    return text;
  }

  /* ----- Build one field ----- */

  function enhance(native) {
    const isDate = native.type === "date";
    const wrapper = document.createElement("span");
    wrapper.className = "dt";

    const text = document.createElement("input");
    text.type = "text";
    text.className = "dt-text";
    text.inputMode = "text";            // v31: the full keyboard opens (not the number pad); wrong characters are caught below and explained
    text.autocomplete = "off";
    text.maxLength = isDate ? 10 : 8;
    text.placeholder = isDate ? "dd/mm/yyyy" : "hh:mm (24-hour)";
    text.required = native.required;
    text.setAttribute("aria-label", native.getAttribute("aria-label") || (isDate ? "Date, day / month / year" : "Time, hours : minutes"));

    const button = document.createElement("button");
    button.type = "button";
    button.className = "dt-pick";
    button.innerHTML = isDate ? CALENDAR_ICON : CLOCK_ICON;
    button.setAttribute("aria-label", isDate ? "Pick a date from the calendar" : "Pick a time from the clock");

    // Swap: the original input moves inside the wrapper, hidden but still alive, so the picker can open from it
    native.parentNode.insertBefore(wrapper, native);
    wrapper.append(text, button, native);
    // Time boxes say which format to use (v25). Typing "6:30 pm" also works and is turned into 24-hour time.
    if (!isDate) {
      const hint = document.createElement("small");
      hint.className = "dt-hint";
      hint.textContent = "24-hour time, for example 18:30. You can also type 6:30 pm.";
      wrapper.after(hint);
    }
    native.classList.add("dt-native");
    native.required = false;            // the visible box does the "required" check instead
    native.tabIndex = -1;
    native.setAttribute("aria-hidden", "true");

    function showProblem(message) { text.setCustomValidity(message); }

    /* Warning bubble (v31): a small pop-up under the box that explains the right format and mentions the icon.
       It hides by itself after a few seconds, when the box is fixed, or when it is tapped. */
    const FORMAT_HELP = isDate
      ? "Wrong format. Type the date as dd/mm/yyyy, for example 07/04/1990, or tap the calendar icon to pick it."
      : "Wrong format. Type the time as hh:mm, for example 18:30 (or 6:30 pm), or tap the clock icon to pick it.";
    const bubble = document.createElement("span");
    bubble.className = "dt-warn";
    bubble.setAttribute("role", "alert");
    bubble.hidden = true;
    wrapper.append(bubble);
    let bubbleTimer = null;
    function warn(message) {
      document.querySelectorAll(".dt-warn").forEach((other) => { other.hidden = true; });   // only one pop-up at a time
      bubble.textContent = message;
      bubble.hidden = false;
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(hideWarning, 5000);
    }
    function hideWarning() { clearTimeout(bubbleTimer); bubble.hidden = true; }
    bubble.addEventListener("click", hideWarning);

    // Text box -> hidden input. Sends an "input" event so the rest of the site reacts exactly as before.
    function sendToNative(value) {
      if (native.value === value) return;
      native.value = value;
      native.dispatchEvent(new Event("input", { bubbles: true }));
      native.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function check() {
      const value = isDate ? displayToIso(text.value) : displayToTime(text.value);
      if (!text.value) {
        showProblem(text.required ? "Please fill this in." : "");
        sendToNative("");
      } else if (!value) {
        showProblem(isDate ? "Enter a real date as dd/mm/yyyy, for example 07/04/1990." : "Enter a real time as hh:mm, for example 18:30.");
        sendToNative("");
      } else if (isDate && native.min && value < native.min) {
        showProblem("Bookings can only be made for today or a future date, not for a date that has already passed.");
        sendToNative("");
      } else if (isDate && native.max && value > native.max) {
        showProblem(native.id === "fBirthDate" ? "Date of birth must be before your booking date. Please check the year." : "This date cannot be in the future.");   // app.js sets max
        sendToNative("");
      } else {
        showProblem("");
        hideWarning();
        sendToNative(value);
      }
    }

    text.addEventListener("input", (event) => {
      // Deleting (backspace, cut) is never reformatted, so you can always remove what you typed (v32 fix)
      if (event.inputType && event.inputType.indexOf("delete") === 0) { hideWarning(); check(); return; }
      // Characters that can never be part of a date or a time are removed, and the pop-up says what to type instead
      const notAllowed = isDate ? /[^\d\/.\-\s]/ : /[^\d:.\sapm]/i;
      const hadWrongCharacter = notAllowed.test(text.value);
      text.value = isDate ? typeDate(text.value) : typeTime(text.value);
      if (hadWrongCharacter) warn(FORMAT_HELP);
      check();
      if (isDate && text.value.length === 10 && text.validationMessage) warn(text.validationMessage);   // full date typed but not allowed
    });
    // Send pressed while this box is wrong: show the pop-up that says why (v32 fix)
    // preventDefault hides the browser's own grey bubble, so only our pop-up shows (v33: they used to sit on top of each other)
    text.addEventListener("invalid", (event) => { event.preventDefault(); warn(text.validationMessage); });
    // When you leave the box, tidy a time like "6:30 pm" into 18:30 so the format is always the same
    text.addEventListener("blur", () => {
      const value = isDate ? displayToIso(text.value) : displayToTime(text.value);
      if (value) text.value = isDate ? isoToDisplay(value) : value;
      // Left the box with something that is not a real date or time: explain it
      if (text.value && !value) warn(FORMAT_HELP);
      else if (text.value && text.validationMessage) warn(text.validationMessage);   // real date but not allowed (for example a birth date after the booking date)
    });

    // Hidden picker -> text box (the user chose from the calendar or clock)
    native.addEventListener("input", () => {
      const shown = isDate ? isoToDisplay(native.value) : native.value.slice(0, 5);
      if (native.value && text.value !== shown) { text.value = shown; showProblem(""); }
      if (!native.value && document.activeElement !== text) text.value = "";
    });

    button.addEventListener("click", () => {
      try { native.showPicker(); } catch (error) { native.focus(); native.click(); }
    });

    // The booking date has a "min" set by app.js after load; re-check when it changes
    new MutationObserver(check).observe(native, { attributes: true, attributeFilter: ["min", "max"] });
    showProblem(text.required ? "Please fill this in." : "");
  }

  function start() {
    document.querySelectorAll('input[type="date"], input[type="time"]').forEach(enhance);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
