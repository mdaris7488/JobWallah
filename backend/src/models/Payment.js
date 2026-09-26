import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: String, enum: ['single_exam', 'monthly_pro', 'annual_pass'], required: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' }, // single_exam only
    amount: { type: Number, required: true, min: 1 }, // rupees, always taken from the server price list
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created' },
    provider: { type: String, enum: ['razorpay', 'demo'], required: true },
    providerOrderId: { type: String, required: true },
    providerPaymentId: { type: String },
    method: { type: String, maxlength: 30 }, // upi / card / netbanking / wallet ...
    paidAt: Date,
    failedReason: { type: String, maxlength: 300 },
    invoiceNo: { type: String },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
    billing: { name: String, email: String, phone: String }, // snapshot printed on the receipt
  },
  { timestamps: true }
);

paymentSchema.index({ providerOrderId: 1 }, { unique: true });
paymentSchema.index({ providerPaymentId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ invoiceNo: 1 }, { unique: true, sparse: true });
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

export const Payment = mongoose.model('Payment', paymentSchema);
