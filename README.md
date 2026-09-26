# JobWallah — Government + Private Job Portal (Full Stack)

React 18 + Vite + Redux Toolkit (frontend) · Node.js + Express + MongoDB (backend) · Razorpay payments · Docker + nginx (optional deploy).

## 1. Kya-kya hai

| Area | Features |
|---|---|
| **Jobs** | Govt + private listings, filters, full job page (description, role & responsibilities, requirements… jo admin bhare wahi dikhta hai), **Apply → company ki official site** |
| **Admin** | Job create / edit / delete / hide, category dikhti hai, **kis user ne Apply click kiya** (naam, email, phone, job, category) + CSV export, admit card/result updates, users, **payments & revenue** |
| **Auth** | Register (**mobile number mandatory**), login, **forgot password → 6-digit code email pe**, rotating refresh tokens, account lock |
| **Free tools** | Image compressor (target KB/MB), resizer, converter, image→PDF, PDF→image (browser me), video compressor |
| **Pro tools** | Batch (20 files → ZIP), PDF merge, PDF page extract, higher limits, Exam photo & signature tool (Annual) |
| **Payments** | Checkout page + **Razorpay** (UPI, cards, netbanking, wallets), signature verification, webhook, receipts (PDF + email), payment history, admin payments |
| **UI** | Modern glass navbar, animated hero, scroll-reveal, count-up, skeletons, mobile bottom-nav, reduced-motion support |

## 2. Run karna (VS Code + MongoDB Atlas, Docker nahi chahiye)

```bash
# Terminal 1
cd backend
copy .env.example .env      # Mac/Linux: cp .env.example .env   -> MONGO_URI + JWT_ACCESS_SECRET bharo
npm install                 # sharp + ffmpeg-static ke binaries bhi download hote hain
npm run seed
npm run dev                 # http://localhost:5000

# Terminal 2
cd frontend
npm install
npm run dev                 # http://localhost:5173
```
Login: admin `admin@jobwallah.in` / `Admin@12345`, demo user `user@jobwallah.in` / `User@12345` (seed ke baad).
JWT secret banane ka command: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## 3. Forgot password + email

* Development me `SMTP_HOST` khali chhodo: **6-digit code backend terminal me print hota hai** (email account ki zaroorat nahi).
* Real email ke liye `.env`: Gmail → 2-Step Verification on karo → Google Account → Security → **App passwords** → 16-char password:
  `SMTP_HOST=smtp.gmail.com  SMTP_PORT=587  SMTP_USER=you@gmail.com  SMTP_PASS=<app password>  MAIL_FROM="JobWallah <you@gmail.com>"`
  (Brevo / Zoho / SES bhi chalte hain.)
* Code 10 min valid, ek baar use hota hai, 5 galat try ke baad lock, resend 60 s baad, IP + email dono pe rate limit, response se pata nahi chalta email registered hai ya nahi.
* Password badalte hi baaki sab devices logout ho jate hain.

## 4. Payments (Razorpay)

**Flow:** Pricing → `Choose plan` → **/checkout/:plan** → Razorpay window → browser `payment_id + signature` bhejta hai → server signature verify + Razorpay se payment confirm/capture → plan active + receipt (PDF + email). Backup: **webhook** (browser band ho jaye tab bhi plan activate).

**Modes** (`backend/.env` → `PAYMENT_MODE`)
* `demo` — bina paise ke plan activate (sirf development / testing).
* `razorpay` — real checkout.

**Razorpay test setup (5 min)**
1. razorpay.com pe account → Dashboard ko **Test Mode** me rakho → Settings → API Keys → *Generate Test Key*.
2. `backend/.env`:
   ```
   PAYMENT_MODE=razorpay
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxx
   ```
   Backend restart karo → Pricing → plan → Pay.
