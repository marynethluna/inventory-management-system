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

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days, hour = 9, minute = 15) => {
  const date = new Date(Date.now() - days * DAY);
  date.setHours(hour, minute, 0, 0);
  return date;
};
const daysAhead = (days) => {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(17, 0, 0, 0);
  return date;
};
const isoDate = (date) => date.toISOString().slice(0, 10);

const USERS = [
  { name: 'Ana Dela Cruz', username: 'admin', email: 'ana.delacruz@cvsu.edu.ph', role: 'Administrator', password: 'Admin@123', isActive: true },
  { name: 'Mark Reyes', username: 'staff', email: 'mark.reyes@cvsu.edu.ph', role: 'Inventory Staff', password: 'Staff@123', isActive: true },
  { name: 'Julia Cruz', username: 'jcruz', email: 'julia.cruz@cvsu.edu.ph', role: 'Inventory Staff', password: 'Staff@123', isActive: true },
  { name: "Dean's Office", username: 'viewer', email: 'dean.office@cvsu.edu.ph', role: 'Viewer', password: 'Viewer@123', isActive: true },
  { name: 'Paolo Santos', username: 'psantos', email: 'paolo.santos@cvsu.edu.ph', role: 'Viewer', password: 'Viewer@123', isActive: false },
];

const CATEGORIES = [
  { name: 'Computer Equipment', description: 'Desktop, laptop and computer laboratory peripherals.' },
  { name: 'Laboratory Materials', description: 'Science laboratory apparatus, glassware and instruments.' },
  { name: 'School Supplies', description: 'Consumable supplies used by faculty and students.' },
  { name: 'Audio-Visual Equipment', description: 'Projectors, speakers and presentation equipment.' },
  { name: 'Furniture & Fixtures', description: 'Classroom and office furniture.' },
  { name: 'Sports Equipment', description: 'Physical education and sports materials.' },
];

