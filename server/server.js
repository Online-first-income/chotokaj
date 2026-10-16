"use strict";
/* ছোট কাজ (ChotoKaj) — সার্ভার (Node.js, কোনো বাইরের প্যাকেজ ছাড়া)
   চালানো: node server.js  |  PORT env দিয়ে পোর্ট বদলানো যায় (ডিফল্ট 8080)
   ডেটা: server/data/db.json ফাইলে সংরক্ষিত হয় */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const ADMIN_PHONE = process.env.ADMIN_PHONE || "01786206604";
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const TEMP_MAIL = ["tempmail","temp-mail","10minutemail","guerrillamail","mailinator","yopmail","throwaway","maildrop","getnada","sharklasers","dispostable","fakeinbox","trashmail","mintemail","mohmal","tempinbox","mailcatch","spamgourmet","tempemail","disposablemail","emailondeck","33mail","anonbox","tempail"];
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e || "");
const validPhone = p => /^01[3-9]\d{8}$/.test(p || "");
const isTempMail = e => { const d = ((e || "").split("@")[1] || "").toLowerCase(); return TEMP_MAIL.some(t => d.includes(t)); };
const uid = () => "u" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
const hashPw = (pw, salt) => crypto.createHash("sha256").update(salt + ":" + pw).digest("hex");
const newSalt = () => crypto.randomBytes(8).toString("hex");
const token = () => crypto.randomBytes(24).toString("hex");
const money = n => Math.round(n * 100) / 100;

function seed() {
  const s = {
    settings: {
      appName: "ছোট কাজ", rate: 0.10, referPct: 50, dailyLimit: 50,
      notice: "স্বাগতম ছোট কাজে! 🎉 প্রতিদিন নতুন কাজ যোগ হয় — কাজ শেষ করে প্রমাণ জমা দিন।",
      supportTelegram: "https://t.me/", supportWhatsApp: "https://wa.me/",
      rules: "১. একটি অ্যাকাউন্ট থেকে একটি কাজ একবারই করা যাবে।\n২. ভুয়া স্ক্রিনশট দিলে অ্যাকাউন্ট ব্যান করা হবে।\n৩. প্রমাণ যাচাইয়ের পর টাকা Available ব্যালেন্সে যাবে।\n৪. উত্তোলনের টাকা অ্যাডমিন ম্যানুয়ালি পাঠাবেন — সাধারণত ২৪-৭২ ঘণ্টার মধ্যে।\n৫. টেম্প মেইল বা ভুয়া তথ্য দিয়ে খোলা অ্যাকাউন্ট বাতিল হবে।",
      methodsOn: { bkash: true, rocket: true, nagad: true, binance: true, recharge: true },
      minWithdraw: { bkash: 50, rocket: 50, nagad: 50, binance: 100, recharge: 10 },
      adminRecoveryCode: "CK-" + crypto.randomBytes(3).toString("hex").toUpperCase()
    },
    users: [], tasks: [], subs: [], withdrawals: [], orders: [], sessions: {}
  };
  const r = s.settings.rate;
  s.tasks = [
    { id: uid(), type: "telegram", title: "Telegram চ্যানেলে জয়েন করুন", link: "https://t.me/", desc: "১. লিংকে ক্লিক করে চ্যানেলটি খুলুন\n২. Join বাটনে চাপ দিন\n৩. জয়েন করা অবস্থায় স্ক্রিনশট নিন\n৪. আপনার Telegram ইউজারনেমসহ প্রমাণ জমা দিন", pay: r, slots: 100, active: true },
    { id: uid(), type: "facebook", title: "Facebook পেজ ফলো করুন", link: "https://facebook.com/", desc: "১. লিংকে ক্লিক করে পেজটি খুলুন\n২. Follow বাটনে চাপ দিন\n৩. ফলো করা অবস্থায় স্ক্রিনশট নিন\n৪. আপনার প্রোফাইল লিংকসহ প্রমাণ জমা দিন", pay: r, slots: 100, active: true },
    { id: uid(), type: "youtube", title: "YouTube চ্যানেল সাবস্ক্রাইব করুন", link: "https://youtube.com/", desc: "১. লিংকে ক্লিক করে চ্যানেলটি খুলুন\n২. Subscribe বাটনে চাপ দিন\n৩. সাবস্ক্রাইব করা অবস্থায় স্ক্রিনশট নিন\n৪. আপনার চ্যানেলের নামসহ প্রমাণ জমা দিন", pay: r, slots: 100, active: true },
    { id: uid(), type: "website", title: "ওয়েবসাইট ভিজিট করুন", link: "https://example.com/", desc: "১. লিংকে ক্লিক করে ওয়েবসাইটটি খুলুন\n২. কমপক্ষে ৩০ সেকেন্ড পেজে থাকুন\n৩. পেজের স্ক্রিনশট নিন\n৪. প্রমাণ জমা দিন", pay: r, slots: 100, active: true }
  ];
  return s;
}
let db;
/* ---------- সংরক্ষণ: Supabase থাকলে সেখানে, না থাকলে লোকাল ফাইলে ----------
   env: SUPABASE_URL (যেমন https://xxx.supabase.co), SUPABASE_SERVICE_KEY (গোপন) */