3. Test payment: UPI `success@razorpay` (fail ke liye `failure@razorpay`) · Card `4111 1111 1111 1111`, koi bhi future expiry, koi bhi CVV.
4. **Webhook (recommended):** local pe tunnel chalao (`ngrok http 5000` ya `cloudflared`), Razorpay → Settings → Webhooks → URL `https://<tunnel>/api/v1/payments/webhook`, secret ko `RAZORPAY_WEBHOOK_SECRET` me daalo, events: `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`.
5. Refund: Razorpay dashboard se karo → webhook se plan automatically cancel ho jata hai.

**Safety:** price sirf server se aata hai (client badal nahi sakta) · signature `HMAC-SHA256` timing-safe compare · amount + order match check · idempotent (verify aur webhook dono aaye to bhi ek hi subscription) · card/UPI details server tak aati hi nahi · webhook raw-body signature · payment endpoints pe rate limit.

**Live jane se pehle:** Razorpay KYC → Live keys → `PAYMENT_MODE=razorpay` → HTTPS + `COOKIE_SECURE=true` → webhook URL set → `Refund Policy` page (`Legal.jsx`) apne hisaab se likho (abhi template hai) → GST registration ho to receipt ko proper tax invoice format me badlo (abhi "Payment receipt" hai, prices tax-inclusive).

## 5. Free / Pro tools

| Tool | Free | Pro (monthly) | Annual |
|---|---|---|---|
| Image compress / resize / convert | 1 file, 10 MB | 20 files (ZIP), 30 MB | same |
| Image → PDF | 10 images | 50 images | same |
| PDF → Image | browser me, unlimited | same | same |
| Video compress | 2/day, 50 MB, 10 min | 30/day, 300 MB, 60 min | 60/day |
| PDF merge, PDF page extract | – | ✓ | ✓ |
| Exam photo & signature (exact px + max KB) | – | – | ✓ |
| Daily uses / per-minute tries | 15 / 5 | 200 / 20 | 500 / 20 |

**Server ko attack se bachane ki layers** (sab `backend/src/middleware/toolsGuard.js` + `services/`):
1. IP rate limit (100 req / 10 min) → 2. **per-user per-minute limit** (plan ke hisaab se) → 3. plan/tier check → 4. **Content-Length pre-check** (bada upload disk pe aane se pehle reject) → 5. per-user concurrency (1 free / 2 pro) → 6. **daily quota** (MongoDB, atomic, fail hone par wapas mil jata hai) → 7. bounded queue (server busy → 503) → 8. file content sniffing (fake extension nahi chalta), 50 MP pixel limit, SVG reject → 9. ffmpeg: no shell, protocol whitelist, timeout pe kill, background job → 10. temp files hamesha delete.
`429` response me `Retry-After` aur "kitni der baad try karein" milta hai.
> Multi-server deploy me rate-limit store / video jobs ko Redis (BullMQ) pe le jana hoga; single server ke liye ye design sahi hai.

## 6. Tests (bina database ke)

```bash
cd backend
npm run test:units       # phone, OTP, email template
npm run test:tools       # image/PDF/ZIP engines (+ video agar ffmpeg mile)
npm run test:payments    # Razorpay client (fake server), signatures, receipt PDF
```

## 7. Docker (optional)
```bash
cp .env.example .env     # sab values badlo
docker compose up -d --build
docker compose exec api npm run seed
```
Open http://localhost:8080 . nginx me Razorpay ke liye CSP allow-list + tools ke liye 300 MB upload already set hai.

## 8. Folder structure
```
backend/src   config · models · controllers · routes · middleware · services (imageTools, pdfTools, videoService,
              razorpay, payments, invoice, mailer) · validators · scripts (seed + self tests)
frontend/src  api · store · components (+tools) · pages (+admin, +tools) · utils
```