const ITEMS = [
  {
    name: 'USB Wired Keyboard', category: 'Computer Equipment', opening: 30, minimumStock: 10, unit: 'pcs',
    location: 'Computer Lab 1', condition: 'Good', description: 'USB wired keyboard for desktop workstations.',
    events: [
      { type: 'Stock In', qty: 20, days: 6, supplier: 'CDO Hardware Supply', remarks: 'Delivery for Computer Lab 1.' },
      { type: 'Stock Out', qty: 8, days: 5, reason: 'Issued to students', remarks: 'Computer Laboratory 1, 8 units released.' },
    ],
  },
  {
    name: 'Optical Mouse', category: 'Computer Equipment', opening: 20, minimumStock: 10, unit: 'pcs',
    location: 'Computer Lab 1', condition: 'Good', description: 'USB wired optical mouse.',
    events: [{ type: 'Stock Out', qty: 12, days: 8, reason: 'Replaced defective units', remarks: 'Computer Lab 2 replacement request.' }],
  },
  {
    name: 'LED Monitor 19 inch', category: 'Computer Equipment', opening: 25, minimumStock: 5, unit: 'pcs',
    location: 'Computer Lab 2', condition: 'Good', description: '19-inch LED monitor for laboratory workstations.',
    events: [
      { type: 'Stock In', qty: 10, days: 2, supplier: 'Metro Manila IT Supplies', remarks: 'Additional monitors for Lab 2.' },
      { type: 'Stock Out', qty: 10, days: 6, reason: 'New workstation setup', remarks: 'Deployed to the new research room.' },
    ],
  },
  {
    name: 'System Unit (Core i3)', category: 'Computer Equipment', opening: 8, minimumStock: 5, unit: 'unit',
    location: 'Computer Lab 2', condition: 'Good', description: 'Desktop system unit, Core i3, 8GB RAM, 1TB HDD.',
    events: [{ type: 'Stock Out', qty: 5, days: 10, reason: 'Issued to faculty', remarks: 'Faculty room workstations.' }],
  },
  {
    name: 'HDMI Cable 1.5m', category: 'Audio-Visual Equipment', opening: 10, minimumStock: 5, unit: 'pcs',
    location: 'AV Room', condition: 'Good', description: '1.5 meter HDMI cable for projectors and displays.',
    events: [{ type: 'Stock Out', qty: 10, days: 3, reason: 'Distributed to classrooms', remarks: 'All cables released to classroom AV sets.' }],
  },
  {
    name: 'Projector', category: 'Audio-Visual Equipment', opening: 3, minimumStock: 2, unit: 'unit',
    location: 'AV Room', condition: 'Good', description: 'HDMI/VGA projector, 3200 lumens.',
    events: [{ type: 'Stock In', qty: 4, days: 6, supplier: 'AV Solutions Philippines', remarks: 'Procured for the new academic year.' }],
  },
  {
    name: 'Microscope', category: 'Laboratory Materials', opening: 10, minimumStock: 4, unit: 'unit',
    location: 'Science Laboratory', condition: 'Good', description: 'Compound microscope with LED illumination.',
    events: [{ type: 'Stock In', qty: 6, days: 7, supplier: 'Science Lab Supplies Inc.', remarks: 'Additional units for Biology.' }],
  },
  {
    name: 'Beaker 250 mL', category: 'Laboratory Materials', opening: 45, minimumStock: 20, unit: 'pcs',
    location: 'Science Laboratory', condition: 'Good', description: 'Borosilicate glass beaker, 250 mL.',
    events: [
      { type: 'Stock In', qty: 40, days: 8, supplier: 'Science Lab Supplies Inc.', remarks: 'Glassware replenishment.' },
      { type: 'Stock Out', qty: 20, days: 7, reason: 'Laboratory class use', remarks: 'Chemistry laboratory sessions.' },
    ],
  },
  {
    name: 'Test Tube (box of 100)', category: 'Laboratory Materials', opening: 30, minimumStock: 30, unit: 'box',
    location: 'Science Laboratory', condition: 'Good', description: 'Borosilicate test tubes, box of 100 pieces.',
    events: [{ type: 'Stock Out', qty: 12, days: 9, reason: 'Laboratory class use', remarks: 'Chemistry and Biology classes.' }],
  },
  {
    name: 'Bond Paper (A4)', category: 'School Supplies', opening: 80, minimumStock: 40, unit: 'ream',
    location: 'Supply Room', condition: 'New', description: 'A4 bond paper, 70gsm, 500 sheets per ream.',
    events: [
      { type: 'Stock In', qty: 60, days: 5, supplier: 'National Book Store', remarks: 'Quarterly supply order.' },
      { type: 'Stock Out', qty: 20, days: 1, reason: 'Office request', remarks: 'Registrar and Guidance Office.' },
    ],
  },
  {
    name: 'Whiteboard Marker', category: 'School Supplies', opening: 40, minimumStock: 20, unit: 'box',
    location: 'Supply Room', condition: 'New', description: 'Whiteboard markers, black and blue, box of 12.',
    events: [
      { type: 'Stock In', qty: 30, days: 3, supplier: 'National Book Store', remarks: 'Monthly classroom supplies.' },
      { type: 'Stock Out', qty: 15, days: 4, reason: 'Classroom distribution', remarks: 'Distributed to faculty.' },
    ],
  },
  {
    name: 'Printer Ink Cartridge', category: 'School Supplies', opening: 10, minimumStock: 6, unit: 'pcs',
    location: 'Supply Room', condition: 'New', description: 'Black ink cartridge for office printers.',
    events: [{ type: 'Stock Out', qty: 6, days: 6, reason: 'Office use', remarks: 'Administrative office printers.' }],
  },
  {
    name: 'Student Chair', category: 'Furniture & Fixtures', opening: 30, minimumStock: 10, unit: 'pcs',
    location: 'Storage Area', condition: 'Good', description: 'Stackable student chair with armrest.',
    events: [
      { type: 'Stock In', qty: 30, days: 9, supplier: 'Cavite Furniture Works', remarks: 'New classroom furniture.' },
      { type: 'Stock Out', qty: 12, days: 13, reason: 'Classroom deployment', remarks: 'Room 204 and Room 205.' },
    ],
  },
  {
    name: 'Folding Table', category: 'Furniture & Fixtures', opening: 12, minimumStock: 4, unit: 'pcs',
    location: 'Storage Area', condition: 'Fair', description: '6-foot folding table for events and activities.',
    events: [
      { type: 'Stock Out', qty: 2, days: 16, reason: 'Event use', remarks: 'University fair.' },
      { type: 'Stock In', qty: 2, days: 10, supplier: 'Cavite Furniture Works', remarks: 'Replacement for damaged units.' },
    ],
  },
  {
    name: 'Volleyball', category: 'Sports Equipment', opening: 6, minimumStock: 5, unit: 'pcs',
    location: 'Gym Storage', condition: 'Good', description: 'Official size volleyball for PE classes.',
    events: [
      { type: 'Stock In', qty: 6, days: 19, supplier: 'Sports Central', remarks: 'New PE equipment.' },
      { type: 'Stock Out', qty: 3, days: 5, reason: 'PE class use', remarks: 'Issued to the PE department.' },
    ],
  },
  {
    name: 'Digital Multimeter', category: 'Laboratory Materials', opening: 5, minimumStock: 3, unit: 'unit',
    location: 'Science Laboratory', condition: 'Good', description: 'Digital multimeter for electronics laboratory.',
    events: [
      { type: 'Stock In', qty: 2, days: 17, supplier: 'Engineering Supplies Co.', remarks: 'Additional units.' },
      { type: 'Stock Out', qty: 2, days: 2, reason: 'Laboratory class use', remarks: 'Electronics laboratory.' },
    ],
  },
];

