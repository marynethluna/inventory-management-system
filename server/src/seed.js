import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './config/db.js';
import { User } from './models/User.js';
import { Category } from './models/Category.js';
import { Item } from './models/Item.js';
import { StockTransaction } from './models/StockTransaction.js';
import { BorrowRecord } from './models/BorrowRecord.js';
import { ActivityLog } from './models/ActivityLog.js';
import { Counter } from './models/Counter.js';
import { getSystemSettings } from './models/SystemSetting.js';

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days, hour = 9, minute = 15) => {
  const date = new Date(Date.now() - days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const CATEGORIES = [
  { name: 'Keyboards', description: 'Keyboards issued to school computer-lab workstations.' },
  { name: 'Mice', description: 'Wired and wireless computer mice for student workstations.' },
  { name: 'Monitors', description: 'Desktop displays assigned to computer laboratories.' },
  { name: 'System Units', description: 'Desktop computers and replacement system units.' },
  { name: 'Projectors', description: 'Classroom and computer-lab projection equipment.' },
  { name: 'Other School Resources', description: 'Cables, headsets, UPS units and other lab resources.' },
];

const ITEMS = [
  {
    name: 'USB Keyboard — Dell KB216', category: 'Keyboards', opening: 24, minimumStock: 8, unit: 'pcs',
    location: 'Computer Lab 1', condition: 'Good', description: 'Full-size USB keyboard for student desktop workstations.',
    events: [
      { type: 'Stock In', qty: 12, days: 6, supplier: 'Campus IT procurement', remarks: 'Replacement keyboards for Lab 1.' },
      { type: 'Stock Out', qty: 14, days: 3, reason: 'Computer Lab 1 workstation replacements', remarks: 'Replaced keyboards with unresponsive keys.' },
    ],
  },
  {
    name: 'USB Keyboard — Logitech K120', category: 'Keyboards', opening: 18, minimumStock: 6, unit: 'pcs',
    location: 'Computer Lab 2', condition: 'Good', description: 'Spill-resistant wired keyboard for shared laboratory PCs.',
    events: [{ type: 'Stock Out', qty: 4, days: 2, reason: 'New workstation setup', remarks: 'Issued for four refurbished PCs.' }],
  },
  {
    name: 'Optical Mouse — Logitech B100', category: 'Mice', opening: 28, minimumStock: 10, unit: 'pcs',
    location: 'Computer Lab 1', condition: 'Good', description: 'USB wired optical mouse, 800 DPI, for desktop workstations.',
    events: [
      { type: 'Stock Out', qty: 24, days: 5, reason: 'Replaced defective mice', remarks: 'Issued to Computer Lab 1 workstations.' },
      { type: 'Stock In', qty: 2, days: 1, supplier: 'Campus IT procurement', remarks: 'Small replacement delivery.' },
    ],
  },
  {
    name: 'Wireless Presentation Mouse', category: 'Mice', opening: 6, minimumStock: 3, unit: 'pcs',
    location: 'AV Room', condition: 'Good', description: 'Wireless presenter with laser pointer for classroom presentations.',
    events: [{ type: 'Stock Out', qty: 4, days: 4, reason: 'Faculty presentation kits', remarks: 'Issued to the AV support desk.' }],
  },
  {
    name: 'LED Monitor — 24 inch IPS', category: 'Monitors', opening: 16, minimumStock: 5, unit: 'pcs',
    location: 'Computer Lab 2', condition: 'Good', description: '24-inch Full HD IPS monitor with HDMI and DisplayPort inputs.',
    events: [
      { type: 'Stock In', qty: 4, days: 6, supplier: 'Campus IT procurement', remarks: 'Additional monitors for Lab 2.' },
      { type: 'Stock Out', qty: 3, days: 2, reason: 'Faculty workstation upgrade', remarks: 'Installed in the faculty preparation room.' },
    ],
  },
  {
    name: 'LED Monitor — 22 inch', category: 'Monitors', opening: 9, minimumStock: 4, unit: 'pcs',
    location: 'Computer Lab 1', condition: 'Fair', description: '22-inch Full HD monitor retained for classroom lab use.',
    events: [{ type: 'Stock Out', qty: 2, days: 5, reason: 'Replacement of damaged displays', remarks: 'Two older displays removed from service.' }],
  },
  {
    name: 'Desktop System Unit — Core i5', category: 'System Units', opening: 12, minimumStock: 4, unit: 'unit',
    location: 'Computer Lab 1', condition: 'Good', description: 'Core i5 desktop, 16 GB RAM, 512 GB SSD, Windows-compatible.',
    events: [
      { type: 'Stock Out', qty: 3, days: 4, reason: 'Computer Lab 2 workstation replacement', remarks: 'Issued after imaging and asset tagging.' },
      { type: 'Stock In', qty: 1, days: 1, supplier: 'Campus IT procurement', remarks: 'Replacement unit for a failed workstation.' },
    ],
  },
  {
    name: 'Desktop System Unit — Core i3', category: 'System Units', opening: 7, minimumStock: 3, unit: 'unit',
    location: 'Storage Area', condition: 'Needs Repair', description: 'Core i3 desktop reserved for diagnostics and spare parts.',
    events: [{ type: 'Stock Out', qty: 2, days: 6, reason: 'Parts recovery', remarks: 'Units transferred to the repair bench.' }],
  },
  {
    name: 'Epson Classroom Projector', category: 'Projectors', opening: 5, minimumStock: 2, unit: 'unit',
    location: 'AV Room', condition: 'Good', description: 'Portable 3LCD projector with HDMI input and carrying case.',
    events: [
      { type: 'Stock Out', qty: 4, days: 5, reason: 'Classroom deployment', remarks: 'Assigned to lecture rooms for the term.' },
      { type: 'Stock In', qty: 1, days: 2, supplier: 'AV equipment supplier', remarks: 'Replacement projector received.' },
    ],
  },
  {
    name: 'BenQ Short-Throw Projector', category: 'Projectors', opening: 3, minimumStock: 2, unit: 'unit',
    location: 'Computer Lab 2', condition: 'Good', description: 'Short-throw projector permanently installed in Computer Lab 2.',
    events: [{ type: 'Stock Out', qty: 1, days: 3, reason: 'Maintenance loan', remarks: 'One spare unit assigned during projector servicing.' }],
  },
  {
    name: 'HDMI Cable — 2 metre', category: 'Other School Resources', opening: 36, minimumStock: 15, unit: 'pcs',
    location: 'AV Room', condition: 'Good', description: '2-metre HDMI cable for monitors, projectors and lab equipment.',
    events: [
      { type: 'Stock Out', qty: 22, days: 4, reason: 'Classroom AV kits', remarks: 'Cables issued to equipped lecture rooms.' },
      { type: 'Stock In', qty: 10, days: 2, supplier: 'Campus IT procurement', remarks: 'Restocked common AV cables.' },
    ],
  },
  {
    name: 'USB Headset with Microphone', category: 'Other School Resources', opening: 20, minimumStock: 8, unit: 'pcs',
    location: 'Computer Lab 2', condition: 'Good', description: 'Over-ear USB headset for language and online learning activities.',
    events: [{ type: 'Stock Out', qty: 5, days: 1, reason: 'Online learning station setup', remarks: 'Issued to designated lab stations.' }],
  },
  {
    name: '650 VA UPS', category: 'Other School Resources', opening: 10, minimumStock: 4, unit: 'unit',
    location: 'Computer Lab 1', condition: 'Fair', description: 'Line-interactive UPS for protecting desktop workstations.',
    events: [
      { type: 'Stock Out', qty: 6, days: 6, reason: 'Workstation power protection', remarks: 'Installed in Computer Lab 1.' },
      { type: 'Stock In', qty: 2, days: 3, supplier: 'Campus IT procurement', remarks: 'Replacement units received.' },
    ],
  },
];

async function createBootstrapAdmin() {
  if (await User.exists({})) return null;
  const email = String(process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD || '';
  const name = String(process.env.INITIAL_ADMIN_NAME || 'Inventory Administrator').trim();
  if (!email || !password) {
    console.log('No bootstrap administrator configured. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD before first launch to provision an admin account.');
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 72) {
    throw new Error('Bootstrap administrator settings are invalid: provide a valid email and an 8–72 character password.');
  }
  const usernameBase = email.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 30);
  const username = usernameBase.length >= 3 ? usernameBase : `admin-${usernameBase || 'user'}`;
  const user = await User.create({
    name,
    email,
    username,
    passwordHash: await User.hashPassword(password),
    role: 'Administrator',
    isActive: true,
  });
  console.log(`Bootstrap administrator provisioned for ${email}.`);
  return user;
}

export async function seedDatabase({ force = false } = {}) {
  const bootstrapAdmin = await createBootstrapAdmin();
  await getSystemSettings();

  if (force) {
    await Promise.all([
      Category.deleteMany({}),
      Item.deleteMany({}),
      StockTransaction.deleteMany({}),
      BorrowRecord.deleteMany({}),
      ActivityLog.deleteMany({}),
      Counter.deleteMany({}),
    ]);
    console.log('Inventory records cleared for reseeding. User accounts are preserved.');
  } else if (await Item.countDocuments()) {
    console.log('Seed skipped: inventory records already exist.');
    return { seeded: false };
  }

  const actor = bootstrapAdmin || await User.findOne({ role: 'Administrator', isActive: true });
  const categories = {};
  for (const entry of CATEGORIES) {
    const category = await Category.create({ ...entry, createdBy: actor?._id || null });
    categories[entry.name] = category;
  }

  let itemSequence = 0;
  let transactionSequence = 0;
  for (const definition of ITEMS) {
    itemSequence += 1;
    const itemCode = `INV-${String(itemSequence).padStart(4, '0')}`;
    const item = await Item.create({
      itemCode,
      name: definition.name,
      category: categories[definition.category]._id,
      description: definition.description,
      quantity: definition.opening,
      unit: definition.unit,
      minimumStock: definition.minimumStock,
      location: definition.location,
      condition: definition.condition,
      createdBy: actor?._id || null,
      updatedBy: actor?._id || null,
      createdAt: daysAgo(45, 8, 0),
      updatedAt: daysAgo(45, 8, 0),
    });

    // Initial stock is represented by a Stock In record, then every sample
    // event is applied as a delta so balances and transaction history agree.
    transactionSequence += 1;
    await StockTransaction.create({
      reference: `TXN-${String(transactionSequence).padStart(5, '0')}`,
      type: 'Stock In',
      item: item._id,
      quantity: definition.opening,
      balanceAfter: definition.opening,
      date: daysAgo(45, 8, 10),
      supplier: 'Opening balance',
      reason: 'Initial inventory count',
      remarks: 'Opening quantity recorded during initial system setup.',
      recordedBy: actor?._id || null,
    });

    let balance = definition.opening;
    const events = [...definition.events].sort((a, b) => a.days - b.days).reverse();
    for (const event of events) {
      const delta = event.type === 'Stock In' ? event.qty : -event.qty;
      if (balance + delta < 0) throw new Error(`Seed event would make ${definition.name} stock negative.`);
      balance += delta;
      transactionSequence += 1;
      const updated = await Item.findOneAndUpdate(
        { _id: item._id, quantity: { $gte: event.type === 'Stock Out' ? event.qty : 0 } },
        { $inc: { quantity: delta } },
        { new: true, runValidators: true }
      );
      if (!updated) throw new Error(`Could not apply seed movement for ${definition.name}.`);
      await StockTransaction.create({
        reference: `TXN-${String(transactionSequence).padStart(5, '0')}`,
        type: event.type,
        item: item._id,
        quantity: event.qty,
        balanceAfter: balance,
        date: daysAgo(event.days, 10 + (itemSequence % 6), 10 + itemSequence),
        supplier: event.supplier || '',
        reason: event.reason || '',
        remarks: event.remarks || '',
        recordedBy: actor?._id || null,
      });
    }
  }

  await Counter.bulkWrite([
    { updateOne: { filter: { _id: 'itemCode' }, update: { $set: { seq: itemSequence } }, upsert: true } },
    { updateOne: { filter: { _id: 'transaction' }, update: { $set: { seq: transactionSequence } }, upsert: true } },
    { updateOne: { filter: { _id: 'borrow' }, update: { $set: { seq: 0 } }, upsert: true } },
  ]);

  console.log(`Seed complete: ${CATEGORIES.length} school-resource categories, ${ITEMS.length} computer-lab items and ${transactionSequence} stock transactions. No demo accounts were created.`);
  return { seeded: true };
}

// Allow running directly: `npm run seed` (optionally with FORCE=1).
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  (async () => {
    try {
      await connectDB();
      await seedDatabase({ force: process.env.FORCE === '1' });
      await disconnectDB();
      process.exit(0);
    } catch (error) {
      console.error('Seed failed:', error);
      await disconnectDB().catch(() => {});
      process.exit(1);
    }
  })();
}