## 9. Important API routes (`/api/v1`)
`POST /auth/register|login|refresh|logout|forgot-password|reset-password` · `GET /jobs`, `/jobs/:slug`, `POST /jobs/:id/apply-click` ·
`GET /tools/config`, `POST /tools/image/{compress,resize,convert,exam-photo}`, `/tools/pdf/{from-images,merge,extract}`, `/tools/video/compress` + `/tools/jobs/:id` ·
`GET /subscriptions/plans|me` · `POST /payments/orders|verify|demo/confirm`, `GET /payments/me`, `/payments/:id/invoice`, `POST /payments/webhook` ·
`/admin/*` (jobs, applications + export, updates, users, payments, stats)

## 10. Troubleshooting
| Problem | Fix |
|---|---|
| `Invalid environment configuration` | `.env` me `MONGO_URI` + 32+ char `JWT_ACCESS_SECRET` |
| Reset code email nahi aa raha | Dev me terminal dekho; real SMTP me App Password check karo |
| Video tool "not available" | `npm install` dobara (ffmpeg-static download) ya `.env` me `FFMPEG_PATH` do |
| `Payment gateway unavailable` | `RAZORPAY_KEY_ID/SECRET` sahi hain? Test keys ke saath Test Mode on? |
| Payment ho gaya par plan active nahi | Webhook set karo; ya Dashboard → Subscription refresh (verify call fail hui thi to webhook activate karega) |
| PDF → Image nahi chal raha | `frontend` me `npm install` (pdfjs-dist 4.10.38 pinned hai), hard refresh |

## 11. Deployment ke liye (GitHub → server)

Aapka domain: **https://jobwallah.online**. Deploy karne ka sabse aasan tareeka — GitHub se pull karke `docker-compose.yml` chalana (already is repo me hai, Caddy se automatic HTTPS milta hai).

```bash
# server par (DigitalOcean / Hetzner Ubuntu 24.04 droplet)
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin git

git clone https://github.com/<aapka-username>/<repo>.git jobwallah
cd jobwallah
cp .env.example .env
nano .env        # CLIENT_URL, MONGO_URI (Atlas), JWT_ACCESS_SECRET, SEED_ADMIN_*, Razorpay/SMTP keys bharo

docker compose up -d --build
docker compose exec api npm run seed
```
DNS me `jobwallah.online` aur `www.jobwallah.online` dono ka **A record** server ke IP par point karo (Caddy khud SSL le lega, kuch extra karna nahi hai). Atlas → Network Access me sirf is server ka IP allow karo (`0.0.0.0/0` hata do).

## 12. Security audit (is update me)

Poora security checklist verify kiya gaya — pass/fixed items neeche ke security report me hain. Do real fixes is baar hue:
1. **Single Exam Pass checkout** — pehle sirf "already followed" exams me se choose karne deta tha; agar koi exam follow na kiya ho to koi option hi nahi milta tha. Ab checkout page par hi type-ahead search se koi bhi active government exam choose kar sakte ho.
2. **Password-reset OTP log leak (production)** — agar SMTP configure na ho, to reset ka 6-digit code server ke terminal/logs me print ho jata tha. Production me ab ye kabhi print nahi hota — SMTP missing hone par request fail hoti hai (aur ops ko pata chal jata hai), code kahi leak nahi hota.
3. Admit Card / Results page aur Admin → Updates list ka padding bug (ek hi element par do conflicting CSS classes) fix kiya.
4. `docker-compose.yml` ko Atlas + Caddy (auto HTTPS) ke liye rewrite kiya, aur `Strict-Transport-Security` header add kiya.


## 13. Video tool ko band/chalu karna (agar hosting budget tight ho)

Image compress/resize/convert/PDF tools halke hain — kisi bhi cheap server par chalte hain, koi extra cost nahi.
Video compressor thoda zyada CPU/RAM maangta hai (koi extra paid service nahi, bas apne hi server ka resource).
Agar abhi budget tight hai, sirf video tool ko band kar sakte ho baaki sab chalu rehta hai:

```
# .env me
DISABLE_VIDEO_TOOL=true
```
Jab server upgrade karo, isko `false` kar do (ya line hata do) — turant wapas chalu ho jayega, kuch aur karna nahi padega.