const BORROWS = [
  {
    item: 'Projector', borrowerName: 'Prof. Elena Santos', borrowerIdNumber: 'FAC-2041', qty: 1,
    days: 2, expectedInDays: 5, returnedDaysAgo: null, remarks: 'Room 204 classroom presentation.',
  },
  {
    item: 'Microscope', borrowerName: 'Biology Department', borrowerIdNumber: 'SCI-1180', qty: 2,
    days: 1, expectedInDays: 3, returnedDaysAgo: null, remarks: 'Laboratory activity for Grade 11.',
  },
  {
    item: 'Beaker 250 mL', borrowerName: 'Chemistry Department', borrowerIdNumber: 'SCI-1092', qty: 5,
    days: 12, expectedInDays: -5, returnedDaysAgo: null, remarks: 'Science fair demonstration. Follow up needed.',
  },
  {
    item: 'Test Tube (box of 100)', borrowerName: 'Chemistry Department', borrowerIdNumber: 'SCI-1092', qty: 4,
    days: 20, expectedInDays: -12, returnedDaysAgo: 10, remarks: 'Returned in good condition.',
  },
  {
    item: 'Projector', borrowerName: 'Prof. Ramon Cruz', borrowerIdNumber: 'FAC-1188', qty: 1,
    days: 25, expectedInDays: -18, returnedDaysAgo: 20, remarks: 'Returned after the seminar.',
  },
  {
    item: 'Microscope', borrowerName: 'Biology Department', borrowerIdNumber: 'SCI-1180', qty: 2,
    days: 28, expectedInDays: -21, returnedDaysAgo: 21, remarks: 'Returned complete with accessories.',
  },
];

