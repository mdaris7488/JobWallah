import { Link, useParams } from 'react-router-dom';

const PAGES = {
  privacy: {
    title: 'Privacy Policy',
    body: [
      'We collect only what we need to run your account: name, email, optional phone/qualification/state, the jobs you save or follow, and applications you submit.',
      'When you press Apply we open the company\'s official page and record that you clicked (job, time, and your profile details) so our team can support you. You apply on the company\'s own website; we never receive your application documents.',
      'We never sell your data. You can ask us to delete your account and history at any time.',
    ],
  },
  terms: {
    title: 'Terms of Use',
    body: [
      'JobWallah provides job information for convenience. Use it at your own discretion and always confirm details on the official source.',
      'You agree not to submit false information, upload harmful files, or attempt to disrupt the service.',
      'Paid alert plans are billed as shown on the Pro page and activate only after successful payment.',
    ],
  },
  refund: {
    title: 'Refund Policy',
    body: [
      'JobWallah Pro plans (Single Exam Pass, Monthly Pro, Annual Aspirant Pass) are digital subscriptions that activate immediately after a successful payment. Because access is granted instantly, all payments are final and non-refundable once the plan is active, except as described below.',
      'You are eligible for a full refund only in these cases: (a) money was deducted from your account but your plan did not activate within 30 minutes - contact support with your payment reference and we will activate your plan or refund you in full; (b) you were charged more than once for the same plan by mistake (a duplicate charge); (c) a payment failed on Razorpay\'s end but the amount was still deducted - such amounts are auto-reversed by Razorpay/your bank within 5-7 working days, and we will assist if it does not happen.',
      'We do not offer refunds for change of mind, partial use of a plan, or because an exam you tracked was postponed or cancelled by the conducting body - JobWallah only aggregates publicly available exam information and does not control exam schedules.',
      'A payment stuck in "pending" (money debited, status not yet confirmed) is not a failed payment - please wait up to 30 minutes for the bank/Razorpay confirmation before contacting support, since most pending payments resolve automatically.',
      'To request a refund under the eligible cases above, email us with your registered email, the payment date and the payment/order id. Approved refunds are processed to the original payment method within 5-7 working days.',
    ],
  },
  disclaimer: {
    title: 'Disclaimer',
    body: [
      'JobWallah is an independent employment information platform and is not a government website.',
      'Recruitment notices can change. Always verify dates, eligibility and fees on the official notification before you apply.',
      'Private job listings are provided by employers; JobWallah does not guarantee interviews or offers.',
    ],
  },
};

export default function Legal() {
  const { page } = useParams();
  const doc = PAGES[page];
  if (!doc) return <div className="container page"><h1>Page not found</h1><Link to="/">Go home</Link></div>;
  return (
    <div className="container page narrow">
      <h1>{doc.title}</h1>
      {doc.body.map((p) => <p key={p} className="prose">{p}</p>)}
    </div>
  );
}
