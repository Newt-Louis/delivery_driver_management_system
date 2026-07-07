const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const ACTIVE_STATUSES = ['CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'];
const MANUAL_SLOT_STATUSES = ['MAINTENANCE', 'RESERVED'];

module.exports = {
  generateDriverData,
  cleanupDriverData,
};

function generateDriverData(userContext, events, done) {
  const randomStr = `LOAD${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .substring(2, 7)
    .toUpperCase()}`;
  const randomPlate = `51C-${randomStr.slice(-8)}`;
  
  userContext.vars.vendorName = `Vendor ${randomStr}`;
  userContext.vars.driverName = `Driver ${randomStr}`;
  userContext.vars.driverPhone = `09${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
  userContext.vars.vehiclePlate = randomPlate;
  userContext.vars.loadTestId = `LOAD_TEST_${randomStr}`;
  
  return done();
}

function cleanupDriverData(userContext, events, done) {
  const registrationCode = userContext.vars.registrationCode;
  if (!registrationCode) return done();

  cleanupDelivery(String(registrationCode))
    .then(() => done())
    .catch((error) => {
      console.error('[LoadTest] cleanup failed', { registrationCode, error });
      done();
    });
}

async function cleanupDelivery(registrationCode) {
  await sleep(500);

  for (let attempt = 1; attempt <= 5; attempt++) {
    const delivery = await prisma.deliveryRegistration.findUnique({
      where: { registrationCode },
      select: { id: true, registrationCode: true, assignedSlotId: true },
    });
    if (!delivery) return;

    try {
      await prisma.$transaction([
        prisma.auditLog.deleteMany({ where: { targetId: delivery.id } }),
        prisma.deliveryHistoryEvent.deleteMany({ where: { originalDeliveryId: delivery.id } }),
        prisma.deliveryHistory.deleteMany({ where: { originalDeliveryId: delivery.id } }),
        prisma.pushSubscription.deleteMany({ where: { deliveryCode: delivery.registrationCode } }),
        prisma.deliveryRegistration.delete({ where: { id: delivery.id } }),
      ]);

      if (delivery.assignedSlotId) {
        await reconcileSlot(delivery.assignedSlotId);
      }
      return;
    } catch (error) {
      if (error?.code !== 'P2003' || attempt === 5) throw error;
      await sleep(250 * attempt);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reconcileSlot(slotId) {
  const slot = await prisma.slot.findUnique({ where: { id: slotId } });
  if (!slot) return;

  const activeDeliveries = await prisma.deliveryRegistration.findMany({
    where: {
      assignedSlotId: slot.id,
      status: { in: ACTIVE_STATUSES },
    },
    orderBy: [{ updatedAt: 'desc' }, { calledTime: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  });
  const activeDeliveryId = activeDeliveries[0]?.id ?? null;
  const isManual = MANUAL_SLOT_STATUSES.includes(slot.status);

  await prisma.slot.update({
    where: { id: slot.id },
    data: {
      currentDeliveryId: activeDeliveryId,
      ...(isManual
        ? {}
        : {
            status: activeDeliveries.length >= slot.maxCapacity ? 'OCCUPIED' : 'AVAILABLE',
          }),
    },
  });
}
