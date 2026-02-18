
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDevices() {
  try {
    const devices = await prisma.device.findMany();
    console.log(`DEVICES_IN_DB: ${devices.length}`);
    devices.forEach(d => console.log(`DEVICE: ${d.id} - ${d.status}`));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkDevices();
