/** Pure-logic tests that need no database:  npm run test:units */
import { normalizePhone } from '../utils/phone.js';
import { generateOtp, hashOtp, safeEqualHex } from '../utils/otp.js';
import { passwordResetEmail, sendMail } from '../services/mailer.js';

let failed = 0;
const ok = (c, m) => { console.log(`${c ? '  ✅' : '  ❌'} ${m}`); if (!c) failed += 1; };

console.log('▶ Phone normalisation');
for (const [input, want] of [
  ['9876543210', '+919876543210'], ['98765 43210', '+919876543210'], ['+91 98765-43210', '+919876543210'],
  ['09876543210', '+919876543210'], ['919876543210', '+919876543210'], ['+14155552671', '+14155552671'],
  ['1234567890', null], ['98765', null], ['abcdefghij', null], ['', null], ['+91987654321', null],
]) ok(normalizePhone(input) === want, `${JSON.stringify(input)} -> ${normalizePhone(input)}`);

console.log('▶ OTP');
const codes = new Set(Array.from({ length: 500 }, generateOtp));
ok([...codes].every((c) => /^\d{6}$/.test(c)), 'all codes are exactly 6 digits');
ok(codes.size > 450, `codes are well spread (${codes.size}/500 unique)`);
const h = hashOtp('u1', '123456', 'secret-secret-secret');
ok(safeEqualHex(h, hashOtp('u1', '123456', 'secret-secret-secret')), 'same code + user + secret verifies');
ok(!safeEqualHex(h, hashOtp('u1', '123457', 'secret-secret-secret')), 'wrong code is rejected');
ok(!safeEqualHex(h, hashOtp('u2', '123456', 'secret-secret-secret')), 'code is bound to the user');
ok(!safeEqualHex(h, 'zz'), 'garbage hash is rejected without throwing');

console.log('▶ Email template');
const mail = passwordResetEmail({ name: '<script>alert(1)</script> Ravi', code: '042917', minutes: 10 });
ok(mail.subject.includes('042917') && mail.text.includes('042917'), 'contains the code');
ok(!mail.html.includes('<script>'), 'user name is HTML-escaped');
const res = await sendMail({ to: 'x@example.com', ...mail });
ok(res.dev === true, 'without SMTP the mail is printed to the terminal (dev fallback)');

console.log(failed ? `\n❌ ${failed} failed` : '\n✅ All unit checks passed');
process.exit(failed ? 1 : 0);
