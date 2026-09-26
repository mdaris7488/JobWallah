import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: String, enum: ['single_exam', 'monthly_pro', 'annual_pass'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' }, // only for single_exam
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }, // the payment that created this subscription
    provider: { type: String, default: 'demo' },
    paymentRef: String,
  },
  { timestamps: true }
);

subscriptionSchema.index({ user: 1, status: 1, endsAt: -1 });
subscriptionSchema.index({ payment: 1 }, { unique: true, sparse: true }); // one subscription per payment (idempotent fulfilment)

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
