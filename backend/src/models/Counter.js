import mongoose from 'mongoose';

// Atomic sequence numbers (receipt numbers).
const counterSchema = new mongoose.Schema({ _id: String, seq: Number });
export const Counter = mongoose.model('Counter', counterSchema);

export async function nextSequence(name) {
  const doc = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return doc.seq;
}
