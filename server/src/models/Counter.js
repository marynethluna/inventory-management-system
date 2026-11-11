import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = mongoose.model('Counter', counterSchema);

/** Atomically generates the next sequential reference (e.g. INV-0001). */
export async function nextSequence(key, prefix, pad = 4, session = null) {
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  if (session) options.session = session;
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    options
  );
  return `${prefix}${String(counter.seq).padStart(pad, '0')}`;
}
