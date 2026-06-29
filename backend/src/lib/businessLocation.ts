import { ReceivingUnit } from '@prisma/client';
import { prisma } from './prisma';

export async function getDefaultBusinessLocation() {
  let location = await prisma.businessLocation.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!location) {
    location = await prisma.businessLocation.create({
      data: {
        code: 'DEFAULT',
        locationName: 'THISO GROUP',
        tagline: 'Delivery Management System',
      },
    });
  }

  return location;
}

export async function getUnitConfigForDefaultLocation(unit: ReceivingUnit) {
  const location = await getDefaultBusinessLocation();
  return prisma.unitConfig.findUnique({
    where: {
      businessLocationId_unit: {
        businessLocationId: location.id,
        unit,
      },
    },
  });
}
