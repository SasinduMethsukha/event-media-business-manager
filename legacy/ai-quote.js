// Event Media OS — AI Quotation Assistant
// Automatically parses freeform quote text, categorizes line items, and adds them to the quotation table.
(function () {
  'use strict';

  // Industry-standard categories for Event Media & AV Production
  var AI_CATEGORIES = [
    {
      name: 'Sound & Audio',
      type: 'standard',
      color: '#1a56db',
      tag: 'Hardware',
      keywords: [
        'sound', 'audio', 'speaker', 'speakers', 'mic', 'mics', 'microphone', 'microphones',
        'lapel', 'collar mic', 'mixer', 'digital mixer', 'console', 'subwoofer', 'sub', 'subs',
        'line array', 'pa system', 'in-ear', 'monitor', 'stage monitor', 'dj gear', 'amplifier',
        'wireless mic', 'podium mic', 'cordless mic', 'di box', 'audio setup', 'audio system'
      ]
    },
    {
      name: 'Lighting & Rigging',
      type: 'standard',
      color: '#e67700',
      tag: 'Hardware',
      keywords: [
        'light', 'lights', 'lighting', 'par', 'pars', 'led par', 'beam', 'beams', 'moving head',
        'moving heads', 'spot', 'spotlight', 'follow spot', 'truss', 'trusses', 'dimmer', 'dmx',
        'smoke', 'smoke machine', 'haze', 'hazer', 'fog', 'uplight', 'uplights', 'uplighter',
        'mood light', 'mood lights', 'stage light', 'stage lights', 'laser', 'warm white', 'profile'
      ]
    },
    {
      name: 'Visual & Displays',
      type: 'standard',
      color: '#862e9c',
      tag: 'Hardware',
      keywords: [
        'led wall', 'video wall', 'p2.6', 'p3.9', 'screen', 'screens', 'projector', 'projectors',
        'projection screen', 'tv', 'tvs', 'display', 'displays', 'video processor', 'switcher',
        'hdmi', 'sdi', 'led screen', 'backdrop display', 'monitor screen', 'confidence monitor'
      ]
    },
    {
      name: 'Media & Video Production',
      type: 'standard',
      color: '#c0392b',
      tag: 'Services',
      keywords: [
        'photo', 'photographer', 'photographers', 'photography', 'video', 'videographer',
        'videographers', 'cinematography', 'cinematographer', 'camera', 'cameras', 'drone',
        'aerial', 'livestream', 'live stream', 'streaming', 'multi-cam', 'multi camera', 'gimbal',
        'ronin', 'teleprompter', 'shoot', 'coverage', 'second shooter', 'lead photographer',
        'candid', 'traditional', 'teaser shoot', 'interviews', 'recording', '4k camera'
      ]
    },
    {
      name: 'Post-Production & Deliverables',
      type: 'standard',
      color: '#087f5b',
      tag: 'Creative',
      keywords: [
        'editing', 'editor', 'edit', 'teaser', 'highlight', 'highlights', 'trailer', 'color grading',
        'colour grading', 'retouching', 'album', 'albums', 'photobook', 'photo book', 'usb',
        'pendrive', 'delivery', 'raw footage', 'mastering', 'post production', 'post-production',
        'same day edit', 'montage', 'recap'
      ]
    },
    {
      name: 'Crew & Technical Staff',
      type: 'standard',
      color: '#0b7285',
      tag: 'Crew',
      keywords: [
        'crew', 'technician', 'technicians', 'engineer', 'sound engineer', 'lighting technician',
        'rigger', 'director', 'stage manager', 'assistant', 'operator', 'camera operator',
        'drone pilot', 'dj', 'emcee', 'mc', 'host', 'labour', 'labor', 'staff', 'helpers',
        'supervisor', 'site manager'
      ]
    },
    {
      name: 'Staging & Fabrication',
      type: 'standard',
      color: '#2b2d42',
      tag: 'Hardware',
      keywords: [
        'stage', 'staging', 'platform', 'riser', 'risers', 'backdrop', 'backdrops', 'photobooth',
        'photo booth', 'podium', 'lectern', 'red carpet', 'furniture', 'barricade', 'barricades',
        'truss arch', 'stage structure', 'flex printing', 'wooden stage'
      ]
    },
    {
      name: 'Logistics & Hospitality',
      type: 'standard',
      color: '#6b6459',
      tag: 'Logistics',
      keywords: [
        'transport', 'transportation', 'delivery', 'travel', 'fuel', 'petrol', 'diesel', 'van',
        'lorry', 'truck', 'accommodation', 'hotel', 'meals', 'meal', 'lunch', 'dinner',
        'refreshment', 'generator', 'kva generator', 'permit', 'toll', 'loading', 'unloading'
      ]
    }
  ];

  // Sample prompt presets for quick user testing
  var SAMPLES = {
    wedding: 'Wedding Media & AV Package:\n' +
      '2 Lead Photographers for 2 days @ 60,000/day\n' +
      '2 Cinematographers with 4K cameras & Ronin gimbal for 2 days 150,000\n' +
      '1 4K Drone Pilot for venue and couple aerial shots 45,000\n' +
      'Sound system with 4 wireless handheld mics & 2 monitors 75,000\n' +
      'Stage ambient lighting with 12 LED par cans & 4 warm white profiles 55,000\n' +
      '12x8 ft P2.6 LED Video Wall with processor 160,000\n' +
      'Cinematic Teaser (1 min) + Full Event Film (30 mins) editing 65,000\n' +
      '100-page luxury leatherbound printed photo album 35,000\n' +
      'Crew transport, meals, and logistics 25,000',

    conference: 'Corporate Conference AV & Streaming Setup:\n' +
      'Full PA sound system with digital mixer, 6 lapel mics, and 4 podium mics 120,000\n' +
      '2 High-lumen Laser Projectors with 120-inch motorized screens 90,000\n' +
      '3-Camera Multi-cam setup with video switcher for 2 days 180,000\n' +
      'HD Live streaming to YouTube and Zoom with redundant 4G bonding 80,000\n' +
      'Stage wash lighting with 8 beam lights & follow spot 60,000\n' +
      '2 Dedicated AV sound and video technicians for 2 days 40,000\n' +
      'Full conference session recording and edited chapter highlights 50,000\n' +
      'Equipment transport and delivery lorry 20,000',

    concert: 'Live Music Concert Production:\n' +
      'Line Array Sound System (10,000W) with dual subwoofers & 32-ch mixer 220,000\n' +
      'Intelligent concert lighting with 16 moving heads, blinders, and hazer 140,000\n' +
      'Main Stage P3.9 LED Backdrop 16x10 ft 240,000\n' +
      '4-Camera Live concert recording with crane/jib operator 190,000\n' +
      'Heavy duty aluminum box trussing 20x20 ft and stage risers 95,000\n' +
      'Lead Sound Engineer & Lighting Console Designer 60,000\n' +
      '60 kVA Silent Diesel Generator hire with fuel 75,000\n' +
      'Transport and crew logistics 45,000',

    commercial: 'Commercial Ad Video Shoot:\n' +
      'Director of Photography (DP) with Cinema Camera package 120,000\n' +
      'Gaffer & Lighting Package (Aputure 600d, softboxes, C-stands) 85,000\n' +
      'Sound Recordist with boom mic and multi-track field recorder 45,000\n' +
      'Studio Hire full day 50,000\n' +
      'High-end Color Grading & Commercial Video Edit 75,000\n' +
      'Sound design, mixing & licensed background track 40,000\n' +
      'Production crew meals & local travel 20,000'
  };

  // State
  var lastParsedData = null;
  var currentMode = 'append'; // 'append' or 'replace'

  // Helper: Retrieve API Key
  function getGeminiKey() {
    var key = localStorage.getItem('ai_gemini_api_key') || '';
    if (!key && window.VITE_GEMINI_API_KEY) {
      key = window.VITE_GEMINI_API_KEY;
    }
    return key.trim();
  }

  function setGeminiKey(key) {
    if (key) {
      localStorage.setItem('ai_gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('ai_gemini_api_key');
    }
    updateModelBadge();
  }

  // Update UI badge indicating whether Gemini or Smart NLP is active
  function updateModelBadge() {
    var key = getGeminiKey();
    var badges = document.querySelectorAll('.ai-model-badge-text');
    badges.forEach(function (el) {
      if (key) {
        el.innerHTML = '<i class="ti ti-sparkles" style="color:#a855f7"></i> Gemini 2.5 Flash';
      } else {
        el.innerHTML = '<i class="ti ti-cpu" style="color:#0ea5e9"></i> Smart NLP Engine';
      }
    });

    var indicator = document.getElementById('aiKeyStatusIndicator');
    if (indicator) {
      if (key) {
        indicator.innerHTML = '<span style="color:#16a34a;font-weight:600"><i class="ti ti-check"></i> Gemini API Key Configured</span> &bull; <span style="font-size:12px;color:var(--text3)">Key ends with ...' + key.slice(-4) + '</span>';
      } else {
        indicator.innerHTML = '<span style="color:var(--text3)"><i class="ti ti-info-circle"></i> No API key set. Running in built-in offline Smart NLP mode (free, instant).</span>';
      }
    }
  }

  // Helper: Toast notifications
  function showToast(msg, type) {
    var toast = document.getElementById('aiToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'aiToast';
      toast.className = 'ai-toast';
      document.body.appendChild(toast);
    }
    var icon = (type === 'error') ? 'ti-alert-circle' : 'ti-sparkles';
    var bg = (type === 'error') ? '#dc2626' : 'linear-gradient(135deg, #10b981, #059669)';
    toast.style.background = bg;
    toast.innerHTML = '<i class="ti ' + icon + '" style="font-size:18px"></i><span>' + msg + '</span>';
    toast.classList.add('show');
    setTimeout(function () {
      toast.classList.remove('show');
    }, 4000);
  }

  // ─────────────────────────────────────────────────────────
  // 1. SMART OFFLINE NLP PARSER & CATEGORIZER
  // ─────────────────────────────────────────────────────────
  function parseWithSmartNlp(text) {
    if (!text || !text.trim()) return [];

    var rawLines = text.split(/[\r\n]+/);
    var processedLines = [];

    rawLines.forEach(function (raw) {
      var l = raw.trim();
      if (!l) return;
      var lClean = l.replace(/\b4k\b/gi, '__4K__').replace(/\b8k\b/gi, '__8K__');
      var prices = lClean.match(/(?:Rs\.?|LKR|\$)?\s*(?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+k|[0-9]{4,})\b/gi) || [];
      if (prices.length > 1) {
        var chunks = lClean.split(/(?:,(?!\d{3}\b)|;|\.\s+)+/i);
        chunks.forEach(function (c) {
          var restored = c.replace(/__4K__/g, '4K').replace(/__8K__/g, '8K').trim();
          if (restored) processedLines.push(restored);
        });
      } else {
        processedLines.push(l);
      }
    });

    var itemsList = [];

    processedLines.forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      // Skip pure headers like "Wedding Package:" or "Items:"
      if (/^[A-Za-z0-9\s&/-]+:$/.test(line) && line.length < 40 && !/\d{3,}/.test(line)) {
        return;
      }
      // Remove leading bullets or list numbering (e.g. "- ", "* ", "1. ", "2) ")
      line = line.replace(/^[\s*\-•*#]+/, '').trim();
      line = line.replace(/^\d+[\.\)\-]\s+/, '').trim();
      line = line.replace(/^(?:and|also|plus|we\s+need|need)\s+/i, '').trim();
      if (!line) return;

      var parsed = parseSingleLine(line);
      if (parsed) {
        itemsList.push(parsed);
      }
    });

    if (itemsList.length === 0) return [];

    // Group items into categories
    var catMap = {};
    itemsList.forEach(function (it) {
      var catName = it.categoryName;
      if (!catMap[catName]) {
        var catDef = AI_CATEGORIES.find(function (c) { return c.name === catName; });
        catMap[catName] = {
          name: catName,
          type: 'standard',
          color: catDef ? catDef.color : (window.CAT_COLORS ? window.CAT_COLORS[Object.keys(catMap).length % window.CAT_COLORS.length] : '#1a56db'),
          note: '',
          items: []
        };
      }
      catMap[catName].items.push({
        desc: it.desc,
        tag: it.tag,
        qty: it.qty,
        unit: it.unit,
        days: it.days,
        multiDay: it.multiDay,
        showDesc: true,
        showTag: true,
        showQty: true,
        showUnit: true,
        showTotal: true,
        manualTotal: false,
        total: it.total
      });
    });

    var result = Object.values(catMap);
    return result;
  }

  // Parses a single textual line into item specs
  function parseSingleLine(line) {
    var originalLine = line;
    var qty = 1;
    var days = 1;
    var multiDay = false;
    var price = 0;
    var isRateEach = false;
    var isRatePerDay = false;

    // Preserve special tokens before cleaning
    // Mark resolutions like 4K, 8K so they don't get eaten as prices
    line = line.replace(/\b4k\b/gi, '__4K__').replace(/\b8k\b/gi, '__8K__');

    // 1. Detect multi-day: "for 2 days", "2 days", "3-day shoot"
    var dayMatch = line.match(/(?:\bfor\s+)?(\d+)\s*(?:days|day|d)\b/i);
    if (dayMatch && !/\bsame\s+day\b/i.test(dayMatch[0])) {
      days = parseInt(dayMatch[1], 10) || 1;
      if (days > 1) multiDay = true;
      line = line.replace(dayMatch[0], ' ');
    }

    // Check if line mentions per day / /day
    if (/\bper\s*day\b|\/day\b|\bday\s*rate\b/i.test(line)) {
      isRatePerDay = true;
      line = line.replace(/\bper\s*day\b|\/day\b|\bday\s*rate\b/gi, ' ');
    }

    // 2. Detect explicit rate with @ (e.g. "@ 60,000" or "@ 50k each")
    var atRateMatch = line.match(/@\s*(?:Rs\.?|LKR|\$)?\s*([0-9kK,]+(?:\.[0-9]{2})?)\s*(?:each|\/day|per day)?/i);
    if (atRateMatch) {
      isRateEach = true;
      var rawAtVal = atRateMatch[1].replace(/,/g, '');
      if (/k$/i.test(rawAtVal)) {
        price = parseFloat(rawAtVal) * 1000;
      } else {
        price = parseFloat(rawAtVal) || 0;
      }
      line = line.replace(atRateMatch[0], ' ');
    }

    // 3. Detect Price if not already found via @
    if (price === 0) {
      // Check price at end of line (e.g. "... 150,000", "... - 85k", "... = Rs 75,000", "... 25000.")
      var endPriceMatch = line.match(/(?:[:\-=|–—\s]+|\b)(?:Rs\.?|LKR|\$)?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+k|[0-9]{4,})\s*[.]*\s*$/i);
      if (endPriceMatch) {
        var rawEndVal = endPriceMatch[1].replace(/,/g, '');
        if (/k$/i.test(rawEndVal)) {
          price = parseFloat(rawEndVal) * 1000;
        } else {
          price = parseFloat(rawEndVal) || 0;
        }
        line = line.substring(0, endPriceMatch.index);
      } else {
        // Search anywhere in the line for currency or number with k or comma or bare 4-7 digit number >= 1000
        var anyPriceMatch = line.match(/(?:Rs\.?|LKR|\$)\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+k|[0-9]+)|\b([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+k|[0-9]{4,7})\b/i);
        if (anyPriceMatch) {
          var valStr = (anyPriceMatch[1] || anyPriceMatch[2]).replace(/,/g, '');
          if (/k$/i.test(valStr)) {
            price = parseFloat(valStr) * 1000;
          } else {
            price = parseFloat(valStr) || 0;
          }
          line = line.replace(anyPriceMatch[0], ' ');
        }
      }
    }

    // 4. Detect Quantity at start:
    // Ensure we do NOT treat dimensions (e.g. 12x8, 10x8), hyphenated words (100-page), or resolutions (4K) as quantity
    var isDimension = /^\s*\d+\s*x\s*\d+/i.test(line);
    var isHyphenWord = /^\s*\d+-[a-zA-Z]/i.test(line);
    var isPreservedRes = /^\s*__\d+K__/i.test(line);

    if (!isDimension && !isHyphenWord && !isPreservedRes) {
      var qtyMatch = line.match(/^\s*(\d+)\s*(?:x\s*|\s+)(?![x\d])/i);
      if (qtyMatch) {
        var num = parseInt(qtyMatch[1], 10);
        if (num > 0 && num < 100) {
          qty = num;
          line = line.replace(qtyMatch[0], ' ');
        }
      } else {
        var qtyInline = line.match(/\b(?:qty|quantity)[:\s]*(\d+)\b/i);
        if (qtyInline) {
          qty = parseInt(qtyInline[1], 10) || 1;
          line = line.replace(qtyInline[0], ' ');
        }
      }
    }

    // 5. Restore preserved tokens and clean description
    var desc = line
      .replace(/__4K__/g, '4K')
      .replace(/__8K__/g, '8K')
      .replace(/[@=:\-|–—]+/g, ' ')
      .replace(/\b(?:each|per unit|per item|qty|nos|pcs)\b/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!desc) {
      desc = originalLine.replace(/[0-9kK,.:$]+/g, '').trim() || 'Custom Item';
    }

    // Capitalize first letter of description
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);

    // Compute unit price
    var unitPrice = 0;
    if (isRateEach && isRatePerDay) {
      unitPrice = price;
    } else if (isRateEach) {
      unitPrice = price;
    } else if (isRatePerDay) {
      unitPrice = Math.round(price / qty);
    } else {
      // If given total, compute unit rate
      var totalDiv = (qty * days);
      if (totalDiv <= 0) totalDiv = 1;
      unitPrice = Math.round(price / totalDiv);
    }

    var total = (unitPrice * qty * days);
    if (price > 0 && unitPrice === 0) {
      unitPrice = price;
      total = unitPrice * qty * days;
    }

    // 5. Categorize & Tag
    var category = classifyCategory(desc);

    return {
      desc: desc,
      tag: category.tag,
      qty: qty,
      unit: unitPrice,
      days: days,
      multiDay: multiDay,
      total: total,
      categoryName: category.name
    };
  }

  // Matches item keywords to the best event media category
  function classifyCategory(desc) {
    var text = desc.toLowerCase();
    var bestCat = null;
    var maxScore = 0;

    for (var i = 0; i < AI_CATEGORIES.length; i++) {
      var cat = AI_CATEGORIES[i];
      var score = 0;
      for (var k = 0; k < cat.keywords.length; k++) {
        var kw = cat.keywords[k];
        if (text.indexOf(kw) !== -1) {
          // Exact word match scores higher
          var regex = new RegExp('\\b' + kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
          if (regex.test(text)) {
            score += 3;
          } else {
            score += 1;
          }
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestCat = cat;
      }
    }

    // If no specific match found, fallback sensibly
    if (!bestCat || maxScore === 0) {
      if (/photo|video|camera|stream/i.test(text)) {
        bestCat = AI_CATEGORIES.find(function (c) { return c.name === 'Media & Video Production'; });
      } else if (/sound|mic|audio|speaker/i.test(text)) {
        bestCat = AI_CATEGORIES.find(function (c) { return c.name === 'Sound & Audio'; });
      } else if (/light|par|beam/i.test(text)) {
        bestCat = AI_CATEGORIES.find(function (c) { return c.name === 'Lighting & Rigging'; });
      } else if (/edit|album/i.test(text)) {
        bestCat = AI_CATEGORIES.find(function (c) { return c.name === 'Post-Production & Deliverables'; });
      } else if (/crew|operator|technician|driver/i.test(text)) {
        bestCat = AI_CATEGORIES.find(function (c) { return c.name === 'Crew & Technical Staff'; });
      } else {
        bestCat = {
          name: 'General Services & Equipment',
          tag: 'Services',
          color: '#2b2d42'
        };
      }
    }

    return bestCat;
  }

  // ─────────────────────────────────────────────────────────
  // 2. GOOGLE GEMINI FLASH API INTEGRATION
  // ─────────────────────────────────────────────────────────
  async function callGeminiApi(userText, apiKey) {
    var systemInstruction =
      'You are an expert event media & production estimator and quotation manager. ' +
      'Analyze the provided text (event brief, quotation requirements, equipment notes, or budget list) ' +
      'and convert it into clean, structured quotation line items categorized into logical event media categories.\n\n' +
      'Categories typically used:\n' +
      '- "Sound & Audio" (Hardware): PA systems, digital mixers, line arrays, wireless/lapel mics, monitors, DJ gear\n' +
      '- "Lighting & Rigging" (Hardware): LED par cans, beam lights, moving heads, trussing, hazers, mood lights\n' +
      '- "Visual & Displays" (Hardware): LED video walls, projectors, screens, TV monitors, video processors\n' +
      '- "Media & Video Production" (Services): Photographers, videographers, cinematographers, drone pilots, live streaming, multi-camera shoot\n' +
      '- "Post-Production & Deliverables" (Creative): Video editing, cinematic teasers, highlight reels, color grading, printed photo albums\n' +
      '- "Crew & Technical Staff" (Crew): Sound engineers, light operators, technicians, stage managers, riggers\n' +
      '- "Staging & Fabrication" (Hardware): Stages, backdrops, photobooths, red carpets, lecterns\n' +
      '- "Logistics & Hospitality" (Logistics): Transport, truck rental, fuel, generator hire, crew meals, accommodation\n\n' +
      'Rules:\n' +
      '1. Extract item description (clean, concise, professional).\n' +
      '2. Extract numeric quantity (qty, integer >= 1). If not stated, assume 1.\n' +
      '3. Extract numeric unit price (unit). If only a total is provided, calculate unit = total / (qty * days).\n' +
      '4. Extract days (integer >= 1). If multi-day, set multiDay: true and days accordingly.\n' +
      '5. Assign standard tags from: "Hardware", "Services", "Crew", "Logistics", "Creative", "General".\n' +
      '6. Group all items into categories. Assign an appropriate hex color for each category.\n' +
      '7. Return ONLY valid JSON adhering strictly to the schema.';

    var prompt = 'Here is the quotation text to categorize:\n\n' + userText;

    var endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey);

    var payload = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemInstruction + '\n\n' + prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.15
      }
    };

    var response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      var errText = await response.text();
      var msg = 'Gemini API Error (' + response.status + ')';
      try {
        var errJson = JSON.parse(errText);
        if (errJson.error && errJson.error.message) {
          msg += ': ' + errJson.error.message;
        }
      } catch (e) {
        msg += ': ' + errText;
      }
      throw new Error(msg);
    }

    var data = await response.json();
    var replyText = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!replyText) {
      throw new Error('No response text received from Gemini API.');
    }

    var parsed = JSON.parse(replyText);
    var categories = parsed.categories || parsed.items_by_category || (Array.isArray(parsed) ? parsed : null);

    if (!categories || !Array.isArray(categories)) {
      throw new Error('Gemini response did not contain a valid categories array.');
    }

    // Normalize Gemini categories into application schema
    return categories.map(function (c, idx) {
      var color = c.color || (window.CAT_COLORS ? window.CAT_COLORS[idx % window.CAT_COLORS.length] : '#1a56db');
      var items = (c.items || []).map(function (it) {
        var q = Math.max(1, parseInt(it.qty || it.quantity, 10) || 1);
        var d = Math.max(1, parseInt(it.days, 10) || 1);
        var u = Math.max(0, parseFloat(it.unit || it.unit_price || it.rate || 0));
        var mDay = !!it.multiDay || d > 1;
        var tag = it.tag || 'General';
        var desc = it.desc || it.description || it.name || 'Item';
        return {
          desc: desc,
          tag: tag,
          qty: q,
          unit: u,
          days: d,
          multiDay: mDay,
          showDesc: true,
          showTag: true,
          showQty: true,
          showUnit: true,
          showTotal: true,
          manualTotal: false,
          total: (u * q * d)
        };
      });

      return {
        name: c.name || c.category || ('Category ' + (idx + 1)),
        type: c.type || 'standard',
        color: color,
        note: c.note || '',
        items: items
      };
    });
  }

  // ─────────────────────────────────────────────────────────
  // 3. MAIN AI PROCESSING PIPELINE
  // ─────────────────────────────────────────────────────────
  async function processAiQuote(isModal) {
    var inputEl = document.getElementById(isModal ? 'aiQuoteModalInput' : 'aiQuoteInput');
    if (!inputEl) return;
    var text = inputEl.value.trim();
    if (!text) {
      showToast('Please type or paste some quotation items or description first.', 'error');
      inputEl.focus();
      return;
    }

    var btn = document.getElementById(isModal ? 'aiModalGenerateBtn' : 'aiGenerateBtn');
    var originalBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="ti ti-loader animate-spin"></i> Categorizing with AI...';
    }

    var previewArea = document.getElementById(isModal ? 'aiModalPreviewArea' : 'aiPreviewArea');
    if (previewArea) {
      previewArea.style.display = 'block';
      previewArea.innerHTML =
        '<div class="ai-loading-box">' +
          '<div class="ai-spinner"></div>' +
          '<div style="font-weight:600;margin-top:8px">AI is analyzing your quotation text...</div>' +
          '<div style="font-size:12px;color:var(--text3)">Extracting items, quantities, rates &amp; categorizing</div>' +
        '</div>';
    }

    var categorized = null;
    var usedGemini = false;
    var apiKey = getGeminiKey();

    try {
      if (apiKey) {
        try {
          categorized = await callGeminiApi(text, apiKey);
          usedGemini = true;
        } catch (geminiErr) {
          console.warn('[AI Quote] Gemini API call failed, falling back to smart NLP engine:', geminiErr);
          showToast('Gemini API note: ' + geminiErr.message + '. Used smart NLP engine instead.', 'error');
          categorized = parseWithSmartNlp(text);
        }
      } else {
        // Built-in smart NLP engine
        categorized = parseWithSmartNlp(text);
      }

      if (!categorized || categorized.length === 0 || categorized.every(function (c) { return !c.items || c.items.length === 0; })) {
        throw new Error('No items could be detected. Please check that your text lists items and prices.');
      }

      lastParsedData = categorized;
      renderAiPreview(categorized, isModal, usedGemini);
      showToast('✨ Successfully categorized ' + countTotalItems(categorized) + ' items across ' + categorized.length + ' categories!');
    } catch (err) {
      console.error('[AI Quote] Processing error:', err);
      if (previewArea) {
        previewArea.innerHTML =
          '<div class="ai-error-box">' +
            '<strong><i class="ti ti-alert-circle"></i> Categorization failed:</strong> ' + err.message +
            '<div style="margin-top:6px;font-size:12px">Try clicking one of the sample presets above for an example format.</div>' +
          '</div>';
      }
      showToast('Categorization failed: ' + err.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
      }
    }
  }

  function countTotalItems(catList) {
    if (!catList) return 0;
    return catList.reduce(function (sum, c) { return sum + (c.items ? c.items.length : 0); }, 0);
  }

  function calcParsedGrandTotal(catList) {
    if (!catList) return 0;
    return catList.reduce(function (sum, c) {
      var catTotal = (c.items || []).reduce(function (cSum, it) {
        return cSum + (it.unit * it.qty * (it.days || 1));
      }, 0);
      return sum + catTotal;
    }, 0);
  }

  // ─────────────────────────────────────────────────────────
  // 4. RENDERING INTERACTIVE PREVIEW
  // ─────────────────────────────────────────────────────────
  function renderAiPreview(catList, isModal, usedGemini) {
    var previewArea = document.getElementById(isModal ? 'aiModalPreviewArea' : 'aiPreviewArea');
    if (!previewArea) return;

    var currency = (typeof window.gv === 'function' ? window.gv('currency') : 'Rs. ') || 'Rs. ';
    var grandTotal = calcParsedGrandTotal(catList);
    var totalItems = countTotalItems(catList);

    var html = '';
    html += '<div class="ai-preview-head">';
    html += '  <div>';
    html += '    <div style="font-weight:700;font-size:13.5px;color:var(--text);display:flex;align-items:center;gap:6px">';
    html += '      <i class="ti ti-check-circle" style="color:#16a34a"></i>';
    html += '      <span>AI Categorized ' + totalItems + ' items in ' + catList.length + ' categories</span>';
    html += '    </div>';
    html += '    <div style="font-size:12px;color:var(--text2);margin-top:2px">';
    html += '      Engine: <strong>' + (usedGemini ? 'Google Gemini 2.5 Flash' : 'Smart NLP Engine') + '</strong> &bull; Total: <strong style="color:var(--accent)">' + currency + grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</strong>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    // Categories preview list
    html += '<div class="ai-cats-preview-list">';
    catList.forEach(function (cat, cIdx) {
      var catSubtotal = (cat.items || []).reduce(function (s, it) { return s + (it.unit * it.qty * (it.days || 1)); }, 0);
      html += '<div class="ai-cat-card" style="border-left:4px solid ' + (cat.color || '#1a56db') + '">';
      html += '  <div class="ai-cat-card-header">';
      html += '    <div style="display:flex;align-items:center;gap:6px">';
      html += '      <span class="ai-cat-color-dot" style="background:' + (cat.color || '#1a56db') + '"></span>';
      html += '      <strong style="font-size:13px">' + (cat.name || 'Category') + '</strong>';
      html += '      <span class="ai-cat-count">(' + (cat.items ? cat.items.length : 0) + ' items)</span>';
      html += '    </div>';
      html += '    <div style="font-weight:700;font-size:12.5px">' + currency + catSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</div>';
      html += '  </div>';

      // Items list inside category
      html += '  <div class="ai-items-sublist">';
      (cat.items || []).forEach(function (it, itIdx) {
        var itTotal = it.unit * it.qty * (it.days || 1);
        html += '    <div class="ai-item-row" data-cidx="' + cIdx + '" data-iidx="' + itIdx + '">';
        html += '      <div class="ai-item-desc-col">';
        html += '        <span class="ai-item-tag">' + (it.tag || 'General') + '</span>';
        html += '        <span class="ai-item-name">' + (it.desc || '') + '</span>';
        html += '      </div>';
        html += '      <div class="ai-item-calc-col">';
        html += '        <span class="ai-item-qty">' + it.qty + 'x ' + (it.days > 1 ? '(' + it.days + 'd) ' : '') + '@ ' + it.unit.toLocaleString() + '</span>';
        html += '        <strong class="ai-item-total">' + currency + itTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</strong>';
        html += '        <button type="button" class="btn-icon ai-item-del-btn" title="Remove item" onclick="AiQuote.removePreviewItem(' + cIdx + ',' + itIdx + ',' + (isModal ? 'true' : 'false') + ')"><i class="ti ti-trash"></i></button>';
        html += '      </div>';
        html += '    </div>';
      });
      html += '  </div>';
      html += '</div>';
    });
    html += '</div>';

    // Insert actions row
    html += '<div class="ai-preview-footer">';
    html += '  <div class="ai-mode-toggle-group">';
    html += '    <label class="ai-radio-label">';
    html += '      <input type="radio" name="aiTargetMode_' + (isModal ? 'm' : 's') + '" value="append" ' + (currentMode === 'append' ? 'checked' : '') + ' onchange="AiQuote.setMode(this.value)">';
    html += '      <span>Add to current quotation</span>';
    html += '    </label>';
    html += '    <label class="ai-radio-label">';
    html += '      <input type="radio" name="aiTargetMode_' + (isModal ? 'm' : 's') + '" value="replace" ' + (currentMode === 'replace' ? 'checked' : '') + ' onchange="AiQuote.setMode(this.value)">';
    html += '      <span>Replace current items</span>';
    html += '    </label>';
    html += '  </div>';

    html += '  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
    html += '    <button type="button" class="btn btn-sm" onclick="AiQuote.clearPreview(' + (isModal ? 'true' : 'false') + ')">Discard</button>';
    html += '    <button type="button" class="btn btn-sm btn-ai-apply" onclick="AiQuote.applyToQuotation(' + (isModal ? 'true' : 'false') + ')">';
    html += '      <i class="ti ti-table-plus"></i> Insert into Quotation Table';
    html += '    </button>';
    html += '  </div>';
    html += '</div>';

    previewArea.innerHTML = html;
    previewArea.style.display = 'block';
  }

  // ─────────────────────────────────────────────────────────
  // 5. APPLYING ITEMS TO THE LIVE QUOTATION TABLE
  // ─────────────────────────────────────────────────────────
  function applyToQuotation(isModal) {
    if (!lastParsedData || lastParsedData.length === 0) {
      showToast('No categorized items to apply.', 'error');
      return;
    }

    if (typeof window.addCategory !== 'function' || !Array.isArray(window.cats)) {
      showToast('Quotation table environment not available.', 'error');
      return;
    }

    var mode = currentMode || 'append';

    if (mode === 'replace') {
      window.cats = [];
      window.catId = 0;
    }

    var addedCatCount = 0;
    var addedItemCount = 0;

    lastParsedData.forEach(function (newCat) {
      // If append mode, check if a category with exact/similar name already exists
      var existingCat = null;
      if (mode === 'append' && Array.isArray(window.cats)) {
        var cleanName = (newCat.name || '').trim().toLowerCase();
        existingCat = window.cats.find(function (c) {
          return (c.name || '').trim().toLowerCase() === cleanName;
        });
      }

      if (existingCat) {
        // Append items to existing category
        newCat.items.forEach(function (it) {
          existingCat.items.push(Object.assign({}, it));
          addedItemCount++;
        });
      } else {
        // Create new category via app's addCategory()
        window.addCategory({
          name: newCat.name || 'New Category',
          type: newCat.type || 'standard',
          color: newCat.color || (window.CAT_COLORS ? window.CAT_COLORS[window.cats.length % window.CAT_COLORS.length] : '#1a56db'),
          note: newCat.note || '',
          items: newCat.items.map(function (it) { return Object.assign({}, it); })
        });
        addedCatCount++;
        addedItemCount += (newCat.items ? newCat.items.length : 0);
      }
    });

    // Re-render categories in sidebar and re-render document preview paper
    if (typeof window.renderCats === 'function') window.renderCats();
    if (typeof window.render === 'function') window.render();

    // Close modal if open
    if (isModal) {
      closeAiQuoteModal();
    }

    // Scroll to categories view in sidebar
    var catSection = document.getElementById('categories');
    if (catSection) {
      catSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Show celebratory toast
    showToast('✨ Added ' + addedItemCount + ' items to quotation table successfully!');

    // Clear preview area
    clearPreview(isModal);
  }

  function removePreviewItem(cIdx, itIdx, isModal) {
    if (!lastParsedData || !lastParsedData[cIdx] || !lastParsedData[cIdx].items) return;
    lastParsedData[cIdx].items.splice(itIdx, 1);
    if (lastParsedData[cIdx].items.length === 0) {
      lastParsedData.splice(cIdx, 1);
    }
    renderAiPreview(lastParsedData, isModal, !!getGeminiKey());
  }

  function clearPreview(isModal) {
    lastParsedData = null;
    var previewArea = document.getElementById(isModal ? 'aiModalPreviewArea' : 'aiPreviewArea');
    if (previewArea) {
      previewArea.style.display = 'none';
      previewArea.innerHTML = '';
    }
  }

  // ─────────────────────────────────────────────────────────
  // 6. UI TOGGLES, SAMPLES & MODAL CONTROLS
  // ─────────────────────────────────────────────────────────
  function toggleAiQuoteCard() {
    var card = document.getElementById('aiQuoteCard');
    if (!card) return;
    var body = document.getElementById('aiQuoteBody');
    var btn = document.getElementById('aiToggleCardBtn');
    if (!body) return;

    var isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
    if (btn) {
      btn.innerHTML = isHidden ? '<i class="ti ti-chevron-up"></i>' : '<i class="ti ti-chevron-down"></i>';
    }
  }

  function openAiQuoteModal() {
    var modal = document.getElementById('aiQuoteModal');
    if (!modal) return;
    modal.classList.add('open');
    updateModelBadge();
    var inp = document.getElementById('aiQuoteModalInput');
    if (inp) inp.focus();
  }

  function closeAiQuoteModal() {
    var modal = document.getElementById('aiQuoteModal');
    if (modal) modal.classList.remove('open');
  }

  function openAiKeySettings() {
    var modal = document.getElementById('aiKeyModal');
    if (!modal) return;
    var input = document.getElementById('aiKeyInput');
    if (input) input.value = getGeminiKey();
    modal.classList.add('open');
    updateModelBadge();
  }

  function closeAiKeySettings() {
    var modal = document.getElementById('aiKeyModal');
    if (modal) modal.classList.remove('open');
  }

  function saveAiKey() {
    var input = document.getElementById('aiKeyInput');
    var key = input ? input.value.trim() : '';
    setGeminiKey(key);
    closeAiKeySettings();
    if (key) {
      showToast('✨ Gemini API key saved! AI is now powered by Gemini 2.5 Flash.');
    } else {
      showToast('API key removed. Running in built-in offline Smart NLP mode.');
    }
  }

  async function testAiKey() {
    var input = document.getElementById('aiKeyInput');
    var key = input ? input.value.trim() : '';
    var statusEl = document.getElementById('aiKeyTestResult');
    if (!key) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626"><i class="ti ti-alert-triangle"></i> Please enter an API key to test.</span>';
      return;
    }

    if (statusEl) {
      statusEl.innerHTML = '<span style="color:var(--text2)"><i class="ti ti-loader animate-spin"></i> Testing connection to Google Gemini API...</span>';
    }

    try {
      var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with exactly: OK' }] }]
        })
      });

      if (!res.ok) {
        var err = await res.text();
        throw new Error('HTTP ' + res.status + ': ' + err);
      }

      if (statusEl) {
        statusEl.innerHTML = '<span style="color:#16a34a;font-weight:600"><i class="ti ti-check"></i> Connected successfully! Google Gemini 2.5 Flash is ready.</span>';
      }
    } catch (e) {
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:#dc2626"><i class="ti ti-alert-circle"></i> Connection failed: ' + e.message + '</span>';
      }
    }
  }

  function loadAiSample(sampleKey, isModal) {
    var text = SAMPLES[sampleKey] || '';
    var target = document.getElementById(isModal ? 'aiQuoteModalInput' : 'aiQuoteInput');
    if (target) {
      target.value = text;
      target.focus();
    }
  }

  function clearAiInput(isModal) {
    var target = document.getElementById(isModal ? 'aiQuoteModalInput' : 'aiQuoteInput');
    if (target) {
      target.value = '';
      target.focus();
    }
    clearPreview(isModal);
  }

  function setMode(mode) {
    currentMode = mode;
  }

  // Initialize badge on DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    updateModelBadge();
  });

  // Expose public API
  window.AiQuote = {
    toggleAiQuoteCard: toggleAiQuoteCard,
    openAiQuoteModal: openAiQuoteModal,
    closeAiQuoteModal: closeAiQuoteModal,
    openAiKeySettings: openAiKeySettings,
    closeAiKeySettings: closeAiKeySettings,
    saveAiKey: saveAiKey,
    testAiKey: testAiKey,
    loadAiSample: loadAiSample,
    clearAiInput: clearAiInput,
    processAiQuote: processAiQuote,
    applyToQuotation: applyToQuotation,
    removePreviewItem: removePreviewItem,
    clearPreview: clearPreview,
    setMode: setMode,
    getGeminiKey: getGeminiKey,
    setGeminiKey: setGeminiKey,
    parseWithSmartNlp: parseWithSmartNlp
  };

  // Global convenience bindings
  window.toggleAiQuoteCard = toggleAiQuoteCard;
  window.openAiQuoteAssistant = openAiQuoteModal;
  window.openAiQuoteModal = openAiQuoteModal;
  window.closeAiQuoteModal = closeAiQuoteModal;
  window.openAiKeySettings = openAiKeySettings;
  window.closeAiKeySettings = closeAiKeySettings;
  window.saveAiKey = saveAiKey;
  window.testAiKey = testAiKey;
  window.loadAiSample = loadAiSample;
  window.clearAiInput = clearAiInput;
  window.processAiQuote = processAiQuote;

})();