const SUPA_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const USE_SUPA = !!(SUPA_URL && SUPA_KEY);
function supaHeaders(extra) {
  return Object.assign({ apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY }, extra || {});
}
function load() {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch (e) { db = seed(); saveLocal(); }
}
function saveLocal() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DB_FILE, JSON.stringify(db)); } catch (e) {}
}
let saveChain = Promise.resolve();
function save() {
  if (!USE_SUPA) { saveLocal(); return; }
  saveChain = saveChain.then(async () => {
    try {
      await fetch(SUPA_URL + "/rest/v1/ck_state", {
        method: "POST",
        headers: supaHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }),
        body: JSON.stringify({ id: 1, data: db, updated_at: new Date().toISOString() })
      });
    } catch (e) { console.error("Supabase save failed:", e.message); saveLocal(); }
  });
}
async function loadAsync() {
  if (!USE_SUPA) { load(); return; }
  try {
    const r = await fetch(SUPA_URL + "/rest/v1/ck_state?id=eq.1&select=data", { headers: supaHeaders() });
    const rows = await r.json();
    if (Array.isArray(rows) && rows[0] && rows[0].data && Array.isArray(rows[0].data.users)) { db = rows[0].data; console.log("Supabase থেকে ডেটা লোড হয়েছে"); return; }
    db = seed(); save();
    console.log("Supabase-এ নতুন ডেটা তৈরি হলো");
  } catch (e) { console.error("Supabase load failed, লোকালে চলছে:", e.message); load(); }
}
async function uploadShot(subId, dataUrl) {
  if (!USE_SUPA || !dataUrl || dataUrl.indexOf("data:image") !== 0) return dataUrl;
  try {
    const base64 = dataUrl.split(",")[1];
    const buf = Buffer.from(base64, "base64");
    const name = subId + ".jpg";
    const r = await fetch(SUPA_URL + "/storage/v1/object/proofs/" + name, {
      method: "POST",
      headers: supaHeaders({ "Content-Type": "image/jpeg", "x-upsert": "true" }),
      body: buf
    });
    if (r.ok) return SUPA_URL + "/storage/v1/object/public/proofs/" + name;
    console.error("Shot upload status:", r.status);
  } catch (e) { console.error("Shot upload failed:", e.message); }
  return dataUrl;
}
function pubUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role, banned: u.banned, joined: u.joined, referCode: u.referCode, referredBy: u.referredBy, pending: money(u.pending), available: money(u.available), totalEarned: money(u.totalEarned), referEarned: money(u.referEarned), totalWithdrawn: money(u.totalWithdrawn), payNumber: u.payNumber || "" };
}
function pubSettings() {
  const s = db.settings;
  return { appName: s.appName, rate: s.rate, referPct: s.referPct, dailyLimit: s.dailyLimit, notice: s.notice, supportTelegram: s.supportTelegram, supportWhatsApp: s.supportWhatsApp, rules: s.rules, methodsOn: s.methodsOn, minWithdraw: s.minWithdraw };
}
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS" });
  res.end(body);
}
function auth(req) {
  const t = (req.headers.authorization || "").replace("Bearer ", "");
  const userId = t && db.sessions[t];
  if (!userId) return null;
  const u = db.users.find(x => x.id === userId);
  return (u && !u.banned) ? u : null;
}
function needAdmin(req, res) {
  const u = auth(req);
  if (!u) { send(res, 401, { error: "লগইন করুন" }); return null; }
  if (u.role !== "admin") { send(res, 403, { error: "শুধু অ্যাডমিনের জন্য" }); return null; }
  return u;
}
function readBody(req) {
  return new Promise(resolve => {
    let data = "";
    req.on("data", c => { data += c; if (data.length > 4_000_000) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch (e) { resolve({}); } });
  });
}