export async function seedDatabase({ force = false } = {}) {
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0 && !force) {
    console.log('Seed skipped: database already contains users.');
    return { seeded: false };
  }

  if (force) {
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Item.deleteMany({}),
      StockTransaction.deleteMany({}),
      BorrowRecord.deleteMany({}),
      ActivityLog.deleteMany({}),
      Counter.deleteMany({}),
    ]);
    console.log('Existing collections cleared for reseeding.');
  }

  // Users -----------------------------------------------------------------
  const users = {};
  for (const entry of USERS) {
    const [user] = await User.create([
      {
        name: entry.name,
        username: entry.username,
        email: entry.email,
        role: entry.role,
        isActive: entry.isActive,
        passwordHash: await User.hashPassword(entry.password),
        lastLoginAt: entry.isActive ? daysAgo(1, 8, 30) : daysAgo(30, 8, 30),
        passwordChangedAt: daysAgo(45),
      },
    ]);
    users[entry.username] = user;
  }
  const admin = users.admin;
  const staff = users.staff;
  const staff2 = users['jcruz'];

  // Categories ------------------------------------------------------------
  const categories = {};
  for (const entry of CATEGORIES) {
    const [category] = await Category.create([
      { name: entry.name, description: entry.description, createdBy: admin._id },
    ]);
    categories[entry.name] = category;
  }

  // Items + stock transactions -------------------------------------------
  const items = {};
  let transactionSeq = 0;
  const logs = [];
  const now = Date.now();

  // Deterministic borrow references shared by the item transactions and borrow records.
  const borrowRefs = BORROWS.map((borrow, index) => ({
    ...borrow,
    reference: `BRW-${String(index + 1).padStart(4, '0')}`,
    dateBorrowed: daysAgo(borrow.days, 10, 0),
    expectedReturnDate: daysAhead(borrow.expectedInDays),
    returned: borrow.returnedDaysAgo !== null,
    actualReturnDate: borrow.returnedDaysAgo !== null ? daysAgo(borrow.returnedDaysAgo, 14, 30) : null,
  }));

  for (let index = 0; index < ITEMS.length; index += 1) {
    const definition = ITEMS[index];
    const itemCode = `INV-${String(index + 1).padStart(4, '0')}`;

    const borrowEvents = borrowRefs
      .filter((borrow) => borrow.item === definition.name)
      .map((borrow) => ({
        ...borrow,
        event: {
          type: 'Borrowed',
          qty: borrow.qty,
          date: borrow.dateBorrowed,
          reason: `Borrowed by ${borrow.borrowerName}`,
          remarks: `Borrow reference ${borrow.reference}.`,
        },
        returnEvent: borrow.returned
          ? {
              type: 'Returned',
              qty: borrow.qty,
              date: borrow.actualReturnDate,
              reason: `Returned by ${borrow.borrowerName}`,
              remarks: `Borrow reference ${borrow.reference}.`,
            }
          : null,
      }));

    const events = [
      ...definition.events.map((event) => ({
        ...event,
        date: daysAgo(event.days, 9 + (index % 7), 10 + (index % 40)),
      })),
      ...borrowEvents.flatMap((borrow) => [borrow.event, ...(borrow.returnEvent ? [borrow.returnEvent] : [])]),
    ].sort((a, b) => a.date - b.date);

    let balance = definition.opening;
    const createdItem = await Item.create({
      itemCode,
      name: definition.name,
      category: categories[definition.category]._id,
      description: definition.description,
      quantity: balance,
      unit: definition.unit,
      minimumStock: definition.minimumStock,
      location: definition.location,
      condition: definition.condition,
      createdBy: admin._id,
      updatedBy: staff._id,
      createdAt: daysAgo(40, 8, 0),
      updatedAt: daysAgo(1, 16, 0),
    });
    items[definition.name] = createdItem;

    for (const event of events) {
      const delta = event.type === 'Stock In' || event.type === 'Returned' ? event.qty : -event.qty;
      balance += delta;
      if (balance < 0) balance = 0;
      transactionSeq += 1;
      await StockTransaction.create({
        reference: `TXN-${String(transactionSeq).padStart(5, '0')}`,
        type: event.type,
        item: createdItem._id,
        quantity: event.qty,
        balanceAfter: balance,
        date: event.date,
        supplier: event.supplier || '',
        reason: event.reason || '',
        remarks: event.remarks || '',
        recordedBy: event.type === 'Stock Out' ? staff2._id : staff._id,
      });
    }

    createdItem.quantity = balance;
    createdItem.updatedAt = events.length ? events[events.length - 1].date : createdItem.updatedAt;
    await createdItem.save({ validateBeforeSave: false });

    logs.push({
      actor: admin,
      action: 'Added inventory item',
      entityType: 'Item',
      entityId: createdItem._id.toString(),
      entityLabel: `${itemCode} · ${definition.name}`,
      details: `Opening quantity ${definition.opening} ${definition.unit} in ${definition.category}`,
      createdAt: daysAgo(40, 8, 5),
    });
  }

  // Borrow records --------------------------------------------------------
  for (const borrow of borrowRefs) {
    const item = items[borrow.item];
    const record = await BorrowRecord.create({
      reference: borrow.reference,
      borrowerName: borrow.borrowerName,
      borrowerIdNumber: borrow.borrowerIdNumber,
      item: item._id,
      quantity: borrow.qty,
      dateBorrowed: borrow.dateBorrowed,
      expectedReturnDate: borrow.expectedReturnDate,
      actualReturnDate: borrow.actualReturnDate,
      status: borrow.returned ? 'Returned' : 'Borrowed',
      remarks: borrow.remarks,
      recordedBy: staff._id,
      returnedBy: borrow.returned ? staff2._id : null,
    });
    logs.push({
      actor: staff,
      action: 'Recorded borrowed item',
      entityType: 'Borrow',
      entityId: record._id.toString(),
      entityLabel: `${record.reference} · ${item.name}`,
      details: `${borrow.borrowerName} borrowed ${borrow.qty} ${item.unit}`,
      createdAt: daysAgo(borrow.days, 10, 5),
    });
  }

  // Activity logs ---------------------------------------------------------
  const extraLogs = [
    { actor: staff, action: 'Recorded stock in', entityType: 'Item', entityLabel: 'INV-0001 · USB Wired Keyboard', details: 'Stock In of 20 pcs. New balance: 42.', createdAt: daysAgo(12, 11, 20) },
    { actor: staff2, action: 'Recorded stock out', entityType: 'Item', entityLabel: 'INV-0010 · Bond Paper (A4)', details: 'Stock Out of 20 reams. New balance: 120.', createdAt: daysAgo(1, 13, 40) },
    { actor: admin, action: 'Updated inventory item', entityType: 'Item', entityLabel: 'INV-0005 · HDMI Cable 1.5m', details: 'Minimum stock level updated to 5 pcs', createdAt: daysAgo(4, 15, 10) },
    { actor: admin, action: 'Created user account', entityType: 'User', entityLabel: 'jcruz', details: 'Julia Cruz assigned as Inventory Staff', createdAt: daysAgo(35, 9, 0) },
    { actor: admin, action: 'Deactivated account', entityType: 'User', entityLabel: 'psantos', details: 'Paolo Santos is now inactive', createdAt: daysAgo(8, 16, 25) },
    { actor: admin, action: 'Created category', entityType: 'Category', entityLabel: 'Sports Equipment', details: 'New category for physical education materials', createdAt: daysAgo(30, 10, 15) },
    { actor: staff, action: 'Recorded returned item', entityType: 'Borrow', entityLabel: 'BRW-0004 · Test Tube (box of 100)', details: 'Chemistry Department returned 4 boxes', createdAt: daysAgo(10, 14, 35) },
    { actor: admin, action: 'Generated inventory report', entityType: 'Report', entityLabel: 'Complete inventory report', details: 'Printed for the quarterly inventory review', createdAt: daysAgo(6, 9, 45) },
  ];

  for (const entry of extraLogs) {
    logs.push({ ...entry, ip: '127.0.0.1', userAgent: 'seed-script' });
  }

  await ActivityLog.insertMany(
    logs.map((entry) => ({
      actor: entry.actor?._id || null,
      actorName: entry.actor?.name || 'System',
      actorUsername: entry.actor?.username || 'system',
      actorRole: entry.actor?.role || '',
      action: entry.action,
      entityType: entry.entityType || '',
      entityId: entry.entityId || '',
      entityLabel: entry.entityLabel || '',
      details: entry.details || '',
      ip: entry.ip || '127.0.0.1',
      userAgent: entry.userAgent || 'seed-script',
      createdAt: entry.createdAt || new Date(now - 3600 * 1000),
    }))
  );

  // Keep reference counters ahead of the seeded records.
  await Counter.bulkWrite([
    { updateOne: { filter: { _id: 'itemCode' }, update: { $set: { seq: ITEMS.length } }, upsert: true } },
    { updateOne: { filter: { _id: 'transaction' }, update: { $set: { seq: transactionSeq } }, upsert: true } },
    { updateOne: { filter: { _id: 'borrow' }, update: { $set: { seq: BORROWS.length } }, upsert: true } },
  ]);

  console.log(`Seed complete: ${USERS.length} users, ${CATEGORIES.length} categories, ${ITEMS.length} items, ${transactionSeq} transactions, ${BORROWS.length} borrow records.`);
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
      process.exit(1);
    }
  })();
}