async function api(req, res, url) {
  const p = url.pathname;
  const m = req.method;
  /* ---------- AUTH ---------- */
  if (p === "/api/register" && m === "POST") {
    const b = await readBody(req);
    const name = (b.name || "").trim(), type = b.type, phone = (b.phone || "").trim(), email = (b.email || "").trim().toLowerCase(), rec = (b.recovery || "").trim().toLowerCase(), pw = b.pass || "", ref = (b.ref || "").trim().toUpperCase();
    if (name.length < 3) return send(res, 400, { error: "আপনার সঠিক নাম দিন (কমপক্ষে ৩ অক্ষর)।" });
    if (pw.length < 6) return send(res, 400, { error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।" });
    if (!validEmail(rec)) return send(res, 400, { error: "সঠিক রিকভারি Gmail দিন।" });
    if (isTempMail(rec)) return send(res, 400, { error: "টেম্প মেইল রিকভারি হিসেবে ব্যবহার করা যাবে না।" });
    if (type === "phone") {
      if (!validPhone(phone)) return send(res, 400, { error: "সঠিক ১১ ডিজিটের ফোন নম্বর দিন।" });
      if (db.users.some(u => u.phone === phone)) return send(res, 400, { error: "এই ফোন নম্বর দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে। লগইন করুন।" });
    } else {
      if (!validEmail(email)) return send(res, 400, { error: "সঠিক Gmail/ইমেইল দিন।" });
      if (isTempMail(email)) return send(res, 400, { error: "টেম্প/ভুয়া মেইল দিয়ে অ্যাকাউন্ট খোলা যাবে না।" });
      if (db.users.some(u => u.email === email)) return send(res, 400, { error: "এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট আছে। লগইন করুন।" });
    }
    let referredBy = null;
    if (ref) { const ru = db.users.find(u => u.referCode === ref); if (ru) referredBy = ru.id; }
    const salt = newSalt();
    const u = { id: uid(), name, phone: type === "phone" ? phone : "", email: type === "email" ? email : "", recovery: rec, salt, pass: hashPw(pw, salt), role: (type === "phone" && phone === ADMIN_PHONE) ? "admin" : "user", banned: false, joined: Date.now(), referCode: "CK" + crypto.randomBytes(3).toString("hex").toUpperCase(), referredBy, pending: 0, available: 0, totalEarned: 0, referEarned: 0, totalWithdrawn: 0, payNumber: "" };
    db.users.push(u);
    const t = token(); db.sessions[t] = u.id; save();
    return send(res, 200, { token: t, user: pubUser(u) });
  }
  if (p === "/api/login" && m === "POST") {
    const b = await readBody(req);
    const id = (b.id || "").trim().toLowerCase(), pw = b.pass || "";
    const u = db.users.find(x => x.phone === id || (x.email && x.email === id));
    if (!u) return send(res, 400, { error: "এই নম্বর/Gmail দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি। আগে সাইন আপ করুন।" });
    if (u.banned) return send(res, 403, { error: "এই অ্যাকাউন্টটি ব্যান করা হয়েছে। সাপোর্টে যোগাযোগ করুন।" });
    if (u.pass !== hashPw(pw, u.salt)) return send(res, 400, { error: "পাসওয়ার্ড মেলেনি।" });
    const t = token(); db.sessions[t] = u.id; save();
    return send(res, 200, { token: t, user: pubUser(u) });
  }
  if (p === "/api/forgot" && m === "POST") {
    const b = await readBody(req);
    const id = (b.id || "").trim().toLowerCase(), rec = (b.recovery || "").trim().toLowerCase(), pw = b.newpass || "";
    const u = db.users.find(x => x.phone === id || (x.email && x.email === id));
    if (!u) return send(res, 400, { error: "অ্যাকাউন্ট পাওয়া যায়নি।" });
    if (u.recovery !== rec) return send(res, 400, { error: "রিকভারি Gmail মেলেনি।" });
    if (pw.length < 6) return send(res, 400, { error: "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।" });
    /* বাস্তব ডেপ্লয়ে: রিসেট লিংকটি রিকভারি Gmail-এ পাঠানো হয়; এই ফ্রি সংস্করণে যাচাই রিকভারি Gmail মিললেই রিসেট হয় */
    u.salt = newSalt(); u.pass = hashPw(pw, u.salt); save();
    return send(res, 200, { ok: true });
  }
  /* ---------- USER DATA ---------- */
  if (p === "/api/bootstrap" && m === "GET") {
    const u = auth(req); if (!u) return send(res, 401, { error: "লগইন করুন" });
    return send(res, 200, {
      user: pubUser(u), settings: pubSettings(),
      tasks: db.tasks.map(t => Object.assign({}, t, { used: db.subs.filter(s => s.taskId === t.id && s.status !== "rejected").length })),
      mySubs: db.subs.filter(s => s.userId === u.id),
      myWithdrawals: db.withdrawals.filter(w => w.userId === u.id),
      refs: db.users.filter(x => x.referredBy === u.id).length,
      proofs: db.withdrawals.filter(w => w.status === "paid").slice(-5).reverse().map(w => { const usr = db.users.find(x => x.id === w.userId); return { name: usr ? usr.name : "?", method: w.method, detail: w.detail, amount: w.amount }; })
    });
  }
  if (p === "/api/submissions" && m === "POST") {
    const u = auth(req); if (!u) return send(res, 401, { error: "লগইন করুন" });
    const b = await readBody(req);
    const t = db.tasks.find(x => x.id === b.taskId && x.active);
    if (!t) return send(res, 400, { error: "কাজটি পাওয়া যায়নি বা বন্ধ আছে।" });
    if (!(b.uname || "").trim()) return send(res, 400, { error: "ইউজারনেম/প্রোফাইল লিংক দিন।" });
    if (!b.shotHash) return send(res, 400, { error: "স্ক্রিনশট দিন।" });
    if (db.subs.some(s => s.taskId === t.id && s.userId === u.id && s.status !== "rejected")) return send(res, 400, { error: "এই কাজের প্রমাণ ইতিমধ্যে জমা দিয়েছেন।" });
    const used = db.subs.filter(s => s.taskId === t.id && s.status !== "rejected").length;
    if (used >= t.slots) return send(res, 400, { error: "এই কাজের স্লট শেষ।" });
    const today = db.subs.filter(s => s.userId === u.id && new Date(s.at).toDateString() === new Date().toDateString()).length;
    if (today >= db.settings.dailyLimit) return send(res, 400, { error: "আজকের কাজের সীমা শেষ।" });
    const dup = db.subs.some(s => s.shotHash === b.shotHash);
    const subId = uid();
    const shotStored = await uploadShot(subId, b.shot || null);
    const sub = { id: subId, userId: u.id, taskId: t.id, uname: (b.uname || "").trim(), shot: shotStored, shotHash: b.shotHash, dup, status: "pending", reason: "", at: Date.now(), pay: t.pay };
    db.subs.push(sub); u.pending = money(u.pending + t.pay); save();
    return send(res, 200, { ok: true, dup });
  }
  if (p === "/api/withdrawals" && m === "POST") {
    const u = auth(req); if (!u) return send(res, 401, { error: "লগইন করুন" });
    const b = await readBody(req);
    const s = db.settings, meth = b.method, detail = (b.detail || "").trim(), amt = parseFloat(b.amount || 0);
    if (!s.methodsOn[meth]) return send(res, 400, { error: "এই মাধ্যমে উত্তোলন এখন বন্ধ আছে।" });
    if (!detail) return send(res, 400, { error: "নম্বর/ঠিকানা দিন।" });
    if (meth !== "binance" && !validPhone(detail)) return send(res, 400, { error: "সঠিক ১১ ডিজিটের নম্বর দিন।" });
    if (!(amt > 0)) return send(res, 400, { error: "সঠিক পরিমাণ দিন।" });
    if (amt < s.minWithdraw[meth]) return send(res, 400, { error: "সর্বনিম্ন উত্তোলন ৳" + s.minWithdraw[meth] });
    if (amt > u.available) return send(res, 400, { error: "Available ব্যালেন্সে এত টাকা নেই।" });
    if (u.payNumber && meth !== "binance" && detail !== u.payNumber) return send(res, 400, { error: "শুধু বাঁধা পেমেন্ট নম্বরেই উত্তোলন হবে।" });
    u.available = money(u.available - amt);
    db.withdrawals.push({ id: uid(), userId: u.id, method: meth, detail: detail + (b.extra ? " (" + b.extra + ")" : ""), amount: amt, status: "pending", reason: "", at: Date.now() });
    save();
    return send(res, 200, { ok: true });
  }
  if (p === "/api/paynumber" && m === "POST") {
    const u = auth(req); if (!u) return send(res, 401, { error: "লগইন করুন" });
    const b = await readBody(req);
    const v = (b.payNumber || "").trim();
    if (v && !validPhone(v)) return send(res, 400, { error: "সঠিক ১১ ডিজিটের নম্বর দিন।" });
    if (v && db.users.some(x => x.id !== u.id && x.payNumber === v)) return send(res, 400, { error: "এই পেমেন্ট নম্বর অন্য অ্যাকাউন্টে বাঁধা আছে।" });
    u.payNumber = v; save();
    return send(res, 200, { ok: true });
  }
  if (p === "/api/orders" && m === "POST") {
    const u = auth(req); if (!u) return send(res, 401, { error: "লগইন করুন" });
    const b = await readBody(req);
    if ((b.title || "").trim().length < 5 || (b.link || "").indexOf("http") !== 0 || !(parseInt(b.slots, 10) > 0)) return send(res, 400, { error: "শিরোনাম, সঠিক লিংক ও স্লট দিন।" });
    db.orders.push({ id: uid(), userId: u.id, type: b.type, title: b.title.trim(), link: b.link.trim(), slots: parseInt(b.slots, 10), status: "pending", at: Date.now() });
    save();
    return send(res, 200, { ok: true });
  }
  /* ---------- ADMIN ---------- */
  if (p.startsWith("/api/admin/")) {
    const a = needAdmin(req, res); if (!a) return;
    if (p === "/api/admin/bootstrap" && m === "GET") {
      return send(res, 200, { users: db.users.map(pubUser), tasks: db.tasks, subs: db.subs, withdrawals: db.withdrawals, orders: db.orders, settings: Object.assign({}, db.settings) });
    }
    const subAct = p.match(/^\/api\/admin\/subs\/(\w+)\/(approve|reject)$/);
    if (subAct && m === "POST") {
      const b = await readBody(req);
      const s = db.subs.find(x => x.id === subAct[1]);
      if (!s || s.status !== "pending") return send(res, 400, { error: "প্রমাণটি পাওয়া যায়নি।" });
      const usr = db.users.find(x => x.id === s.userId);
      if (subAct[2] === "approve") {
        s.status = "approved";
        if (usr) {
          usr.pending = money(Math.max(0, usr.pending - s.pay)); usr.available = money(usr.available + s.pay); usr.totalEarned = money(usr.totalEarned + s.pay);
          if (usr.referredBy) {
            const ref = db.users.find(x => x.id === usr.referredBy);
            if (ref) { const bonus = money(s.pay * db.settings.referPct / 100); ref.available = money(ref.available + bonus); ref.referEarned = money(ref.referEarned + bonus); ref.totalEarned = money(ref.totalEarned + bonus); }
          }
        }
      } else {
        s.status = "rejected"; s.reason = b.reason || "";
        if (usr) usr.pending = money(Math.max(0, usr.pending - s.pay));
      }
      save(); return send(res, 200, { ok: true });
    }
    const wdAct = p.match(/^\/api\/admin\/withdrawals\/(\w+)\/(pay|reject)$/);
    if (wdAct && m === "POST") {
      const b = await readBody(req);
      const w = db.withdrawals.find(x => x.id === wdAct[1]);
      if (!w || w.status !== "pending") return send(res, 400, { error: "অনুরোধটি পাওয়া যায়নি।" });
      const usr = db.users.find(x => x.id === w.userId);
      if (wdAct[2] === "pay") { w.status = "paid"; if (usr) usr.totalWithdrawn = money(usr.totalWithdrawn + w.amount); }
      else { w.status = "rejected"; w.reason = b.reason || ""; if (usr) usr.available = money(usr.available + w.amount); }
      save(); return send(res, 200, { ok: true });
    }
    if (p === "/api/admin/tasks" && m === "POST") {
      const b = await readBody(req);
      const t = { id: uid(), type: b.type, title: (b.title || "").trim(), link: (b.link || "").trim(), desc: b.desc || "", pay: parseFloat(b.pay || 0), slots: parseInt(b.slots, 10) || 0, active: true };
      if (t.title.length < 5 || !(t.pay >= 0) || !(t.slots > 0)) return send(res, 400, { error: "শিরোনাম, পেমেন্ট ও স্লট ঠিকমতো দিন।" });
      db.tasks.push(t); save(); return send(res, 200, { ok: true, task: t });
    }
    const taskAct = p.match(/^\/api\/admin\/tasks\/(\w+)$/);
    if (taskAct && (m === "PUT" || m === "DELETE")) {
      const t = db.tasks.find(x => x.id === taskAct[1]);
      if (!t) return send(res, 404, { error: "কাজ পাওয়া যায়নি" });
      if (m === "DELETE") db.tasks = db.tasks.filter(x => x.id !== t.id);
      else { const b = await readBody(req); Object.assign(t, { type: b.type, title: (b.title || "").trim(), link: (b.link || "").trim(), desc: b.desc || "", pay: parseFloat(b.pay || 0), slots: parseInt(b.slots, 10) || 0 }); }
      save(); return send(res, 200, { ok: true });
    }
    const tgl = p.match(/^\/api\/admin\/tasks\/(\w+)\/toggle$/);
    if (tgl && m === "POST") { const t = db.tasks.find(x => x.id === tgl[1]); if (t) { t.active = !t.active; save(); } return send(res, 200, { ok: true }); }
    const ordAct = p.match(/^\/api\/admin\/orders\/(\w+)\/(approve|reject)$/);
    if (ordAct && m === "POST") {
      const o = db.orders.find(x => x.id === ordAct[1]);
      if (!o || o.status !== "pending") return send(res, 400, { error: "অর্ডার পাওয়া যায়নি।" });
      o.status = ordAct[2] === "approve" ? "approved" : "rejected";
      if (o.status === "approved") db.tasks.push({ id: uid(), type: o.type, title: o.title, link: o.link, desc: "১. লিংকে ক্লিক করে কাজটি খুলুন\n২. কাজটি সম্পন্ন করুন\n৩. স্ক্রিনশট নিয়ে প্রমাণ জমা দিন", pay: db.settings.rate, slots: o.slots, active: true });
      save(); return send(res, 200, { ok: true });
    }
    const usrAct = p.match(/^\/api\/admin\/users\/(\w+)\/(ban|resetpw)$/);
    if (usrAct && m === "POST") {
      const x = db.users.find(u2 => u2.id === usrAct[1]);
      if (!x || x.role === "admin") return send(res, 400, { error: "ব্যবহারকারী পাওয়া যায়নি।" });
      if (usrAct[2] === "ban") x.banned = !x.banned;
      else { const b = await readBody(req); if (!b.newpass || b.newpass.length < 6) return send(res, 400, { error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।" }); x.salt = newSalt(); x.pass = hashPw(b.newpass, x.salt); }
      save(); return send(res, 200, { ok: true });
    }
    if (p === "/api/admin/settings" && m === "PUT") {
      const b = await readBody(req);
      const s = db.settings;
      ["appName","notice","rules","supportTelegram","supportWhatsApp"].forEach(k => { if (typeof b[k] === "string") s[k] = b[k]; });
      if (b.rate != null) s.rate = parseFloat(b.rate) || s.rate;
      if (b.referPct != null) s.referPct = parseFloat(b.referPct) || s.referPct;
      if (b.dailyLimit != null) s.dailyLimit = parseInt(b.dailyLimit, 10) || s.dailyLimit;
      if (b.minWithdraw) s.minWithdraw = b.minWithdraw;
      if (b.methodsOn) s.methodsOn = b.methodsOn;
      save(); return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: "not found" });
  }
  return send(res, 404, { error: "not found" });
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".apk": "application/vnd.android.package-archive" };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS" }); return res.end(); }
  if (url.pathname.startsWith("/api/")) return api(req, res, url);
  let file = url.pathname === "/" ? "index.html" : url.pathname === "/download" ? "download.html" : url.pathname.slice(1);
  const full = path.join(PUBLIC_DIR, path.normalize(file).replace(/^(\.\.[/\\])+/, ""));
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
});
loadAsync().then(() => {
  server.listen(PORT, () => console.log("ChotoKaj server চলছে: http://localhost:" + PORT + (USE_SUPA ? " (ডেটা: Supabase)" : " (ডেটা: লোকাল ফাইল)")));
});
